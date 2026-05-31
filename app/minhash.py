"""Shared MinHash configuration + signature/jaccard helpers.

Same seeded coefficients used at extraction time (crawler) and at comparison
time (duplicates analyzer) so signatures are stable.
"""

from __future__ import annotations

import hashlib
import random
from typing import List, Set, Tuple

NUM_HASHES = 50
PRIME = (1 << 61) - 1  # Mersenne prime

_rng = random.Random(0x5EED5EED)
_A = [_rng.randrange(1, PRIME) for _ in range(NUM_HASHES)]
_B = [_rng.randrange(0, PRIME) for _ in range(NUM_HASHES)]


def shingles(text: str, size: int = 3) -> Set[Tuple[str, ...]]:
    words = text.split()
    if len(words) < size:
        return set()
    return {
        tuple(words[i : i + size])
        for i in range(len(words) - size + 1)
    }


def signature(text: str, size: int = 3) -> List[int]:
    """Compute the 50-int MinHash signature for the given text."""
    sh = shingles(text, size)
    if not sh:
        return []
    base = [
        int.from_bytes(
            hashlib.blake2b(" ".join(s).encode("utf-8"), digest_size=8).digest(),
            "big",
        )
        for s in sh
    ]
    return [
        min((_A[i] * x + _B[i]) % PRIME for x in base)
        for i in range(NUM_HASHES)
    ]


def jaccard(sig1: List[int], sig2: List[int]) -> float:
    if not sig1 or not sig2:
        return 0.0
    return sum(1 for a, b in zip(sig1, sig2) if a == b) / len(sig1)
