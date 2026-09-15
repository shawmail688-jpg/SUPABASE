"""TASK-007 reproducible JPEG profile evaluation on the real Uganda photo set."""
from __future__ import annotations

import argparse
import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

PROFILES = {
    "default": {"max_edge": 1800, "quality": 80, "cap_bytes": 1_000_000},
    "detail": {"max_edge": 2400, "quality": 90, "cap_bytes": 2_500_000},
}


def compress(source: Path, target: Path, profile: dict) -> dict:
    with Image.open(source) as raw:
        image = ImageOps.exif_transpose(raw).convert("RGB")
        original = image.size
        scale = min(1.0, profile["max_edge"] / max(image.size))
        output = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        if output != image.size:
            image = image.resize(output, Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "JPEG", quality=profile["quality"], optimize=True)
    return {
        "original_width": original[0], "original_height": original[1],
        "output_width": output[0], "output_height": output[1],
        "mime": "image/jpeg", "bytes": target.stat().st_size,
        "within_cap": target.stat().st_size <= profile["cap_bytes"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--work", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--limit", type=int, default=24)
    args = parser.parse_args()
    source, work, report = Path(args.source), Path(args.work), Path(args.report)
    files = sorted(p for p in source.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"})[: args.limit]
    if len(files) < 20:
        raise SystemExit("TASK-007 requires at least 20 real samples")
    rows = []
    for path in files:
        category = "interior/dark" if "interior" in path.name.lower() else "frontage/signage"
        row = {"source": str(path), "category": category, "profiles": {}}
        for name, profile in PROFILES.items():
            row["profiles"][name] = compress(path, work / name / path.name, profile)
        rows.append(row)
    summary = {}
    for name, profile in PROFILES.items():
        sizes = [row["profiles"][name]["bytes"] for row in rows]
        summary[name] = {**profile, "samples": len(rows), "median_kb": round(statistics.median(sizes) / 1024, 1),
                         "max_kb": round(max(sizes) / 1024, 1), "cap_pass": all(s <= profile["cap_bytes"] for s in sizes)}
    payload = {"generated_at": datetime.now(timezone.utc).isoformat(), "profiles": summary, "samples": rows}
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if all(v["cap_pass"] for v in summary.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
