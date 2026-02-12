#!/usr/bin/env python3
"""
Script to identify missing translation keys by comparing analyzer code usage
with available translations in locale files.
"""

import json
import re
from pathlib import Path
from collections import defaultdict
from typing import Dict, Set, List, Tuple


def extract_translation_keys_from_file(file_path: Path) -> Set[str]:
    """Extract all translation keys used in a Python file via self.t() calls."""
    keys = set()

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to match self.t("key") or self.t('key')
    pattern = r'self\.t\(["\']([^"\']+)["\']'
    matches = re.findall(pattern, content)

    for match in matches:
        keys.add(match)

    return keys


def load_translation_keys(locale_file: Path) -> Set[str]:
    """Load all available translation keys from a JSON locale file."""
    with open(locale_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    def extract_keys(obj, prefix=''):
        """Recursively extract all keys from nested JSON."""
        keys = set()
        if isinstance(obj, dict):
            for key, value in obj.items():
                full_key = f"{prefix}.{key}" if prefix else key
                keys.add(full_key)
                if isinstance(value, dict):
                    keys.update(extract_keys(value, full_key))
        return keys

    return extract_keys(data)


def categorize_missing_key(key: str) -> str:
    """Categorize a missing key by its pattern."""
    if key.endswith('_details'):
        return 'Type A: issues.{key}_details (should be details.{key})'
    elif key.endswith('_recommendation'):
        return 'Type B: issues.{key}_recommendation (should be recommendations.{key})'
    elif key.startswith('tables.'):
        return 'Type C: Table headers'
    elif 'status_' in key or '_label' in key or key.endswith('_items') or key.endswith('none'):
        return 'Type D: Status/dynamic labels'
    elif 'table_title' in key:
        return 'Type D: Table title'
    elif 'problem_' in key:
        return 'Type D: Problem descriptions'
    else:
        return 'Type E: Other'


def main():
    """Main function to find and report missing translations."""
    # Base paths
    base_path = Path(__file__).parent.parent
    analyzers_path = base_path / 'app' / 'analyzers'
    locales_path = base_path / 'app' / 'locales'

    # Load translation keys from all locale files
    uk_keys = load_translation_keys(locales_path / 'uk.json')
    en_keys = load_translation_keys(locales_path / 'en.json')
    ru_keys = load_translation_keys(locales_path / 'ru.json')

    print(f"Loaded translation keys:")
    print(f"  Ukrainian (uk): {len(uk_keys)} keys")
    print(f"  English (en):   {len(en_keys)} keys")
    print(f"  Russian (ru):   {len(ru_keys)} keys")
    print()

    # Find all analyzer files
    analyzer_files = list(analyzers_path.glob('*.py'))
    analyzer_files = [f for f in analyzer_files if f.name != '__init__.py' and f.name != 'base.py']

    print(f"Found {len(analyzer_files)} analyzer files")
    print()

    # Extract keys used in each analyzer
    all_used_keys = set()
    analyzer_keys = {}

    for analyzer_file in analyzer_files:
        keys = extract_translation_keys_from_file(analyzer_file)
        analyzer_name = analyzer_file.stem
        analyzer_keys[analyzer_name] = keys
        all_used_keys.update(keys)

    print(f"Total unique translation keys used in analyzers: {len(all_used_keys)}")
    print()

    # Find missing keys for each language
    missing_in_uk = all_used_keys - uk_keys
    missing_in_en = all_used_keys - en_keys
    missing_in_ru = all_used_keys - ru_keys

    # Find keys that exist in UK but not in EN/RU
    uk_only_missing_en = uk_keys - en_keys
    uk_only_missing_ru = uk_keys - ru_keys

    print("=" * 80)
    print("MISSING TRANSLATION KEYS SUMMARY")
    print("=" * 80)
    print()

    print(f"Keys used in code but MISSING from translation files:")
    print(f"  Ukrainian (uk): {len(missing_in_uk)} keys")
    print(f"  English (en):   {len(missing_in_en)} keys")
    print(f"  Russian (ru):   {len(missing_in_ru)} keys")
    print()

    print(f"Keys in UK.json but MISSING from other languages:")
    print(f"  Missing in EN:  {len(uk_only_missing_en)} keys")
    print(f"  Missing in RU:  {len(uk_only_missing_ru)} keys")
    print()

    # Total missing keys to add
    total_to_add_uk = len(missing_in_uk)
    total_to_add_en = len(missing_in_en) + len(uk_only_missing_en)
    total_to_add_ru = len(missing_in_ru) + len(uk_only_missing_ru)

    print(f"TOTAL KEYS TO ADD:")
    print(f"  Ukrainian:  {total_to_add_uk} keys")
    print(f"  English:    {total_to_add_en} keys ({len(missing_in_en)} used + {len(uk_only_missing_en)} from UK)")
    print(f"  Russian:    {total_to_add_ru} keys ({len(missing_in_ru)} used + {len(uk_only_missing_ru)} from UK)")
    print()

    # Analyze by analyzer
    print("=" * 80)
    print("MISSING KEYS BY ANALYZER (sorted by count)")
    print("=" * 80)
    print()

    analyzer_missing = {}
    for analyzer_name, keys in analyzer_keys.items():
        missing = keys - uk_keys
        if missing:
            analyzer_missing[analyzer_name] = missing

    # Sort by number of missing keys
    sorted_analyzers = sorted(analyzer_missing.items(), key=lambda x: len(x[1]), reverse=True)

    for analyzer_name, missing_keys in sorted_analyzers:
        print(f"{analyzer_name}: {len(missing_keys)} missing keys")

        # Categorize missing keys
        categories = defaultdict(list)
        for key in sorted(missing_keys):
            category = categorize_missing_key(key)
            categories[category].append(key)

        for category, keys in sorted(categories.items()):
            print(f"  {category}:")
            for key in keys:
                print(f"    - {key}")
        print()

    # List working analyzers (no missing keys)
    working_analyzers = []
    for analyzer_name, keys in analyzer_keys.items():
        missing = keys - uk_keys
        if not missing:
            working_analyzers.append(analyzer_name)

    if working_analyzers:
        print("=" * 80)
        print(f"WORKING ANALYZERS (no missing keys): {len(working_analyzers)}")
        print("=" * 80)
        for name in sorted(working_analyzers):
            print(f"  ✓ {name}")
        print()

    # Categorize all missing keys globally
    print("=" * 80)
    print("MISSING KEYS BY CATEGORY")
    print("=" * 80)
    print()

    all_missing = missing_in_uk | missing_in_en | missing_in_ru
    global_categories = defaultdict(list)

    for key in sorted(all_missing):
        category = categorize_missing_key(key)
        global_categories[category].append(key)

    for category, keys in sorted(global_categories.items()):
        print(f"{category}: {len(keys)} keys")
        for key in keys[:5]:  # Show first 5 examples
            print(f"  - {key}")
        if len(keys) > 5:
            print(f"  ... and {len(keys) - 5} more")
        print()

    # Show UK-only keys that need to be added to EN/RU
    if uk_only_missing_en or uk_only_missing_ru:
        print("=" * 80)
        print("UK-ONLY KEYS (exist in uk.json but missing in en/ru)")
        print("=" * 80)
        print()

        uk_only_keys = uk_only_missing_en | uk_only_missing_ru
        print(f"Total: {len(uk_only_keys)} keys")
        print()
        print("First 20 examples:")
        for key in sorted(uk_only_keys)[:20]:
            in_en = "✓" if key in en_keys else "✗"
            in_ru = "✓" if key in ru_keys else "✗"
            print(f"  {key} [EN: {in_en}, RU: {in_ru}]")
        if len(uk_only_keys) > 20:
            print(f"  ... and {len(uk_only_keys) - 20} more")
        print()

    # Generate detailed report for implementation
    print("=" * 80)
    print("IMPLEMENTATION CHECKLIST")
    print("=" * 80)
    print()

    for analyzer_name, missing_keys in sorted_analyzers:
        print(f"[ ] {analyzer_name} ({len(missing_keys)} keys)")
    print()

    print("=" * 80)
    print("REPORT COMPLETE")
    print("=" * 80)
    print()
    print(f"Next steps:")
    print(f"1. Add {total_to_add_uk} keys to app/locales/uk.json")
    print(f"2. Add {total_to_add_en} keys to app/locales/en.json")
    print(f"3. Add {total_to_add_ru} keys to app/locales/ru.json")
    print(f"4. Validate JSON syntax")
    print(f"5. Run this script again to verify 0 missing keys")
    print()


if __name__ == '__main__':
    main()
