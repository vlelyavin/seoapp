"""Application configuration settings."""

from typing import Optional
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""


    # API Keys
    PAGESPEED_API_KEY: Optional[str] = None

    # Crawling Limits
    MAX_PAGES: int = 100
    PAGE_TIMEOUT: int = 10  # seconds per page
    TOTAL_TIMEOUT: int = 600  # 10 minutes total
    MAX_EXTERNAL_LINKS: int = 500
    PARALLEL_REQUESTS: int = 5

    # Performance Optimizations
    ENABLE_PARALLEL_ANALYZERS: bool = True

    # Context Rotation (Phase 3)
    # DISABLED: Race condition causes contexts to close while pages are using them
    # Symptoms: Pages fail silently (status_code=0), BFS queue empties prematurely
    # Root cause: context.close() in _rotate_context() kills in-flight pages
    # TODO: Implement reference counting before re-enabling
    ENABLE_CONTEXT_ROTATION: bool = False
    CONTEXT_POOL_SIZE: int = 3  # Number of browser contexts in pool
    PAGES_PER_CONTEXT_ROTATION: int = 25  # Recycle context after N pages

    # Connection Pool Limits (Phase 3)
    AIOHTTP_CONNECTION_LIMIT: int = 50
    AIOHTTP_LIMIT_PER_HOST: int = 10

    # Resource Monitoring (Phase 3)
    ENABLE_RESOURCE_MONITORING: bool = False  # Optional, requires psutil
    MEMORY_WARNING_THRESHOLD_MB: int = 1500
    LOG_RESOURCE_METRICS: bool = True

    # Paths
    REPORTS_DIR: str = "./reports"
    SCREENSHOTS_DIR: str = "./screenshots"

    # Image Thresholds (in bytes)
    IMAGE_WARNING_SIZE: int = 400 * 1024  # 400 KB
    IMAGE_CRITICAL_SIZE: int = 1024 * 1024  # 1 MB

    # Content Thresholds
    MIN_CONTENT_WORDS: int = 300

    # Title/Description optimal lengths
    TITLE_MIN_LENGTH: int = 50
    TITLE_MAX_LENGTH: int = 60
    DESCRIPTION_MIN_LENGTH: int = 150
    DESCRIPTION_MAX_LENGTH: int = 160

    # Structure limits
    MAX_CLICK_DEPTH: int = 3

    # Localization
    LANGUAGE: str = "en"  # Supported: uk, ru, en

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def ensure_dirs(self) -> None:
        """Create necessary directories if they don't exist."""
        Path(self.REPORTS_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.SCREENSHOTS_DIR).mkdir(parents=True, exist_ok=True)


settings = Settings()
