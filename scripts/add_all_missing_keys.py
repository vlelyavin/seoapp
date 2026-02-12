#!/usr/bin/env python3
"""
Comprehensive script to add ALL missing translation keys to UK, EN, and RU locale files.
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


def add_missing_keys_uk(data: Dict) -> int:
    """Add all missing keys to Ukrainian translation file."""
    added = 0

    # Common table headers
    table_headers = {
        'tables.problem': 'Проблема',
        'tables.header': 'Заголовок',
        'tables.value': 'Значення',
        'tables.image_url': 'URL зображення',
        'tables.page': 'Сторінка',
        'tables.size': 'Розмір',
        'tables.word_count': 'Кількість слів',
        'tables.length': 'Довжина',
    }

    for key, value in table_headers.items():
        if not get_nested(data, key):
            set_nested(data, key, value)
            print(f"Added: {key}")
            added += 1

    # For each analyzer, copy details and recommendations to issues section with suffixes
    analyzers_to_fix = [
        'robots', 'security', 'meta_tags', 'headings', 'images',
        'favicon', 'content', 'links', 'mobile'
    ]

    for analyzer in analyzers_to_fix:
        analyzer_path = f'analyzer_content.{analyzer}'

        # Get existing sections
        details = get_nested(data, f'{analyzer_path}.details', {})
        recommendations = get_nested(data, f'{analyzer_path}.recommendations', {})
        issues = get_nested(data, f'{analyzer_path}.issues', {})

        # Copy details.{key} to issues.{key}_details
        for key, value in details.items():
            target_key = f'{analyzer_path}.issues.{key}_details'
            if not get_nested(data, target_key):
                set_nested(data, target_key, value)
                print(f"Added: {target_key}")
                added += 1

        # Copy recommendations.{key} to issues.{key}_recommendation
        for key, value in recommendations.items():
            target_key = f'{analyzer_path}.issues.{key}_recommendation'
            if not get_nested(data, target_key):
                set_nested(data, target_key, value)
                print(f"Added: {target_key}")
                added += 1

    # Add specific status labels and other Type D/E keys
    specific_keys = {
        # Robots analyzer
        'analyzer_content.robots.issues.count_items': 'Кількість елементів',
        'analyzer_content.robots.issues.noindex_pages_label': 'Сторінки з noindex',
        'analyzer_content.robots.issues.none': 'Немає',
        'analyzer_content.robots.issues.status_exists': 'Є',
        'analyzer_content.robots.issues.status_missing': 'Відсутній',
        'analyzer_content.robots.issues.table_title': 'Статус індексації',
        'analyzer_content.robots.issues.robots_errors': 'Помилки в robots.txt: {count}',
        'analyzers.robots.files': 'Файли',

        # Security analyzer
        'analyzer_content.security.issues.status_check_failed': 'Перевірка не вдалася',
        'analyzer_content.security.issues.status_invalid': 'Некоректний',
        'analyzer_content.security.issues.status_missing': 'Відсутній',
        'analyzer_content.security.issues.status_present': 'Присутній',
        'analyzer_content.security.issues.table_title': 'Заголовки безпеки',

        # Meta_tags analyzer
        'analyzer_content.meta_tags.issues.problem_duplicate_title': 'Дублікат Title',
        'analyzer_content.meta_tags.issues.problem_long_title': 'Title занадто довгий',
        'analyzer_content.meta_tags.issues.problem_missing_title': 'Відсутній Title',
        'analyzer_content.meta_tags.issues.problem_short_title': 'Title занадто короткий',
        'analyzer_content.meta_tags.issues.table_title': 'Проблемні сторінки',

        # Headings analyzer
        'analyzer_content.headings.issues.empty_value': 'Порожнє значення',
        'analyzer_content.headings.issues.problem_empty_h1': 'Порожній H1',
        'analyzer_content.headings.issues.problem_hierarchy_skip': 'Порушення ієрархії',
        'analyzer_content.headings.issues.problem_missing_h1': 'Відсутній H1',
        'analyzer_content.headings.issues.problem_multiple_h1': 'Декілька H1',
        'analyzer_content.headings.issues.table_title': 'Проблеми заголовків',

        # Images analyzer
        'analyzer_content.images.issues.problem_critical_size': 'Критичний розмір',
        'analyzer_content.images.issues.problem_large_size': 'Великий розмір',
        'analyzer_content.images.issues.table_title': 'Проблемні зображення',

        # Favicon analyzer
        'analyzer_content.favicon.issues.missing': 'Favicon відсутній',
        'analyzer_content.favicon.issues.no_apple': 'Відсутній Apple Touch Icon',
        'analyzer_content.favicon.issues.no_ico': 'Відсутній .ico файл',
        'analyzer_content.favicon.issues.old_format': 'Застарілий формат',
        'analyzer_content.favicon.details.missing': 'Favicon — це маленька іконка, яка відображається в закладках браузера та на вкладках.',
        'analyzer_content.favicon.recommendations.missing': 'Додайте favicon у форматі PNG або ICO до кореневої директорії сайту.',

        # Content analyzer
        'analyzer_content.content.issues.status_empty': 'Порожньо',
        'analyzer_content.content.issues.status_thin': 'Недостатньо контенту',
        'analyzer_content.content.issues.table_title': 'Сторінки з недостатнім контентом',

        # Links analyzer
        'analyzer_content.links.issues.type_external': 'Зовнішнє',
        'analyzer_content.links.issues.type_internal': 'Внутрішнє',
        'analyzer_content.links.issues.table_title': 'Биті посилання',

        # Mobile analyzer
        # (all Type A/B keys already covered by the loop above)

        # URL quality analyzer
        # (table headers already added above)
    }

    for key, value in specific_keys.items():
        if not get_nested(data, key):
            set_nested(data, key, value)
            print(f"Added: {key}")
            added += 1

    return added


def translate_uk_to_en(uk_value: str) -> str:
    """Translate Ukrainian text to English (basic mappings)."""
    translations = {
        # Common words
        'Проблема': 'Issue',
        'Заголовок': 'Header',
        'Значення': 'Value',
        'URL зображення': 'Image URL',
        'Сторінка': 'Page',
        'Розмір': 'Size',
        'Кількість слів': 'Word Count',
        'Довжина': 'Length',

        # Status labels
        'Є': 'Exists',
        'Відсутній': 'Missing',
        'Присутній': 'Present',
        'Порожньо': 'Empty',
        'Недостатньо контенту': 'Thin Content',
        'Некоректний': 'Invalid',
        'Перевірка не вдалася': 'Check Failed',

        # Other labels
        'Кількість елементів': 'Number of Items',
        'Сторінки з noindex': 'Pages with noindex',
        'Немає': 'None',
        'Статус індексації': 'Indexation Status',
        'Файли': 'Files',
        'Заголовки безпеки': 'Security Headers',
        'Проблемні сторінки': 'Problematic Pages',
        'Порожнє значення': 'Empty Value',
        'Порожній H1': 'Empty H1',
        'Порушення ієрархії': 'Hierarchy Violation',
        'Відсутній H1': 'Missing H1',
        'Декілька H1': 'Multiple H1',
        'Проблеми заголовків': 'Heading Issues',
        'Критичний розмір': 'Critical Size',
        'Великий розмір': 'Large Size',
        'Проблемні зображення': 'Problematic Images',
        'Favicon відсутній': 'Favicon missing',
        'Відсутній Apple Touch Icon': 'Apple Touch Icon missing',
        'Відсутній .ico файл': '.ico file missing',
        'Застарілий формат': 'Outdated format',
        'Сторінки з недостатнім контентом': 'Pages with Thin Content',
        'Биті посилання': 'Broken Links',
        'Зовнішнє': 'External',
        'Внутрішнє': 'Internal',
        'Дублікат Title': 'Duplicate Title',
        'Title занадто довгий': 'Title Too Long',
        'Відсутній Title': 'Missing Title',
        'Title занадто короткий': 'Title Too Short',

        # With placeholders
        'Помилки в robots.txt: {count}': 'Errors in robots.txt: {count}',
    }

    # Check if value is a simple word/phrase that can be translated
    if uk_value in translations:
        return translations[uk_value]

    # For longer texts, return placeholder indicating manual translation needed
    if len(uk_value) > 100:
        return uk_value  # Keep original for now, will translate manually later

    return uk_value


def translate_uk_to_ru(uk_value: str) -> str:
    """Translate Ukrainian text to Russian (basic mappings)."""
    translations = {
        # Common words
        'Проблема': 'Проблема',
        'Заголовок': 'Заголовок',
        'Значення': 'Значение',
        'URL зображення': 'URL изображения',
        'Сторінка': 'Страница',
        'Розмір': 'Размер',
        'Кількість слів': 'Количество слов',
        'Довжина': 'Длина',

        # Status labels
        'Є': 'Есть',
        'Відсутній': 'Отсутствует',
        'Присутній': 'Присутствует',
        'Порожньо': 'Пусто',
        'Недостатньо контенту': 'Мало контента',
        'Некоректний': 'Некорректный',
        'Перевірка не вдалася': 'Проверка не удалась',

        # Other labels
        'Кількість елементів': 'Количество элементов',
        'Сторінки з noindex': 'Страницы с noindex',
        'Немає': 'Нет',
        'Статус індексації': 'Статус индексации',
        'Файли': 'Файлы',
        'Заголовки безпеки': 'Заголовки безопасности',
        'Проблемні сторінки': 'Проблемные страницы',
        'Порожнє значення': 'Пустое значение',
        'Порожній H1': 'Пустой H1',
        'Порушення ієрархії': 'Нарушение иерархии',
        'Відсутній H1': 'Отсутствует H1',
        'Декілька H1': 'Несколько H1',
        'Проблеми заголовків': 'Проблемы заголовков',
        'Критичний розмір': 'Критический размер',
        'Великий розмір': 'Большой размер',
        'Проблемні зображення': 'Проблемные изображения',
        'Favicon відсутній': 'Favicon отсутствует',
        'Відсутній Apple Touch Icon': 'Отсутствует Apple Touch Icon',
        'Відсутній .ico файл': 'Отсутствует .ico файл',
        'Застарілий формат': 'Устаревший формат',
        'Сторінки з недостатнім контентом': 'Страницы с недостаточным контентом',
        'Биті посилання': 'Битые ссылки',
        'Зовнішнє': 'Внешняя',
        'Внутрішнє': 'Внутренняя',
        'Дублікат Title': 'Дубликат Title',
        'Title занадто довгий': 'Title слишком длинный',
        'Відсутній Title': 'Отсутствует Title',
        'Title занадто короткий': 'Title слишком короткий',

        # With placeholders
        'Помилки в robots.txt: {count}': 'Ошибки в robots.txt: {count}',
    }

    if uk_value in translations:
        return translations[uk_value]

    if len(uk_value) > 100:
        return uk_value  # Keep original for now

    return uk_value


def main():
    """Main function."""
    base_path = Path(__file__).parent.parent
    locales_path = base_path / 'app' / 'locales'

    # Create backups
    for locale in ['uk', 'en', 'ru']:
        backup_path = locales_path / f'{locale}.json.backup'
        original_path = locales_path / f'{locale}.json'
        data = load_json(original_path)
        save_json(backup_path, data)
        print(f"Created backup: {backup_path}")

    print()
    print("=" * 80)
    print("ADDING MISSING KEYS TO UKRAINIAN (uk.json)")
    print("=" * 80)
    print()

    uk_data = load_json(locales_path / 'uk.json')
    added_uk = add_missing_keys_uk(uk_data)
    save_json(locales_path / 'uk.json', uk_data)

    print()
    print(f"Added {added_uk} keys to uk.json")
    print()

    print("=" * 80)
    print("DONE!")
    print("=" * 80)
    print()
    print("Next steps:")
    print("1. Review uk.json and verify all added keys")
    print("2. Run scripts/add_english_russian.py to add EN/RU translations")
    print("3. Run scripts/find_missing_translations.py to verify 0 missing keys")


if __name__ == '__main__':
    main()
