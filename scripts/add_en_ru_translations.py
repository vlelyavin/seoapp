#!/usr/bin/env python3
"""
Add English and Russian translations for all missing keys.
"""

import json
from pathlib import Path
from typing import Dict, Any


def load_json(file_path: Path) -> Dict:
    """Load JSON file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(file_path: Path, data: Dict):
    """Save JSON file with proper formatting."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_nested(data: Dict, path: str, default=None) -> Any:
    """Get nested value from dict using dot notation."""
    keys = path.split('.')
    value = data
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return default
    return value


def set_nested(data: Dict, path: str, value: Any):
    """Set nested value in dict using dot notation."""
    keys = path.split('.')
    current = data
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]
    current[keys[-1]] = value


def get_all_keys(data: Dict, prefix=''):
    """Get all keys from nested dict."""
    keys = set()
    if isinstance(data, dict):
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            keys.add(full_key)
            if isinstance(value, dict):
                keys.update(get_all_keys(value, full_key))
    return keys


def copy_missing_keys(uk_data: Dict, target_data: Dict, lang: str) -> int:
    """Copy all missing keys from UK to target language."""
    uk_keys = get_all_keys(uk_data)
    target_keys = get_all_keys(target_data)
    missing_keys = uk_keys - target_keys

    added = 0
    for key in sorted(missing_keys):
        uk_value = get_nested(uk_data, key)
        if uk_value is not None and isinstance(uk_value, str):
            # Try to find translation from existing details/recommendations sections
            translated_value = None

            # For Type A keys (issues.{key}_details), try to find in details.{key}
            if '.issues.' in key and key.endswith('_details'):
                base_key = key.rsplit('.', 1)[0]  # Remove last part
                key_name = key.split('.')[-1][:-8]  # Remove '_details'
                detail_key = base_key.replace('.issues.', '.details.') + '.' + key_name
                translated_value = get_nested(target_data, detail_key)

            # For Type B keys (issues.{key}_recommendation), try to find in recommendations.{key}
            elif '.issues.' in key and key.endswith('_recommendation'):
                base_key = key.rsplit('.', 1)[0]
                key_name = key.split('.')[-1][:-15]  # Remove '_recommendation'
                rec_key = base_key.replace('.issues.', '.recommendations.') + '.' + key_name
                translated_value = get_nested(target_data, rec_key)

            # If not found, use UK value (will need manual translation later)
            if translated_value is None:
                translated_value = uk_value

            set_nested(target_data, key, translated_value)
            added += 1
            if added <= 20:  # Show first 20
                print(f"  Added: {key}")

    if added > 20:
        print(f"  ... and {added - 20} more keys")

    return added


def main():
    """Main function."""
    base_path = Path(__file__).parent.parent
    locales_path = base_path / 'app' / 'locales'

    # Load all data
    uk_data = load_json(locales_path / 'uk.json')
    en_data = load_json(locales_path / 'en.json')
    ru_data = load_json(locales_path / 'ru.json')

    print("=" * 80)
    print("ADDING ENGLISH TRANSLATIONS")
    print("=" * 80)
    print()

    added_en = copy_missing_keys(uk_data, en_data, 'en')
    save_json(locales_path / 'en.json', en_data)
    print()
    print(f"Total added to EN: {added_en} keys")
    print()

    print("=" * 80)
    print("ADDING RUSSIAN TRANSLATIONS")
    print("=" * 80)
    print()

    added_ru = copy_missing_keys(uk_data, ru_data, 'ru')
    save_json(locales_path / 'ru.json', ru_data)
    print()
    print(f"Total added to RU: {added_ru} keys")
    print()

    print("=" * 80)
    print("DONE!")
    print("=" * 80)
    print()
    print("IMPORTANT: Many keys still contain Ukrainian text that needs manual translation.")
    print("Search for Ukrainian characters in en.json and ru.json to find them.")
    print()
    print("Next step: Run find_missing_translations.py to verify 0 missing keys")


if __name__ == '__main__':
    main()
