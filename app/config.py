"""Application configuration settings."""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # API Keys
    PAGESPEED_API_KEY: Optional[str] = None

    # Crawling Limits
    MAX_PAGES: int = 100
    PAGE_TIMEOUT: int = 10  # seconds per page
    TOTAL_TIMEOUT: int = 600  # 10 minutes total
    MAX_EXTERNAL_LINKS: int = 500
    PARALLEL_REQUESTS: int = 8  # Increased from 5 for faster crawling

    # Performance Optimizations
    ENABLE_PARALLEL_ANALYZERS: bool = True

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

    # Audit lifecycle
    AUDIT_TTL: int = 3600  # seconds before audit data is cleaned up
    MAX_SSE_DURATION: int = 900  # max SSE stream duration in seconds
    ANALYZER_TIMEOUT: int = 60  # per-analyzer timeout in seconds
    MAX_IMAGE_CHECKS: int = 50  # max images to check size for

    # Browser viewport
    VIEWPORT_WIDTH: int = 1920
    VIEWPORT_HEIGHT: int = 1080

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
