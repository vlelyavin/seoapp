"""Duplicate content analyzer."""

import asyncio
import hashlib
import random
from typing import Any, Dict, List, Set, Tuple
from urllib.parse import urljoin, urlparse, urlunparse

from ..models import AnalyzerResult, AuditIssue, PageData, SeverityLevel
from .base import BaseAnalyzer


# MinHash config: independent permutations h_i(x) = (a_i*x + b_i) mod prime with
# fixed seeded coefficients, so signatures are stable across processes (Python's
# built-in hash() is randomized per process via PYTHONHASHSEED).
_NUM_HASHES = 50
_MINHASH_PRIME = (1 << 61) - 1  # Mersenne prime
_minhash_rng = random.Random(0x5EED5EED)
_MINHASH_A = [_minhash_rng.randrange(1, _MINHASH_PRIME) for _ in range(_NUM_HASHES)]
_MINHASH_B = [_minhash_rng.randrange(0, _MINHASH_PRIME) for _ in range(_NUM_HASHES)]


class DuplicatesAnalyzer(BaseAnalyzer):
    """Analyzer for duplicate content detection."""

    name = "duplicates"
    icon = ""

    # Conservative defaults to reduce false positives on template-heavy sites.
    _MIN_WORDS = 80
    _MIN_LENGTH_RATIO = 0.70
    _MINHASH_CANDIDATE_THRESHOLD = 0.85
    _NEAR_DUPLICATE_THRESHOLD = 0.90

    def __init__(self):
        super().__init__()

    @property
    def display_name(self) -> str:
        return self.t("analyzers.duplicates.name")

    @property
    def description(self) -> str:
        return self.t("analyzers.duplicates.description")

    @property
    def theory(self) -> str:
        return self.t("analyzer_content.duplicates.theory")

    def _normalize_url(self, url: str) -> str:
        """Normalize URL for stable duplicate/canonical comparisons."""
        parsed = urlparse(url)
        path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
        return urlunparse(
            (
                parsed.scheme,
                parsed.netloc.lower(),
                path,
                "",
                parsed.query,
                "",
            )
        )

    def _create_shingles(self, text: str, shingle_size: int = 3) -> Set[Tuple[str, ...]]:
        """Create shingles (n-word tuples) from text."""
        words = text.split()
        if len(words) < shingle_size:
            return set()
        return {
            tuple(words[i : i + shingle_size])
            for i in range(len(words) - shingle_size + 1)
        }

    def _create_minhash_signature(
        self, shingles: Set[Tuple[str, ...]], num_hashes: int = _NUM_HASHES
    ) -> List[int]:
        """Create a MinHash signature using independent hash permutations."""
        if not shingles:
            return [0] * num_hashes

        # Stable per-shingle base hash (process-independent, unlike hash()).
        base_hashes = [
            int.from_bytes(
                hashlib.blake2b(" ".join(s).encode("utf-8"), digest_size=8).digest(),
                "big",
            )
            for s in shingles
        ]

        prime = _MINHASH_PRIME
        signature: List[int] = []
        for i in range(num_hashes):
            a = _MINHASH_A[i]
            b = _MINHASH_B[i]
            signature.append(min((a * x + b) % prime for x in base_hashes))
        return signature

    def _estimate_jaccard(self, sig1: List[int], sig2: List[int]) -> float:
        """Estimate Jaccard similarity from two MinHash signatures."""
        if not sig1 or not sig2:
            return 0.0
        matches = sum(1 for a, b in zip(sig1, sig2) if a == b)
        return matches / len(sig1)

    def _group_pairs(self, pairs: List[Tuple[str, str, float]]) -> List[Set[str]]:
        """Group URLs connected through duplicate pairs."""
        parent: Dict[str, str] = {}

        def find(x: str) -> str:
            while parent.get(x, x) != x:
                parent[x] = parent.get(parent[x], parent[x])
                x = parent[x]
            return x

        def union(x: str, y: str) -> None:
            rx, ry = find(x), find(y)
            if rx != ry:
                parent[rx] = ry

        for url_a, url_b, _ in pairs:
            parent.setdefault(url_a, url_a)
            parent.setdefault(url_b, url_b)
            union(url_a, url_b)

        groups: Dict[str, Set[str]] = {}
        for url in parent:
            root = find(url)
            groups.setdefault(root, set()).add(url)

        return [group for group in groups.values() if len(group) > 1]

    def _build_canonical_targets(self, pages: Dict[str, PageData]) -> Dict[str, str]:
        """Map normalized source URL -> normalized canonical URL."""
        targets: Dict[str, str] = {}
        for page_url, page in pages.items():
            source = self._normalize_url(page_url)
            canonical = (page.canonical or "").strip()
            if not canonical:
                continue

            canonical_url = self._normalize_url(urljoin(page_url, canonical))
            if canonical_url and canonical_url != source:
                targets[source] = canonical_url
        return targets

    def _is_canonical_pair(
        self, norm_a: str, norm_b: str, canonical_targets: Dict[str, str]
    ) -> bool:
        return (
            canonical_targets.get(norm_a) == norm_b
            or canonical_targets.get(norm_b) == norm_a
        )

    async def analyze(
        self,
        pages: Dict[str, PageData],
        base_url: str,
        **kwargs: Any,
    ) -> AnalyzerResult:
        issues: List[AuditIssue] = []
        tables: List[Dict[str, Any]] = []

        # Steps 1-2 (BeautifulSoup parsing, MinHash, O(n^2) pairwise compare) are
        # CPU-bound — run them off the event loop so this analyzer doesn't block
        # SSE progress or the other analyzers running concurrently.
        def _detect_duplicates():
            # Step 1: Build signatures from conservative content extraction.
            signatures: Dict[str, List[int]] = {}
            text_hashes: Dict[str, str] = {}
            content_word_counts: Dict[str, int] = {}
            normalized_urls: Dict[str, str] = {}
            extraction_mode_counts: Dict[str, int] = {"main": 0, "article": 0, "fallback": 0}

            for url, page in pages.items():
                if page.status_code != 200 or not page.main_content_text:
                    continue

                text = page.main_content_text
                mode = page.main_content_mode or "fallback"
                word_count = page.main_content_word_count or len(text.split())

                if word_count < self._MIN_WORDS:
                    continue

                shingles = self._create_shingles(text, shingle_size=3)
                if not shingles:
                    continue

                signatures[url] = self._create_minhash_signature(shingles)
                text_hashes[url] = hashlib.sha256(text.encode("utf-8")).hexdigest()
                content_word_counts[url] = word_count
                normalized_urls[url] = self._normalize_url(url)
                extraction_mode_counts[mode] = extraction_mode_counts.get(mode, 0) + 1

            canonical_targets = self._build_canonical_targets(pages)

            # Step 2: Compare pages pairwise (conservative thresholds).
            urls = list(signatures.keys())
            exact_duplicate_pairs: List[Tuple[str, str, float]] = []
            near_duplicate_pairs: List[Tuple[str, str, float]] = []
            candidate_pairs = 0
            canonical_pairs_skipped = 0

            for i in range(len(urls)):
                for j in range(i + 1, len(urls)):
                    url_a = urls[i]
                    url_b = urls[j]
                    norm_a = normalized_urls[url_a]
                    norm_b = normalized_urls[url_b]

                    if self._is_canonical_pair(norm_a, norm_b, canonical_targets):
                        canonical_pairs_skipped += 1
                        continue

                    wc_a = content_word_counts[url_a]
                    wc_b = content_word_counts[url_b]
                    ratio = min(wc_a, wc_b) / max(wc_a, wc_b)
                    if ratio < self._MIN_LENGTH_RATIO:
                        continue

                    jaccard = self._estimate_jaccard(signatures[url_a], signatures[url_b])
                    if jaccard < self._MINHASH_CANDIDATE_THRESHOLD:
                        continue

                    candidate_pairs += 1

                    # Strict exactness: only equal normalized content hashes.
                    if text_hashes[url_a] == text_hashes[url_b]:
                        exact_duplicate_pairs.append((url_a, url_b, 1.0))
                    elif jaccard >= self._NEAR_DUPLICATE_THRESHOLD:
                        near_duplicate_pairs.append((url_a, url_b, jaccard))

            return (
                signatures,
                extraction_mode_counts,
                exact_duplicate_pairs,
                near_duplicate_pairs,
                candidate_pairs,
                canonical_pairs_skipped,
            )

        (
            signatures,
            extraction_mode_counts,
            exact_duplicate_pairs,
            near_duplicate_pairs,
            candidate_pairs,
            canonical_pairs_skipped,
        ) = await asyncio.to_thread(_detect_duplicates)

        # Step 3: Group duplicates.
        exact_groups = self._group_pairs(exact_duplicate_pairs)
        near_groups = self._group_pairs(near_duplicate_pairs)

        # Step 4: Create issues.
        if not exact_duplicate_pairs and not near_duplicate_pairs:
            issues.append(
                self.create_issue(
                    category="no_duplicates",
                    severity=SeverityLevel.SUCCESS,
                    message=self.t("analyzer_content.duplicates.issues.no_duplicates"),
                    details=self.t("analyzer_content.duplicates.details.no_duplicates"),
                    recommendation=self.t("analyzer_content.duplicates.recommendations.no_duplicates"),
                )
            )

        if exact_groups:
            affected: List[str] = []
            for group in exact_groups:
                affected.extend(list(group))
            issues.append(
                self.create_issue(
                    category="exact_duplicates",
                    severity=SeverityLevel.ERROR,
                    message=self.t(
                        "analyzer_content.duplicates.issues.exact_duplicates",
                        count=len(exact_groups),
                    ),
                    details=self.t("analyzer_content.duplicates.details.exact_duplicates"),
                    affected_urls=list(set(affected))[:20],
                    recommendation=self.t(
                        "analyzer_content.duplicates.recommendations.exact_duplicates"
                    ),
                    count=len(exact_groups),
                )
            )

        if near_groups:
            affected = []
            for group in near_groups:
                affected.extend(list(group))
            issues.append(
                self.create_issue(
                    category="near_duplicates",
                    severity=SeverityLevel.WARNING,
                    message=self.t(
                        "analyzer_content.duplicates.issues.near_duplicates",
                        count=len(near_groups),
                    ),
                    details=self.t("analyzer_content.duplicates.details.near_duplicates"),
                    affected_urls=list(set(affected))[:20],
                    recommendation=self.t(
                        "analyzer_content.duplicates.recommendations.near_duplicates"
                    ),
                    count=len(near_groups),
                )
            )

        # Step 5: Create table.
        table_data: List[Dict[str, str]] = []
        all_pairs = (
            [(a, b, sim) for a, b, sim in exact_duplicate_pairs]
            + [(a, b, sim) for a, b, sim in near_duplicate_pairs]
        )
        all_pairs.sort(key=lambda x: x[2], reverse=True)

        h_url1 = self.t("tables.url_1")
        h_url2 = self.t("tables.url_2")
        h_similarity = self.t("table_translations.headers.similarity")

        for url_a, url_b, similarity in all_pairs[:10]:
            table_data.append(
                {
                    h_url1: url_a[:70] + "..." if len(url_a) > 70 else url_a,
                    h_url2: url_b[:70] + "..." if len(url_b) > 70 else url_b,
                    h_similarity: f"{similarity:.0%}",
                }
            )

        if table_data:
            tables.append(
                {
                    "title": self.t("table_translations.titles.content_duplicates"),
                    "headers": [h_url1, h_url2, h_similarity],
                    "rows": table_data,
                }
            )

        # Step 6: Summary.
        total_groups = len(exact_groups) + len(near_groups)
        if total_groups > 0:
            summary = self.t("analyzer_content.duplicates.summary.found", count=total_groups)
        else:
            summary = self.t("analyzer_content.duplicates.summary.ok")

        severity = self._determine_overall_severity(issues)

        return self.create_result(
            severity=severity,
            summary=summary,
            issues=issues,
            data={
                "pages_analyzed": len(signatures),
                "exact_duplicate_groups": len(exact_groups),
                "near_duplicate_groups": len(near_groups),
                "exact_duplicate_pairs": len(exact_duplicate_pairs),
                "near_duplicate_pairs": len(near_duplicate_pairs),
                "pages_considered": len(signatures),
                "candidate_pairs": candidate_pairs,
                "exact_pairs": len(exact_duplicate_pairs),
                "near_pairs": len(near_duplicate_pairs),
                "canonical_pairs_skipped": canonical_pairs_skipped,
                "extraction_mode_counts": extraction_mode_counts,
                "main_content_used_count": (
                    extraction_mode_counts.get("main", 0)
                    + extraction_mode_counts.get("article", 0)
                ),
                "fallback_extraction_count": extraction_mode_counts.get("fallback", 0),
            },
            tables=tables,
        )
