"""One-pass extraction of every soup-derived signal analyzers need.

Called by the crawler right after parsing a page. The PageData fields it
fills are designed so that the soup and html_content can be dropped
immediately — analyzers then operate on these small structured payloads
instead of holding 3-5 MB lxml soup objects per crawled page.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, List, Tuple
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from . import minhash
from .models import PageData


_WHITESPACE_RE = re.compile(r"\s+")

_SECTION_EXCLUDED_TAGS = frozenset({"script", "style", "noscript", "header", "footer", "nav", "aside"})
_SECTION_BOILERPLATE_RE = re.compile(
    r"(menu|nav|header|footer|sidebar|cookie|banner|popup|modal|subscribe|breadcrumbs?)",
    re.IGNORECASE,
)

# CMS detection signature strings (kept here so extraction can pre-match
# and the analyzer can stay soup-free). Mirrors the structure in CMSAnalyzer.
_CMS_HTML_SIGNATURES: List[Tuple[str, str]] = [
    # (signature_key, regex pattern)
    ("WordPress", r"/wp-content/"),
    ("WordPress", r"/wp-includes/"),
    ("WordPress", r"wp-json"),
    ("WordPress", r'class="wp-'),
    ("Shopify", r"cdn\.shopify\.com"),
    ("Shopify", r"Shopify\.theme"),
    ("Shopify", r"Shopify\.shop"),
    ("Shopify", r"/collections/"),
    ("Shopify", r"shopify-section"),
    ("Joomla", r"/media/jui/"),
    ("Joomla", r"/media/system/"),
    ("Joomla", r"com_content"),
    ("Joomla", r"Joomla!"),
    ("Drupal", r"Drupal\.settings"),
    ("Drupal", r"/sites/default/files/"),
    ("Drupal", r"/sites/all/"),
    ("Drupal", r"data-drupal-"),
    ("Tilda", r"tilda\.ws"),
    ("Tilda", r"tildacdn\.com"),
    ("Tilda", r"t-records"),
    ("Tilda", r"t-container"),
    ("Tilda", r"t-cover__"),
    ("1C-Bitrix", r"/bitrix/"),
    ("1C-Bitrix", r"BX\."),
    ("1C-Bitrix", r"bxSession"),
    ("1C-Bitrix", r"bitrix/js/"),
    ("1C-Bitrix", r"bitrix/templates/"),
    ("OpenCart", r"catalog/view/theme"),
    ("OpenCart", r"route=common/"),
    ("OpenCart", r"route=product/"),
    ("OpenCart", r"index\.php\?route="),
    ("PrestaShop", r"/modules/ps_"),
    ("PrestaShop", r"prestashop"),
    ("PrestaShop", r"/themes/classic/"),
    ("PrestaShop", r"id_product"),
    ("Wix", r"wix\.com"),
    ("Wix", r"wixstatic\.com"),
    ("Wix", r"wixsite\.com"),
    ("Wix", r"_wix_browser_sess"),
    ("Squarespace", r"squarespace\.com"),
    ("Squarespace", r"static\.squarespace"),
    ("Squarespace", r"sqsp"),
    ("Magento", r"Mage\.Cookies"),
    ("Magento", r"/skin/frontend/"),
    ("Magento", r"/static/frontend/"),
    ("Magento", r"mage/cookies"),
    ("MODX", r"modx"),
    ("MODX", r"/assets/components/"),
    ("Webflow", r"webflow\.com"),
    ("Webflow", r"w-webflow"),
    ("Webflow", r"wf-page"),
    ("Next.js", r"_next/static"),
    ("Next.js", r"__NEXT_DATA__"),
    ("Next.js", r"/_next/"),
    ("Nuxt.js", r"_nuxt"),
    ("Nuxt.js", r"__NUXT__"),
    ("Nuxt.js", r"nuxt"),
]

# Compile once at import time.
_CMS_PATTERNS = [(key, re.compile(pat, re.IGNORECASE)) for key, pat in _CMS_HTML_SIGNATURES]


_MIXED_RESOURCE_PATTERN = re.compile(
    r'<(?:img|script|iframe|source|video|audio|embed|object)\s[^>]*src\s*=\s*["\']http://[^"\']+["\']',
    re.IGNORECASE,
)
_MIXED_STYLESHEET_PATTERN = re.compile(
    r'<link\s[^>]*rel\s*=\s*["\']stylesheet["\'][^>]*href\s*=\s*["\']http://[^"\']+["\']',
    re.IGNORECASE,
)
_MIXED_STYLESHEET_ALT_PATTERN = re.compile(
    r'<link\s[^>]*href\s*=\s*["\']http://[^"\']+["\'][^>]*rel\s*=\s*["\']stylesheet["\']',
    re.IGNORECASE,
)


_SECTION_DATE_PATTERNS = [
    re.compile(r"\d{1,2}[./]\d{1,2}[./]\d{2,4}"),
    re.compile(r"\d{4}-\d{2}-\d{2}"),
    re.compile(r"(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)", re.IGNORECASE),
    re.compile(r"(january|february|march|april|may|june|july|august|september|october|november|december)", re.IGNORECASE),
]
_SECTION_CATEGORY_RE = re.compile(r"(categor|катего|рубрик)", re.IGNORECASE)
_SECTION_TAG_RE = re.compile(r"(tag|тег|мітк)", re.IGNORECASE)
_SECTION_AUTHOR_RE = re.compile(r"(author|автор)", re.IGNORECASE)


def _is_boilerplate_node(node) -> bool:
    attrs: List[str] = []
    node_id = node.get("id") if hasattr(node, "get") else None
    if node_id:
        attrs.append(str(node_id))
    node_classes = node.get("class") if hasattr(node, "get") else None
    if node_classes:
        if isinstance(node_classes, str):
            attrs.append(node_classes)
        else:
            attrs.extend(str(c) for c in node_classes)
    if not attrs:
        return False
    return bool(_SECTION_BOILERPLATE_RE.search(" ".join(attrs)))


def _select_content_root(soup: BeautifulSoup) -> Tuple[object, str]:
    main = soup.find("main")
    if main and main.get_text(" ", strip=True):
        return main, "main"
    article = soup.find("article")
    if article and article.get_text(" ", strip=True):
        return article, "article"
    return (soup.body or soup), "fallback"


def _should_skip_text_node(root, parent) -> bool:
    ancestor = parent
    while ancestor is not None:
        name = getattr(ancestor, "name", None)
        if name in _SECTION_EXCLUDED_TAGS:
            return True
        if hasattr(ancestor, "attrs") and _is_boilerplate_node(ancestor):
            return True
        if ancestor == root:
            break
        ancestor = getattr(ancestor, "parent", None)
    return False


def _extract_main_content(soup: BeautifulSoup) -> Tuple[str, str]:
    """Return (normalized_text, mode) — same algorithm as DuplicatesAnalyzer."""
    root, mode = _select_content_root(soup)
    texts: List[str] = []
    for element in root.find_all(string=True):
        parent = element.parent
        if parent is None or _should_skip_text_node(root, parent):
            continue
        stripped = element.strip()
        if stripped:
            texts.append(stripped)
    text = _WHITESPACE_RE.sub(" ", " ".join(texts)).strip().lower()
    return text, mode


def _collect_jsonld_types(data: Any, sink: List[str]) -> None:
    """Recursively walk a parsed JSON-LD document and collect @type values."""
    if isinstance(data, dict):
        graph = data.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                _collect_jsonld_types(item, sink)
        schema_type = data.get("@type")
        if isinstance(schema_type, list):
            sink.extend(t for t in schema_type if isinstance(t, str))
        elif isinstance(schema_type, str):
            sink.append(schema_type)
    elif isinstance(data, list):
        for item in data:
            _collect_jsonld_types(item, sink)


def _extract_meta_dict(soup: BeautifulSoup, attr: str, prefix: str) -> dict:
    """Collect meta[attr] values whose attr starts with prefix. Key is the suffix."""
    result: dict = {}
    for meta in soup.find_all("meta"):
        key = meta.get(attr)
        if not key:
            continue
        key_lower = key.strip().lower()
        if not key_lower.startswith(prefix):
            continue
        content = (meta.get("content") or "").strip()
        if not content:
            continue
        suffix = key_lower[len(prefix):]
        if suffix and suffix not in result:
            result[suffix] = content
    return result


def extract_analyzer_fields(soup: BeautifulSoup, page: PageData, base_url: str) -> None:
    """Populate every soup-derived field on `page`.

    After this call the caller can safely drop both the soup and html_content
    without breaking any analyzer.
    """
    # Open Graph + Twitter metas — used by social_tags analyzer.
    page.og_tags = _extract_meta_dict(soup, "property", "og:")
    page.twitter_tags = _extract_meta_dict(soup, "name", "twitter:")

    # JSON-LD: parse once at extraction time and keep only the @type values.
    # Raw scripts can be hundreds of KB on news sites (CNN article + organization
    # + newsArticle + breadcrumbs + …) — analyzers only ever look at @type.
    types: List[str] = []
    parse_errors = 0
    for script in soup.find_all("script", type="application/ld+json"):
        content = script.string
        if not content or not content.strip():
            continue
        try:
            data = json.loads(content)
        except (json.JSONDecodeError, ValueError):
            parse_errors += 1
            continue
        _collect_jsonld_types(data, types)
    page.json_ld_types = types
    page.json_ld_parse_errors = parse_errors

    itemtypes: List[str] = []
    for el in soup.find_all(attrs={"itemscope": True}):
        itemtype = el.get("itemtype")
        if itemtype:
            itemtypes.append(itemtype)
    page.microdata_itemtypes = itemtypes

    # Hreflang links — used by hreflang analyzer.
    hreflangs: List[dict] = []
    for link in soup.find_all("link", rel="alternate"):
        lang = link.get("hreflang")
        href = link.get("href")
        if lang and href:
            hreflangs.append({"lang": lang.strip().lower(), "href": href.strip()})
    page.hreflang_links = hreflangs

    # Viewport meta — used by mobile analyzer.
    viewport_meta = soup.find("meta", attrs={"name": lambda v: bool(v) and v.lower() == "viewport"})
    if viewport_meta:
        content = viewport_meta.get("content")
        page.viewport_content = content.strip() if content else None

    # Favicon/apple-touch-icon links — used by favicon analyzer (homepage only,
    # but extracting on every page is trivial).
    favicons: List[dict] = []
    for link in soup.find_all("link", rel=True):
        rel = link.get("rel")
        if isinstance(rel, str):
            rel_values = [rel]
        else:
            rel_values = list(rel or [])
        href = link.get("href")
        if not href:
            continue
        href_abs = href if href.startswith(("http://", "https://")) else urljoin(base_url, href)
        for kind in ("icon", "shortcut", "apple-touch-icon"):
            if kind in rel_values:
                favicons.append({
                    "rel_kind": "apple-touch-icon" if kind == "apple-touch-icon" else "icon",
                    "href": href_abs,
                    "sizes": link.get("sizes", "") or "",
                    "type": link.get("type", "") or "",
                })
                break
    page.favicon_links = favicons

    # Meta generator — used by cms analyzer.
    generator_meta = soup.find("meta", attrs={"name": lambda v: bool(v) and v.lower() == "generator"})
    if generator_meta:
        gc = generator_meta.get("content")
        page.meta_generator = gc.strip() if gc else None

    # Pre-match CMS html signature strings so the analyzer doesn't need html.
    html_content = page.html_content or ""
    if html_content:
        matched: List[str] = []
        for key, pattern in _CMS_PATTERNS:
            if pattern.search(html_content):
                matched.append(pattern.pattern)
        page.cms_html_signals = matched

        # Mixed-content signal — only meaningful on https pages.
        if page.url.startswith("https://"):
            if (
                _MIXED_RESOURCE_PATTERN.search(html_content)
                or _MIXED_STYLESHEET_PATTERN.search(html_content)
                or _MIXED_STYLESHEET_ALT_PATTERN.search(html_content)
            ):
                page.has_mixed_http_resource = True

        # Section signals — used by content_sections analyzer.
        lower_html = html_content.lower()
        section_signals = {
            "has_details_tag": "<details" in lower_html,
            "has_summary_tag": "<summary" in lower_html,
            "has_faq_schema_marker": (
                "faqpage" in lower_html or '"@type":"faq' in lower_html.replace(" ", "")
            ),
            "has_dates_pattern": any(p.search(lower_html) for p in _SECTION_DATE_PATTERNS),
            "has_categories_pattern": bool(_SECTION_CATEGORY_RE.search(lower_html)),
            "has_tags_pattern": bool(_SECTION_TAG_RE.search(lower_html)),
            "has_author_pattern": bool(_SECTION_AUTHOR_RE.search(lower_html)),
        }
        page.section_signals = section_signals

    # Main-content fingerprints for the duplicates analyzer. The raw text isn't
    # retained — we keep the MinHash signature (50 ints) for near-duplicate
    # detection plus a sha256 prefix for exact-match. On a CNN article this
    # collapses ~30 KB of text into ~0.5 KB of stable hashes.
    try:
        text, mode = _extract_main_content(soup)
    except Exception:
        text, mode = "", "fallback"
    if text:
        page.main_content_mode = mode
        page.main_content_word_count = len(text.split())
        page.main_content_minhash = minhash.signature(text)
        page.main_content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
