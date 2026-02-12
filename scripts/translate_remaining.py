#!/usr/bin/env python3
"""
Translate remaining Ukrainian text in EN and RU files.
"""

import json
import re
from pathlib import Path


def load_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(file_path, data):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def translate_to_english(text):
    """Translate Ukrainian/Russian mixed text to English."""
    translations = {
        # Full phrases
        'Ймовірність: {percent}%': 'Confidence: {percent}%',
        'Більше одного CMS: {cms_list}': 'Multiple CMS detected: {cms_list}',
        'Можливо: {cms}': 'Probably: {cms}',
        'Дублікати description': 'Duplicate descriptions',
        'Дублікати title': 'Duplicate titles',
        'Відсутні': 'Missing',
        'Є': 'Exists',
        'Відсутній': 'Missing',
        'Присутній': 'Present',
        'Порожньо': 'Empty',
        'Недостатньо контенту': 'Thin Content',
        'Кількість елементів': 'Number of items',
        'Сторінки з noindex': 'Pages with noindex',
        'Немає': 'None',
        'Статус індексації': 'Indexation Status',
        'Файли': 'Files',
        'Заголовки безпеки': 'Security Headers',
        'Проблемні сторінки': 'Problematic Pages',
        'Порожнє значення': 'Empty value',
        'Порожній H1': 'Empty H1',
        'Порушення ієрархії': 'Hierarchy violation',
        'Відсутній H1': 'Missing H1',
        'Декілька H1': 'Multiple H1',
        'Проблеми заголовків': 'Heading Issues',
        'Критичний розмір': 'Critical size',
        'Великий розмір': 'Large size',
        'Проблемні зображення': 'Problematic Images',
        'Favicon відсутній': 'Favicon missing',
        'Відсутній Apple Touch Icon': 'Apple Touch Icon missing',
        'Відсутній .ico файл': '.ico file missing',
        'Застарілий формат': 'Outdated format',
        'Сторінки з недостатнім контентом': 'Pages with thin content',
        'Биті посилання': 'Broken links',
        'Зовнішнє': 'External',
        'Внутрішнє': 'Internal',
        'Дублікат Title': 'Duplicate Title',
        'Title занадто довгий': 'Title too long',
        'Title занадто короткий': 'Title too short',
        'Відсутній Title': 'Missing Title',
        'Відсутній Description': 'Missing Description',
        'Невідомо': 'Unknown',
        'Перевірка не вдалася': 'Check failed',
        'Некоректний': 'Invalid',

        # With placeholders
        'Помилки в robots.txt: {count}': 'Errors in robots.txt: {count}',
        'Виправте синтаксичні помилки в robots.txt.': 'Fix syntax errors in robots.txt.',
        'Переконайтеся, що noindex встановлено навмисно. Видаліть noindex для сторінок, які потрібно індексувати.': 'Make sure noindex is set intentionally. Remove noindex for pages that need to be indexed.',
        'Виправте canonical посилання або видаліть їх, якщо вони вказують на неіснуючі сторінки.': 'Fix canonical links or remove them if they point to non-existent pages.',

        # Favicon
        'Favicon — це маленька іконка, яка відображається в закладках браузера та на вкладках.': 'Favicon is a small icon displayed in browser bookmarks and tabs.',
        'Додайте favicon у форматі PNG або ICO до кореневої директорії сайту.': 'Add a favicon in PNG or ICO format to the root directory of the site.',

        # Tables
        'Проблема': 'Issue',
        'Заголовок': 'Header',
        'Значення': 'Value',
        'URL зображення': 'Image URL',
        'Сторінка': 'Page',
        'Розмір': 'Size',
        'Кількість слів': 'Word count',
        'Довжина': 'Length',
    }

    # Try exact match first
    if text in translations:
        return translations[text]

    # Try partial matches for longer texts
    for uk_text, en_text in translations.items():
        if uk_text in text:
            text = text.replace(uk_text, en_text)

    return text


def translate_to_russian(text):
    """Translate Ukrainian text to Russian."""
    translations = {
        # Full phrases
        'Ймовірність: {percent}%': 'Вероятность: {percent}%',
        'Більше одного CMS: {cms_list}': 'Обнаружено несколько CMS: {cms_list}',
        'Можливо: {cms}': 'Возможно: {cms}',
        'Дублікати description': 'Дубликаты description',
        'Дублікати title': 'Дубликаты title',
        'Відсутні': 'Отсутствуют',
        'Є': 'Есть',
        'Відсутній': 'Отсутствует',
        'Присутній': 'Присутствует',
        'Порожньо': 'Пусто',
        'Недостатньо контенту': 'Мало контента',
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
        'Title занадто короткий': 'Title слишком короткий',
        'Відсутній Title': 'Отсутствует Title',
        'Відсутній Description': 'Отсутствует Description',
        'Невідомо': 'Неизвестно',
        'Перевірка не вдалася': 'Проверка не удалась',
        'Некоректний': 'Некорректный',

        # With placeholders
        'Помилки в robots.txt: {count}': 'Ошибки в robots.txt: {count}',
        'Виправте синтаксичні помилки в robots.txt.': 'Исправьте синтаксические ошибки в robots.txt.',
        'Переконайтеся, що noindex встановлено навмисно. Видаліть noindex для сторінок, які потрібно індексувати.': 'Убедитесь, что noindex установлен намеренно. Удалите noindex для страниц, которые нужно индексировать.',
        'Виправте canonical посилання або видаліть їх, якщо вони вказують на неіснуючі сторінки.': 'Исправьте canonical ссылки или удалите их, если они указывают на несуществующие страницы.',

        # Favicon
        'Favicon — це маленька іконка, яка відображається в закладках браузера та на вкладках.': 'Favicon — это маленькая иконка, отображаемая в закладках браузера и на вкладках.',
        'Додайте favicon у форматі PNG або ICO до кореневої директорії сайту.': 'Добавьте favicon в формате PNG или ICO в корневую директорию сайта.',

        # Tables
        'Проблема': 'Проблема',
        'Заголовок': 'Заголовок',
        'Значення': 'Значение',
        'URL зображення': 'URL изображения',
        'Сторінка': 'Страница',
        'Розмір': 'Размер',
        'Кількість слів': 'Количество слов',
        'Довжина': 'Длина',
    }

    # Try exact match first
    if text in translations:
        return translations[text]

    # Try partial matches
    for uk_text, ru_text in translations.items():
        if uk_text in text:
            text = text.replace(uk_text, ru_text)

    return text


def translate_dict(data, translate_func, path=''):
    """Recursively translate all string values in a dict."""
    if isinstance(data, dict):
        for key, value in data.items():
            new_path = f"{path}.{key}" if path else key
            if isinstance(value, str):
                translated = translate_func(value)
                if translated != value:
                    data[key] = translated
            elif isinstance(value, dict):
                translate_dict(value, translate_func, new_path)
    return data


def main():
    base_path = Path(__file__).parent.parent
    locales_path = base_path / 'app' / 'locales'

    print("Translating remaining Ukrainian text...")
    print()

    # Load and translate English
    en_data = load_json(locales_path / 'en.json')
    translate_dict(en_data, translate_to_english)
    save_json(locales_path / 'en.json', en_data)
    print("[OK] English translations updated")

    # Load and translate Russian
    ru_data = load_json(locales_path / 'ru.json')
    translate_dict(ru_data, translate_to_russian)
    save_json(locales_path / 'ru.json', ru_data)
    print("[OK] Russian translations updated")

    print()
    print("Done! All translations completed.")


if __name__ == '__main__':
    main()
