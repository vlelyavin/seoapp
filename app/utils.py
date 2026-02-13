"""Shared utility functions."""

from urllib.parse import urlparse


def extract_domain(url: str) -> str:
    """Extract domain from URL, stripping 'www.' prefix."""
    return urlparse(url).netloc.replace("www.", "")
