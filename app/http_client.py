"""Shared HTTP client with connection pooling for audit operations."""

import aiohttp
import asyncio
from typing import Optional
import logging

logger = logging.getLogger(__name__)

_session: Optional[aiohttp.ClientSession] = None
_lock = asyncio.Lock()


async def get_session() -> aiohttp.ClientSession:
    """Get or create shared HTTP session with connection pooling."""
    global _session

    if _session is None or _session.closed:
        async with _lock:
            if _session is None or _session.closed:
                connector = aiohttp.TCPConnector(
                    limit=50,
                    limit_per_host=10,
                    ttl_dns_cache=300,
                    force_close=False,
                )

                _session = aiohttp.ClientSession(
                    connector=connector,
                    headers={'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)'},
                    timeout=aiohttp.ClientTimeout(total=30),
                )
                logger.info("HTTP client initialized with connection pooling")

    return _session


async def close_session():
    """Close the shared session."""
    global _session
    if _session and not _session.closed:
        await _session.close()
        logger.info("HTTP client session closed")
