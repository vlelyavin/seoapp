import asyncio
import unittest
from typing import Dict, Optional

from app.analyzers.duplicates import DuplicatesAnalyzer
from app.i18n import get_translator
from app.models import AnalyzerResult, AuditIssue, PageData, SeverityLevel
from app.report_generator import translate_analyzer_content


def build_page(url: str, html: str, canonical: Optional[str] = None) -> PageData:
    return PageData(
        url=url,
        status_code=200,
        html_content=html,
        canonical=canonical,
    )


class TranslationGuardsTests(unittest.TestCase):
    def test_links_summary_and_table_title_are_localized_ru_uk(self):
        source = AnalyzerResult(
            name="links",
            display_name="Broken Links",
            severity=SeverityLevel.WARNING,
            summary="Broken links found: Broken external links: 1",
            issues=[
                AuditIssue(
                    category="broken_external",
                    severity=SeverityLevel.WARNING,
                    message="Broken external links: 1",
                    details="Links to missing external resources can hurt UX.",
                    recommendation="Fix broken links.",
                    count=1,
                )
            ],
            tables=[
                {
                    "title": "Broken links",
                    "headers": ["Type", "Link", "Status"],
                    "rows": [
                        {
                            "Type": "External",
                            "Link": "https://example.com/missing",
                            "Status": "404",
                        }
                    ],
                }
            ],
        )

        expected_titles = {
            "ru": "Битые ссылки",
            "uk": "Биті посилання",
        }

        for lang in ("ru", "uk"):
            with self.subTest(lang=lang):
                translated = translate_analyzer_content(source, lang, get_translator(lang))
                self.assertNotIn("broken links", translated.summary.lower())
                self.assertEqual(translated.tables[0]["title"], expected_titles[lang])

    def test_content_table_title_is_localized_ru_uk(self):
        source = AnalyzerResult(
            name="content",
            display_name="Content",
            severity=SeverityLevel.WARNING,
            summary="Content issues: Pages with thin content: 3. Average word count: 120",
            tables=[
                {
                    "title": "Pages with thin content",
                    "headers": ["URL", "Word Count", "Status"],
                    "rows": [],
                }
            ],
        )

        expected_titles = {
            "ru": "Страницы с недостаточным контентом",
            "uk": "Сторінки з недостатнім контентом",
        }

        for lang in ("ru", "uk"):
            with self.subTest(lang=lang):
                translated = translate_analyzer_content(source, lang, get_translator(lang))
                self.assertEqual(translated.tables[0]["title"], expected_titles[lang])

    def test_robots_and_security_problem_summaries_do_not_leak_english(self):
        robots_source = AnalyzerResult(
            name="robots",
            display_name="Indexation",
            severity=SeverityLevel.WARNING,
            summary="Indexation issues: URLs in sitemap not found on the website: 25, Pages not included in sitemap: 19",
            issues=[
                AuditIssue(
                    category="sitemap_urls_not_found",
                    severity=SeverityLevel.WARNING,
                    message="URLs in sitemap not found on the website: 25",
                    count=25,
                ),
                AuditIssue(
                    category="pages_not_in_sitemap",
                    severity=SeverityLevel.INFO,
                    message="Pages not included in sitemap: 19",
                    count=19,
                ),
            ],
        )
        robots_translated = translate_analyzer_content(
            robots_source, "ru", get_translator("ru")
        )
        self.assertIn("Проблемы с индексацией", robots_translated.summary)
        self.assertNotIn("URLs in sitemap", robots_translated.summary)

        security_source = AnalyzerResult(
            name="security",
            display_name="HTTPS & Security",
            severity=SeverityLevel.WARNING,
            summary="Issues found: HSTS header is missing, X-Content-Type-Options is missing",
            issues=[
                AuditIssue(
                    category="missing_hsts",
                    severity=SeverityLevel.WARNING,
                    message="HSTS header is missing",
                ),
                AuditIssue(
                    category="missing_x_content_type",
                    severity=SeverityLevel.INFO,
                    message="X-Content-Type-Options is missing",
                ),
            ],
        )
        security_translated = translate_analyzer_content(
            security_source, "ru", get_translator("ru")
        )
        self.assertIn("Найдены проблемы", security_translated.summary)
        self.assertNotIn("HSTS header is missing", security_translated.summary)


class DuplicatesConservativeTests(unittest.TestCase):
    def setUp(self):
        self.analyzer = DuplicatesAnalyzer()
        self.base_url = "https://example.com"
        self.main_text_a = " ".join(f"alpha{i % 41}" for i in range(180))
        self.main_text_b = " ".join(f"beta{i % 37}" for i in range(180))
        self.shared_shell = " ".join(f"shell{i % 12}" for i in range(140))

    def analyze(self, pages: Dict[str, PageData]) -> AnalyzerResult:
        return asyncio.run(self.analyzer.analyze(pages, self.base_url))

    def test_exact_duplicates_require_identical_main_content(self):
        page_a = build_page(
            "https://example.com/a",
            f"<html><body><header>{self.shared_shell}</header><main>{self.main_text_a}</main><footer>footer A</footer></body></html>",
        )
        page_b = build_page(
            "https://example.com/b",
            f"<html><body><nav>{self.shared_shell}</nav><main>{self.main_text_a}</main><footer>footer B</footer></body></html>",
        )
        page_c = build_page(
            "https://example.com/c",
            f"<html><body><header>{self.shared_shell}</header><main>{self.main_text_b}</main><footer>footer C</footer></body></html>",
        )

        result = self.analyze({p.url: p for p in (page_a, page_b, page_c)})
        self.assertGreaterEqual(result.data["exact_pairs"], 1)
        self.assertEqual(result.data["canonical_pairs_skipped"], 0)

    def test_canonical_pairs_are_skipped(self):
        page_a = build_page(
            "https://example.com/main",
            f"<html><body><main>{self.main_text_a}</main></body></html>",
        )
        page_b = build_page(
            "https://example.com/duplicate",
            f"<html><body><main>{self.main_text_a}</main></body></html>",
            canonical="/main",
        )

        result = self.analyze({p.url: p for p in (page_a, page_b)})
        self.assertEqual(result.data["canonical_pairs_skipped"], 1)
        self.assertEqual(result.data["exact_pairs"], 0)
        self.assertEqual(result.data["near_pairs"], 0)

    def test_template_noise_does_not_force_exact_duplicates(self):
        page_a = build_page(
            "https://example.com/x",
            f"<html><body><div id='sidebar-menu'>{self.shared_shell}</div><main>{self.main_text_a}</main></body></html>",
        )
        page_b = build_page(
            "https://example.com/y",
            f"<html><body><div class='cookie-banner'>{self.shared_shell}</div><main>{self.main_text_b}</main></body></html>",
        )

        result = self.analyze({p.url: p for p in (page_a, page_b)})
        self.assertEqual(result.data["exact_pairs"], 0)


if __name__ == "__main__":
    unittest.main()
