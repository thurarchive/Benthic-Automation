"""
Lightweight v2 acceptance tests.  No pytest needed — run with:
    python test_v2.py
All tests print PASS / FAIL.
"""
import json
import tempfile
from pathlib import Path

import cv2
import numpy as np

import benthic_core as core

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"


def _result(name, ok, detail=""):
    tag = PASS if ok else FAIL
    print(f"[{tag}] {name}" + (f"  — {detail}" if detail else ""))
    return ok


# ------------------------------------------------------------------
def test_detect_corners_classical():
    """Synthetic image: blue lines forming a square → corners within 15 px tolerance."""
    # Build image directly in RGB colour space (detect_corners expects RGB).
    # Blue rope in HSV (hue ~110): RGB (0, 50, 220) → HSV hue ~225° → maps to
    # OpenCV hue ~112 which is inside [90,140] range.
    img = np.zeros((800, 800, 3), np.uint8)
    tl, br = (150, 150), (650, 650)
    # Draw in RGB: (R=0, G=50, B=220) — pure blue, well inside HSV threshold.
    cv2.rectangle(img, tl, br, (0, 50, 220), 8)   # already RGB-ordered
    rgb = img  # no conversion needed
    corners, conf, method = core.detect_corners(rgb)
    expected = [(150, 150), (650, 150), (650, 650), (150, 650)]
    if corners is None:
        return _result("detect_corners_classical", False, "returned None")
    # Order corners same way as order_corners
    ordered = core.order_corners(corners)
    exp_ordered = core.order_corners(expected)
    dists = [np.linalg.norm(np.array(a) - np.array(b))
             for a, b in zip(ordered, exp_ordered)]
    ok = all(d < 20 for d in dists)
    return _result("detect_corners_classical", ok,
                   f"method={method} conf={conf:.2f} max_dist={max(dists):.1f}px")


def test_detect_obstruction_clean():
    """Clean reef-like image (no person/hand) → has_obstruction=False."""
    img = np.random.randint(20, 180, (600, 600, 3), np.uint8)
    flagged, boxes, conf = core.detect_obstruction(img)
    return _result("detect_obstruction_clean", not flagged,
                   f"flagged={flagged} boxes={boxes} conf={conf:.2f}")


def test_detect_obstruction_hand_heuristic():
    """Image with a very thin bright stick (high aspect ratio) → heuristic fires."""
    img = np.zeros((600, 600, 3), np.uint8)  # dark background for clean threshold
    # Thin vertical bar: 4 px wide × 300 px tall → aspect ratio 75:1, area = 1200 px² (0.33% of 360 000)
    # Make it wider so area clearly exceeds 3% threshold: 10 px × 400 px = 4 000 px² = 1.1% — still too small.
    # Use 25 px × 500 px = 12 500 px² = 3.47% > 3% threshold. ✓
    cv2.rectangle(img, (287, 50), (312, 550), (240, 240, 240), -1)
    flagged, boxes, conf = core.detect_obstruction(img)
    return _result("detect_obstruction_hand_heuristic", flagged,
                   f"flagged={flagged} boxes={len(boxes)} conf={conf:.2f}")


def test_log_decision():
    with tempfile.TemporaryDirectory() as tmp:
        survey_dir = Path(tmp)
        record = {"photo": "test.jpg", "depth": 15, "segment": 2,
                  "action": "keep", "score": 0.87}
        core.log_decision(survey_dir, record)
        log_path = survey_dir / "decisions.jsonl"
        ok_exists = log_path.exists()
        if not ok_exists:
            return _result("log_decision", False, "decisions.jsonl not created")
        lines = log_path.read_text().strip().split("\n")
        data = json.loads(lines[0])
        ok = (
            data["photo"] == "test.jpg"
            and data["depth"] == 15
            and data["segment"] == 2
            and data["action"] == "keep"
            and "timestamp" in data
        )
        return _result("log_decision", ok, f"fields={list(data.keys())}")


def test_pick_evenly_segments():
    """Segment exhaustion path: fewer names than k still returns all names."""
    names = ["a.jpg", "b.jpg", "c.jpg"]
    scores = [0.9, 0.5, 0.7]
    result = core.pick_evenly(names, scores, k=5)
    ok = set(result) == set(names)
    return _result("pick_evenly_segments", ok, f"result={result}")


def test_survey_name():
    from datetime import date
    n = core.survey_name(date(2026, 4, 6), "CG")
    ok = n == "BS_20260406_CG"
    return _result("survey_name", ok, n)


# ------------------------------------------------------------------
if __name__ == "__main__":
    results = [
        test_survey_name(),
        test_pick_evenly_segments(),
        test_log_decision(),
        test_detect_corners_classical(),
        test_detect_obstruction_clean(),
        test_detect_obstruction_hand_heuristic(),
    ]
    total = len(results)
    passed = sum(results)
    print(f"\n{passed}/{total} tests passed.")
    raise SystemExit(0 if passed == total else 1)
