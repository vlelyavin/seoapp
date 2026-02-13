"""Internationalization (i18n) module for multi-language support."""

import json
import logging
import threading
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Supported languages
SUPPORTED_LANGUAGES = ["uk", "ru", "en"]
DEFAULT_LANGUAGE = "en"

# Cache for loaded translations (thread-safe via lock)
_translations: Dict[str, Dict[str, Any]] = {}
_translations_lock = threading.Lock()


def load_translations(language: str) -> Dict[str, Any]:
    """Load translations for a specific language."""
    with _translations_lock:
        if language in _translations:
            return _translations[language]

        if language not in SUPPORTED_LANGUAGES:
            language = DEFAULT_LANGUAGE

        locale_path = Path(__file__).parent / "locales" / f"{language}.json"

        if not locale_path.exists():
            # Fallback to default
            locale_path = Path(__file__).parent / "locales" / f"{DEFAULT_LANGUAGE}.json"

        if locale_path.exists():
            with open(locale_path, "r", encoding="utf-8") as f:
                _translations[language] = json.load(f)
        else:
            _translations[language] = {}

        return _translations[language]


def t(key: str, language: str = DEFAULT_LANGUAGE, **kwargs) -> str:
    """
    Translate a key to the specified language.

    Args:
        key: Translation key in dot notation (e.g., "analyzers.meta_tags.name")
        language: Target language code
        **kwargs: Values for placeholder substitution

    Returns:
        Translated string or the key if not found
    """
    translations = load_translations(language)

    # Navigate nested keys
    parts = key.split(".")
    value = translations

    for part in parts:
        if isinstance(value, dict) and part in value:
            value = value[part]
        else:
            return key  # Return key if not found

    if isinstance(value, str):
        # Substitute placeholders {name} with kwargs
        try:
            return value.format(**kwargs)
        except (KeyError, ValueError, IndexError):
            return value

    return str(value) if value else key


class Translator:
    """Translator instance for a specific language."""

    def __init__(self, language: str = DEFAULT_LANGUAGE):
        if language not in SUPPORTED_LANGUAGES:
            language = DEFAULT_LANGUAGE
        self.language = language
        self.translations = load_translations(language)

    def __call__(self, key: str, **kwargs) -> str:
        """Shorthand for translation."""
        return t(key, self.language, **kwargs)

    def get(self, key: str, default: str = "", **kwargs) -> str:
        """Get translation with default fallback."""
        result = t(key, self.language, **kwargs)
        if result == key and not default:
            logger.warning(f"Missing translation key: {key} for language: {self.language}")
        return result if result != key else default


# Thread-local storage for per-request language
_thread_local = threading.local()


def set_language(language: str) -> None:
    """Set the current language for the calling thread/coroutine."""
    _thread_local.language = language if language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE
    _thread_local.translator = Translator(_thread_local.language)


def get_translator(language: Optional[str] = None) -> Translator:
    """Get translator for specified or current language."""
    if language:
        return Translator(language)
    lang = getattr(_thread_local, "language", DEFAULT_LANGUAGE)
    translator = getattr(_thread_local, "translator", None)
    if translator is None or translator.language != lang:
        translator = Translator(lang)
        _thread_local.translator = translator
    return translator


# Convenience function
def _(key: str, language: Optional[str] = None, **kwargs) -> str:
    """
    Quick translation function.

    Usage:
        from app.i18n import _
        message = _("analyzers.meta_tags.name", language="ru")
    """
    lang = language or getattr(_thread_local, "language", DEFAULT_LANGUAGE)
    return t(key, lang, **kwargs)
