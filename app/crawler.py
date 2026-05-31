"""Web crawler for SEO audit using httpx for lightweight HTTP fetching."""

import asyncio
import logging
import re
import time
from collections import deque
from typing import AsyncGenerator, Callable, Dict, Optional, Set
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

import aiohttp
import httpx
from bs4 import BeautifulSoup

from .config import settings
from .models import ImageData, LinkData, PageData
from .page_extraction import extract_analyzer_fields

logger = logging.getLogger(__name__)

# Precompiled regex patterns for performance
WORD_PATTERN = re.compile(r'\b\w+\b', re.UNICODE)
WHITESPACE_PATTERN = re.compile(r'\s+', re.UNICODE)

# Tracking / analytics query parameters to strip during URL normalization
_TRACKING_PARAMS = re.compile(
    r'^(utm_|fbclid$|gclid$|msclkid$|mc_|yclid$|_ga$|_gl$|__hs)',
    re.IGNORECASE,
)

# Response headers we actually consume (security analyzer + content-type sniff).
# Keeping only these turns a CDN-style 30-50 header dict into a 5-7 entry dict;
# multiplied by 1000 pages on cnn.com that's tens of MB saved.
_HEADER_ALLOWLIST = frozenset({
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'content-security-policy',
    'server',
    'content-type',
    'cache-control',
})

# JS-redirect detection. CNN's edition.cnn.com/terms is a tiny stub whose only
# job is `window.location.replace('/terms0')`; with no JS runtime in the
# crawler, we'd otherwise report it as "missing title / no headings / empty
# body". Catching the redirect lets us enqueue the real page instead.
_JS_REDIRECT_PATTERNS = [
    re.compile(r'window\.location\.replace\s*\(\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    re.compile(r'window\.location\.assign\s*\(\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    re.compile(r'window\.location\.href\s*=\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    re.compile(r'window\.location\s*=\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    re.compile(r'location\.replace\s*\(\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    re.compile(r'location\.href\s*=\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    re.compile(r'document\.location(?:\.href)?\s*=\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
]
_META_REFRESH_URL = re.compile(r'url\s*=\s*[\'"]?([^\'";\s]+)', re.IGNORECASE)
# Fallback for stubs that hide the URL behind a variable (e.g. cnn.com/terms:
# `const fallback = '/terms0'; window.location.replace(redirect || fallback)`).
# When a location call exists but no string literal sits inline with it, pick
# the first URL-shaped quoted string anywhere in the same script.
_LOCATION_CALL_RE = re.compile(
    r'(?:window\.|document\.)?location(?:\.(?:replace|assign|href))?\s*[=(]',
    re.IGNORECASE,
)
_URL_LITERAL_RE = re.compile(r'''[\'"](/[^\s\'"\\]+|https?://[^\s\'"\\]+)[\'"]''')


def _detect_redirect_stub(soup, html: str) -> Optional[str]:
    """Return the redirect target URL if the page is a JS/meta-refresh stub.

    A stub has near-empty body content AND either a meta-refresh directive or
    a window.location.* JavaScript assignment. Real pages always have visible
    text far past the 64-char threshold here.
    """
    body = soup.find('body')
    if body and len(body.get_text(strip=True)) > 64:
        return None

    meta_refresh = soup.find(
        'meta',
        attrs={'http-equiv': lambda v: isinstance(v, str) and v.lower() == 'refresh'},
    )
    if meta_refresh:
        content = (meta_refresh.get('content', '') or '').strip()
        m = _META_REFRESH_URL.search(content)
        if m:
            target = m.group(1).strip("'\"")
            if target:
                return target

    for script in soup.find_all('script'):
        script_text = script.string or ''
        if not script_text:
            continue
        for pattern in _JS_REDIRECT_PATTERNS:
            m = pattern.search(script_text)
            if m:
                target = m.group(1)
                if target.startswith(('http://', 'https://', '/')):
                    return target
        # Variable-indirect form: location call exists, but the URL is held
        # in a const/let elsewhere. Grab the first URL-shaped literal.
        if _LOCATION_CALL_RE.search(script_text):
            url_m = _URL_LITERAL_RE.search(script_text)
            if url_m:
                return url_m.group(1)

    return None


class WebCrawler:
    """Async BFS web crawler with httpx for lightweight HTTP fetching."""

    def __init__(
        self,
        start_url: str,
        max_pages: int = None,
        timeout: int = None,
        parallel_requests: int = None,
        progress_callback: Optional[Callable] = None,
    ):
        self.start_url = self._normalize_url(start_url)
        parsed = urlparse(self.start_url)
        self.base_domain = parsed.netloc
        self.base_scheme = parsed.scheme

        self.max_pages = max_pages or settings.MAX_PAGES
        self.timeout = timeout or settings.PAGE_TIMEOUT  # seconds
        self.parallel_requests = parallel_requests or settings.PARALLEL_REQUESTS
        self.progress_callback = progress_callback

        self.visited: Set[str] = set()
        self.queue: deque = deque()
        self.pages: Dict[str, PageData] = {}
        self.semaphore = asyncio.Semaphore(self.parallel_requests)
        # Hold strong refs to fire-and-forget progress tasks so they aren't
        # garbage-collected mid-flight, and so their exceptions get logged.
        self._progress_tasks: Set[asyncio.Task] = set()

    def _on_progress_done(self, task: asyncio.Task) -> None:
        self._progress_tasks.discard(task)
        if not task.cancelled():
            exc = task.exception()
            if exc is not None:
                logger.warning(f"Progress callback failed: {exc}")

    def _normalize_url(self, url: str) -> str:
        """Normalize URL for deduplication."""
        parsed = urlparse(url)

        # Remove trailing slash from path (except for root)
        path = parsed.path.rstrip('/') if parsed.path != '/' else '/'

        # Strip known tracking/analytics query parameters
        query = parsed.query
        if query:
            cleaned = {
                k: v for k, v in parse_qs(query, keep_blank_values=True).items()
                if not _TRACKING_PARAMS.match(k)
            }
            query = urlencode(cleaned, doseq=True) if cleaned else ''

        # Remove fragments and default ports
        normalized = urlunparse((
            parsed.scheme,
            parsed.netloc.lower(),
            path,
            '',  # params
            query,
            ''   # fragment
        ))

        return normalized

    def _is_valid_url(self, url: str) -> bool:
        """Check if URL should be crawled."""
        try:
            parsed = urlparse(url)

            # Must be http(s)
            if parsed.scheme not in ('http', 'https'):
                return False

            # Must be same domain
            if parsed.netloc.lower() != self.base_domain.lower():
                return False

            # Skip common non-page resources
            skip_extensions = (
                '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                '.zip', '.rar', '.tar', '.gz', '.7z',
                '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
                '.mp3', '.mp4', '.avi', '.mov', '.wmv',
                '.css', '.js', '.json', '.xml',
            )
            path_lower = parsed.path.lower()
            if any(path_lower.endswith(ext) for ext in skip_extensions):
                return False

            return True
        except Exception:
            return False

    def _is_internal_link(self, url: str) -> bool:
        """Check if URL is internal (same domain)."""
        try:
            parsed = urlparse(url)
            if not parsed.netloc:
                return True
            return parsed.netloc.lower() == self.base_domain.lower()
        except Exception:
            return False

    def _extract_text_content(self, soup: BeautifulSoup) -> str:
        """Extract visible text content from page (non-destructive)."""
        EXCLUDED_TAGS = {'script', 'style', 'noscript', 'header', 'footer', 'nav'}
        texts = []
        for element in soup.find_all(string=True):
            if element.parent.name not in EXCLUDED_TAGS:
                stripped = element.strip()
                if stripped:
                    texts.append(stripped)
        return WHITESPACE_PATTERN.sub(' ', ' '.join(texts))

    def _count_words(self, text: str) -> int:
        """Count words in text."""
        words = WORD_PATTERN.findall(text)
        return len(words)

    def _extract_images(self, soup: BeautifulSoup, base_url: str) -> list[ImageData]:
        """Extract image data from page."""
        images = []

        for img in soup.find_all('img'):
            src = img.get('src', '')
            if not src:
                continue

            # Make absolute URL
            if not src.startswith(('http://', 'https://', '//')):
                src = urljoin(base_url, src)
            elif src.startswith('//'):
                src = f"{self.base_scheme}:{src}"

            # Determine format from extension
            format_ext = None
            path_lower = urlparse(src).path.lower()
            for ext in ['.webp', '.avif', '.png', '.jpg', '.jpeg', '.gif', '.svg']:
                if path_lower.endswith(ext):
                    format_ext = ext.lstrip('.')
                    break

            images.append(ImageData(
                src=src,
                alt=img.get('alt'),
                format=format_ext,
                width=int(img.get('width')) if img.get('width', '').isdigit() else None,
                height=int(img.get('height')) if img.get('height', '').isdigit() else None,
            ))

        return images

    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> tuple[list[str], list[LinkData]]:
        """Extract and categorize links."""
        internal_links = []
        external_links = []
        seen_internal = set()
        seen_external = set()

        for a in soup.find_all('a', href=True):
            href = a.get('href', '').strip()

            # Skip empty, javascript, and mailto links
            if not href or href.startswith(('javascript:', 'mailto:', 'tel:', '#')):
                continue

            # Make absolute URL
            if not href.startswith(('http://', 'https://')):
                href = urljoin(base_url, href)

            normalized = self._normalize_url(href)

            # Check for nofollow
            rel = a.get('rel', [])
            if isinstance(rel, str):
                rel = rel.split()
            has_nofollow = 'nofollow' in rel

            link_text = a.get_text(strip=True)[:100] if a.get_text(strip=True) else None

            if self._is_internal_link(href):
                if normalized not in seen_internal:
                    internal_links.append(normalized)
                    seen_internal.add(normalized)
            else:
                if normalized not in seen_external:
                    external_links.append(LinkData(
                        href=normalized,
                        text=link_text,
                        is_internal=False,
                        has_nofollow=has_nofollow,
                    ))
                    seen_external.add(normalized)

        return internal_links, external_links

    async def _fetch_page(self, client: httpx.AsyncClient, url: str, depth: int) -> Optional[PageData]:
        """Fetch and parse a single page using httpx."""
        async with self.semaphore:
            start_time = time.time()

            try:
                response = await client.get(
                    url,
                    follow_redirects=True,
                    timeout=float(self.timeout),
                )

                # Retry on 429
                if response.status_code == 429:
                    retry_after = min(int(response.headers.get('retry-after', '5')), 30)
                    logger.info(f"429 for {url}, retrying after {retry_after}s")
                    await asyncio.sleep(retry_after)
                    start_time = time.time()
                    response = await client.get(url, follow_redirects=True, timeout=float(self.timeout))

                load_time = time.time() - start_time

                # Check content type
                content_type = response.headers.get('content-type', '')
                ct_lower = content_type.lower()
                if 'text/html' not in ct_lower and 'application/xhtml+xml' not in ct_lower:
                    return None

                html = response.text

                # Build redirect chain from response.history
                redirect_chain = []
                if response.history:
                    redirect_chain = [str(r.url) for r in response.history] + [str(response.url)]
                final_url = str(response.url)

                # Trim response headers to the SEO/security set we actually use.
                response_headers = {
                    k: v for k, v in response.headers.items()
                    if k.lower() in _HEADER_ALLOWLIST
                }

                soup = BeautifulSoup(html, 'lxml')

                # JS/meta-refresh redirect stub — enqueue the real target and
                # drop the stub so analyzers don't flag a phantom "missing title".
                redirect_target = _detect_redirect_stub(soup, html)
                if redirect_target:
                    target_abs = (
                        redirect_target
                        if redirect_target.startswith(('http://', 'https://'))
                        else urljoin(url, redirect_target)
                    )
                    target_norm = self._normalize_url(target_abs)
                    if (
                        self._is_valid_url(target_norm)
                        and target_norm not in self.visited
                    ):
                        self.visited.add(target_norm)
                        self.queue.append((target_norm, depth))
                    logger.info(f"Redirect stub at {url} → {target_abs}")
                    return None

                # Extract title
                title_tag = soup.find('title')
                title = title_tag.get_text(strip=True) if title_tag else None

                # Extract meta description
                meta_desc = soup.find('meta', attrs={'name': re.compile(r'^description$', re.I)})
                meta_description = meta_desc.get('content', '').strip() if meta_desc else None

                # Extract meta robots
                meta_robots_tag = soup.find('meta', attrs={'name': re.compile(r'^robots$', re.I)})
                meta_robots = meta_robots_tag.get('content', '').strip() if meta_robots_tag else None
                has_noindex = meta_robots and 'noindex' in meta_robots.lower() if meta_robots else False

                # Extract canonical
                canonical_tag = soup.find('link', attrs={'rel': 'canonical'})
                canonical = canonical_tag.get('href') if canonical_tag else None

                # Extract headings
                h1_tags = [h.get_text(strip=True) for h in soup.find_all('h1') if h.get_text(strip=True)]
                h2_tags = [h.get_text(strip=True) for h in soup.find_all('h2') if h.get_text(strip=True)]
                h3_tags = [h.get_text(strip=True) for h in soup.find_all('h3') if h.get_text(strip=True)]
                h4_tags = [h.get_text(strip=True) for h in soup.find_all('h4') if h.get_text(strip=True)]
                h5_tags = [h.get_text(strip=True) for h in soup.find_all('h5') if h.get_text(strip=True)]
                h6_tags = [h.get_text(strip=True) for h in soup.find_all('h6') if h.get_text(strip=True)]

                # Extract text content and count words (non-destructive, reuses same soup)
                text_content = self._extract_text_content(soup)
                word_count = self._count_words(text_content)

                # Extract images
                images = self._extract_images(soup, url)

                # Extract links
                internal_links, external_links = self._extract_links(soup, url)

                page_data = PageData(
                    url=url,
                    status_code=response.status_code,
                    title=title,
                    meta_description=meta_description,
                    meta_robots=meta_robots,
                    canonical=canonical,
                    h1_tags=h1_tags,
                    h2_tags=h2_tags,
                    h3_tags=h3_tags,
                    h4_tags=h4_tags,
                    h5_tags=h5_tags,
                    h6_tags=h6_tags,
                    word_count=word_count,
                    images=images,
                    internal_links=internal_links,
                    external_links=external_links,
                    depth=depth,
                    load_time=load_time,
                    html_content=html,
                    has_noindex=has_noindex,
                    response_headers=response_headers,
                    redirect_chain=redirect_chain,
                    final_url=final_url,
                )

                # Pre-extract every soup-derived field analyzers might need,
                # then drop the soup + html_content so per-page steady-state
                # memory stays in the tens of KB instead of multi-MB. The
                # extracted payloads on page_data are what analyzers consume.
                page_data.set_soup(soup)
                try:
                    extract_analyzer_fields(soup, page_data, url)
                finally:
                    page_data.clear_cache()
                    page_data.html_content = None

                return page_data

            except httpx.TimeoutException:
                logger.warning(f"Timeout ({self.timeout}s) for {url}")
                return PageData(url=url, status_code=0, depth=depth)
            except Exception as e:
                logger.error(f"Failed to fetch {url}: {e}")
                return PageData(url=url, status_code=0, depth=depth)

    async def _fetch_page_with_timeout(
        self, client: httpx.AsyncClient, url: str, depth: int
    ) -> Optional[PageData]:
        """Wrap _fetch_page with a hard timeout to prevent hanging."""
        hard_timeout = self.timeout + 5  # httpx timeout + 5s buffer
        try:
            return await asyncio.wait_for(
                self._fetch_page(client, url, depth),
                timeout=hard_timeout,
            )
        except asyncio.TimeoutError:
            logger.warning(f"Hard timeout ({hard_timeout}s) for {url}")
            return PageData(url=url, status_code=0, depth=depth)

    async def crawl(self) -> AsyncGenerator[PageData, None]:
        """
        BFS crawl starting from start_url.
        Yields PageData for each crawled page.
        Uses httpx for lightweight HTTP fetching.
        """
        self.queue.append((self.start_url, 0))  # (url, depth)
        self.visited.add(self.start_url)

        async with httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
            },
            follow_redirects=True,
            timeout=float(self.timeout),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            http2=True,
        ) as client:
            try:
                while self.queue and len(self.pages) < self.max_pages:
                    # Process batch of URLs (cap to remaining page budget)
                    remaining = self.max_pages - len(self.pages)
                    batch_size = min(self.parallel_requests, len(self.queue), remaining)
                    batch = [self.queue.popleft() for _ in range(batch_size)]

                    # Fetch pages concurrently with per-page timeout safety net
                    tasks = [self._fetch_page_with_timeout(client, url, depth) for url, depth in batch]
                    results = await asyncio.gather(*tasks, return_exceptions=True)

                    for result in results:
                        # Skip exceptions and None results
                        if isinstance(result, BaseException):
                            logger.warning(f"Batch task failed: {result}")
                            continue
                        if result is None:
                            continue

                        page = result

                        # Store page data
                        self.pages[page.url] = page

                        # Notify progress (fire-and-forget to avoid blocking crawl)
                        if self.progress_callback:
                            task = asyncio.create_task(self.progress_callback(page))
                            self._progress_tasks.add(task)
                            task.add_done_callback(self._on_progress_done)

                        yield page

                        # Add new internal links to queue
                        # Note: len(self.pages) < self.max_pages is enforced by the while loop
                        if page.status_code == 200:
                            for link in page.internal_links:
                                normalized_link = self._normalize_url(link)
                                if (normalized_link not in self.visited and
                                    self._is_valid_url(normalized_link)):
                                    self.visited.add(normalized_link)
                                    self.queue.append((normalized_link, page.depth + 1))
            finally:
                pass  # httpx client cleanup handled by context manager

    async def crawl_all(self) -> Dict[str, PageData]:
        """Crawl all pages and return complete results."""
        async for _ in self.crawl():
            pass
        return self.pages


async def check_url_status(url: str, timeout: int = 5) -> int:
    """Check HTTP status of a URL without downloading content.

    Uses HEAD first; falls back to GET if HEAD returns 4xx/5xx,
    since some servers block HEAD but respond normally to GET.
    """
    try:
        from .http_client import get_session

        session = await get_session()
        timeout_config = aiohttp.ClientTimeout(total=timeout)

        async with session.head(url, timeout=timeout_config, allow_redirects=True) as response:
            status = response.status
            if status < 400:
                return status

        # HEAD returned an error — retry with GET (some servers reject HEAD)
        async with session.get(url, timeout=timeout_config, allow_redirects=True) as response:
            return response.status
    except asyncio.TimeoutError:
        return 408
    except Exception:
        return 0


async def fetch_url_content(url: str, timeout: int = 10) -> tuple[int, Optional[str]]:
    """Fetch URL content and return status code and content."""
    try:
        from .http_client import get_session

        session = await get_session()
        timeout_config = aiohttp.ClientTimeout(total=timeout)
        headers = {'Accept': '*/*'}

        async with session.get(url, timeout=timeout_config, headers=headers, allow_redirects=True) as response:
            content = await response.text()
            return response.status, content
    except asyncio.TimeoutError:
        return 408, None
    except Exception:
        return 0, None


async def get_image_size(url: str, timeout: int = 10) -> Optional[int]:
    """Get size of an image in bytes."""
    try:
        from .http_client import get_session

        session = await get_session()
        timeout_config = aiohttp.ClientTimeout(total=timeout)

        async with session.head(url, timeout=timeout_config, allow_redirects=True) as response:
            content_length = response.headers.get('content-length')
            if content_length:
                return int(content_length)

        # If HEAD doesn't return size, try GET (cap at 10 MB to avoid OOM)
        max_bytes = 10 * 1024 * 1024
        async with session.get(url, timeout=timeout_config, allow_redirects=True) as response:
            size = 0
            async for chunk in response.content.iter_chunked(64 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    return size  # good enough estimate
            return size
    except Exception:
        return None
