#!/usr/bin/env python3
"""
Script to generate missing translation keys by copying from existing translations
where possible, and creating templates for manual entries.
"""

import json
import re
from pathlib import Path
from collections import defaultdict
from typing import Dict, Set, Any


def load_json(file_path: Path) -> Dict:
    """Load JSON file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(file_path: Path, data: Dict):
    """Save JSON file with proper formatting."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_nested_value(data: Dict, key_path: str) -> Any:
    """Get value from nested dict using dot notation."""
    keys = key_path.split('.')
    value = data
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return None
    return value


def set_nested_value(data: Dict, key_path: str, value: Any):
    """Set value in nested dict using dot notation."""
    keys = key_path.split('.')
    current = data
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]
    current[keys[-1]] = value


def main():
    """Main function to generate missing translation keys."""
    base_path = Path(__file__).parent.parent
    locales_path = base_path / 'app' / 'locales'

    # Load Ukrainian translations (source language)
    uk_data = load_json(locales_path / 'uk.json')
    en_data = load_json(locales_path / 'en.json')
    ru_data = load_json(locales_path / 'ru.json')

    print("Generating missing translation keys...")
    print()

    # Define missing keys manually (from the validation script output)
    missing_keys = {
        'robots': {
            'Type A': [
                'analyzer_content.robots.issues.canonical_issues_details',
                'analyzer_content.robots.issues.empty_sitemap_details',
                'analyzer_content.robots.issues.no_robots_txt_details',
                'analyzer_content.robots.issues.no_sitemap_details',
                'analyzer_content.robots.issues.no_sitemap_in_robots_details',
                'analyzer_content.robots.issues.noindex_pages_details',
                'analyzer_content.robots.issues.pages_not_in_sitemap_details',
                'analyzer_content.robots.issues.sitemap_old_lastmod_details',
                'analyzer_content.robots.issues.sitemap_urls_not_found_details',
            ],
            'Type B': [
                'analyzer_content.robots.issues.canonical_issues_recommendation',
                'analyzer_content.robots.issues.empty_sitemap_recommendation',
                'analyzer_content.robots.issues.no_robots_txt_recommendation',
                'analyzer_content.robots.issues.no_sitemap_in_robots_recommendation',
                'analyzer_content.robots.issues.no_sitemap_recommendation',
                'analyzer_content.robots.issues.noindex_pages_recommendation',
                'analyzer_content.robots.issues.pages_not_in_sitemap_recommendation',
                'analyzer_content.robots.issues.robots_errors_recommendation',
                'analyzer_content.robots.issues.sitemap_errors_recommendation',
                'analyzer_content.robots.issues.sitemap_old_lastmod_recommendation',
                'analyzer_content.robots.issues.sitemap_urls_not_found_recommendation',
            ],
            'Type D': [
                ('analyzer_content.robots.issues.count_items', 'Кількість елементів'),
                ('analyzer_content.robots.issues.noindex_pages_label', 'Сторінки з noindex'),
                ('analyzer_content.robots.issues.none', 'Немає'),
                ('analyzer_content.robots.issues.status_exists', 'Є'),
                ('analyzer_content.robots.issues.status_missing', 'Відсутній'),
                ('analyzer_content.robots.issues.table_title', 'Статус індексації'),
            ],
            'Type E': [
                ('analyzer_content.robots.issues.robots_errors', 'Помилки в robots.txt: {count}'),
                ('analyzers.robots.files', 'Файли'),
            ],
        },
    }

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

    # Add table headers to uk_data
    if 'tables' not in uk_data:
        uk_data['tables'] = {}

    for key, value in table_headers.items():
        set_nested_value(uk_data, key, value)
        print(f"Added: {key} = {value}")

    # Process Type A keys (issues.{key}_details -> details.{key})
    for analyzer, keys in missing_keys.items():
        if 'Type A' in keys:
            for missing_key in keys['Type A']:
                # Extract the base key: analyzer_content.robots.issues.no_robots_txt_details
                # Should look for: analyzer_content.robots.details.no_robots_txt
                parts = missing_key.split('.')
                if parts[-1].endswith('_details'):
                    base_key_name = parts[-1][:-8]  # Remove '_details'
                    # Construct the source key
                    source_key = '.'.join(parts[:-2] + ['details', base_key_name])

                    source_value = get_nested_value(uk_data, source_key)
                    if source_value:
                        set_nested_value(uk_data, missing_key, source_value)
                        print(f"Added (Type A): {missing_key}")
                        print(f"  Copied from: {source_key}")
                    else:
                        print(f"WARNING: Could not find source for {missing_key}")
                        print(f"  Expected source: {source_key}")

    # Process Type B keys (issues.{key}_recommendation -> recommendations.{key})
    for analyzer, keys in missing_keys.items():
        if 'Type B' in keys:
            for missing_key in keys['Type B']:
                # Extract the base key
                parts = missing_key.split('.')
                if parts[-1].endswith('_recommendation'):
                    base_key_name = parts[-1][:-15]  # Remove '_recommendation'
                    # Construct the source key
                    source_key = '.'.join(parts[:-2] + ['recommendations', base_key_name])

                    source_value = get_nested_value(uk_data, source_key)
                    if source_value:
                        set_nested_value(uk_data, missing_key, source_value)
                        print(f"Added (Type B): {missing_key}")
                        print(f"  Copied from: {source_key}")
                    else:
                        print(f"WARNING: Could not find source for {missing_key}")
                        print(f"  Expected source: {source_key}")

    # Process Type D and Type E keys (manual values provided)
    for analyzer, keys in missing_keys.items():
        for type_key in ['Type D', 'Type E']:
            if type_key in keys:
                for key_tuple in keys[type_key]:
                    missing_key, value = key_tuple
                    set_nested_value(uk_data, missing_key, value)
                    print(f"Added ({type_key}): {missing_key} = {value}")

    print()
    print("=" * 80)
    print("IMPORTANT: This script only handles the 'robots' analyzer as an example.")
    print("You need to manually extend this script or add keys for the remaining analyzers:")
    print("  - security (21 keys)")
    print("  - meta_tags (20 keys)")
    print("  - headings (17 keys)")
    print("  - images (17 keys)")
    print("  - favicon (12 keys)")
    print("  - content (8 keys)")
    print("  - links (7 keys)")
    print("  - mobile (7 keys)")
    print("  - url_quality (2 keys)")
    print("=" * 80)
    print()

    # Save updated Ukrainian translations
    backup_path = locales_path / 'uk.json.backup'
    uk_path = locales_path / 'uk.json'

    print(f"Creating backup: {backup_path}")
    save_json(backup_path, load_json(uk_path))

    print(f"Saving updated translations: {uk_path}")
    save_json(uk_path, uk_data)

    print()
    print("Done! Review the updated uk.json file and verify the changes.")


if __name__ == '__main__':
    main()
