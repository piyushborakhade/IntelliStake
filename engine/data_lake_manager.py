"""
engine/data_lake_manager.py
============================
IntelliStake — Data Lake Manager (Domain 1)

Manages the unified_data/ tiered storage structure:
  1_raw       → original high-volume raw files
  2_cleaned   → de-duped, schema-validated datasets
  3_enriched  → derived signal streams (Parquet)
  4_production→ all pipeline output JSON summaries

Key capabilities:
  - Rename legacy folder names to numbered tiers (with symlinks for backward compat)
  - Patch all .py file path references to new structure
  - Regenerate data_lake_manifest.json with SHA-256 hashes, row counts, null audits
  - Validate final_portfolio_weights.json for NaN/null values

Usage:
  python engine/data_lake_manager.py                 # full run
  python engine/data_lake_manager.py --dry-run       # print plan, no changes
  python engine/data_lake_manager.py --manifest-only # only regenerate manifest
"""

import os
import sys
import json
import hashlib
import argparse
import shutil
import re
from datetime import datetime, timezone
from pathlib import Path

# ── Path configuration ──────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent          # IntelliStake_Final/
UNIFIED  = BASE_DIR / "unified_data"

# Legacy name → new numbered name mapping
TIER_MAP = {
    "raw":        "1_raw",
    "cleaned":    "2_cleaned",
    "enriched":   "3_enriched",
    "production": "4_production",
    # Extra folders kept as-is (no rename needed)
    "knowledge_graph": "knowledge_graph",
    "identities":      "identities",
    "outputs":         "outputs",
}

# Directories to scan for Python path references
PY_SCAN_DIRS = [
    BASE_DIR / "engine",
    BASE_DIR / "data_scaling_engine",
    BASE_DIR / "blockchain",
    BASE_DIR,        # run_full_pipeline.py, start_intellistake.py
]

# ── Helpers ──────────────────────────────────────────────────────────────────

def sha256_file(path: Path) -> str:
    """Return hex SHA-256 digest of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def row_count(path: Path) -> int:
    """Return approximate row count for JSON/CSV/Parquet files."""
    suffix = path.suffix.lower()
    try:
        if suffix == ".json":
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return len(data)
            if isinstance(data, dict):
                # Try common list keys
                for key in ("allocations", "startups", "records", "data", "items"):
                    if key in data and isinstance(data[key], list):
                        return len(data[key])
                return len(data)  # top-level key count fallback
        elif suffix == ".csv":
            count = 0
            with open(path, "r", encoding="utf-8") as f:
                for _ in f:
                    count += 1
            return max(0, count - 1)  # subtract header
        elif suffix == ".parquet":
            try:
                import pandas as pd
                return len(pd.read_parquet(path, columns=[]))
            except Exception:
                return -1
    except Exception as e:
        print(f"  [WARN] Could not count rows for {path.name}: {e}")
        return -1
    return -1


def null_audit(path: Path) -> dict:
    """Return {column: null_count} for JSON/CSV files (best-effort)."""
    suffix = path.suffix.lower()
    try:
        import pandas as pd
        if suffix == ".json":
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                df = pd.DataFrame(data)
                return df.isnull().sum().to_dict()
            return {}
        elif suffix == ".csv":
            df = pd.read_csv(path, low_memory=False)
            return df.isnull().sum().to_dict()
        elif suffix == ".parquet":
            df = pd.read_parquet(path)
            return df.isnull().sum().to_dict()
    except Exception as e:
        print(f"  [WARN] Null audit failed for {path.name}: {e}")
    return {}


def format_size(bytes_: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_ < 1024:
            return f"{bytes_:.1f} {unit}"
        bytes_ /= 1024
    return f"{bytes_:.1f} TB"

# ── Step 1: Rename tiers ────────────────────────────────────────────────────

def rename_tiers(dry_run: bool = False) -> list:
    """Rename legacy unified_data/ subdirs to numbered tiers. Create symlinks for backward compat."""
    ops = []
    for old_name, new_name in TIER_MAP.items():
        if old_name == new_name:
            continue
        old_path = UNIFIED / old_name
        new_path = UNIFIED / new_name
        if old_path.exists() and not new_path.exists():
            ops.append(("RENAME", old_path, new_path))
        elif old_path.exists() and new_path.exists():
            ops.append(("SKIP_EXISTS", old_path, new_path))
        elif new_path.exists():
            ops.append(("ALREADY_DONE", old_path, new_path))

    print("\n[STEP 1] Tier Rename Plan:")
    print("-" * 60)
    for op, src, dst in ops:
        print(f"  {op:15s} {src.name!r:20s} → {dst.name!r}")

    if not dry_run:
        for op, src, dst in ops:
            if op == "RENAME":
                shutil.move(str(src), str(dst))
                # Create a backward-compatible symlink: old_name → new_name
                symlink_path = UNIFIED / src.name
                if not symlink_path.exists():
                    os.symlink(dst, symlink_path)
                    print(f"  ✓ Renamed + symlink: {src.name} → {dst.name}")
                else:
                    print(f"  ✓ Renamed: {src.name} → {dst.name} (symlink already exists)")
    return ops


# ── Step 2: Patch Python path references ───────────────────────────────────

def patch_py_paths(dry_run: bool = False) -> list:
    """Find and replace old path strings in all .py files."""
    replacements = [
        # Most likely patterns appearing in existing engine files
        ("unified_data/raw/",        "unified_data/1_raw/"),
        ("unified_data/cleaned/",    "unified_data/2_cleaned/"),
        ("unified_data/enriched/",   "unified_data/3_enriched/"),
        ("unified_data/production/", "unified_data/4_production/"),
        ("unified_data/outputs/",    "unified_data/outputs/"),   # No change, kept for ref
    ]

    changes = []
    py_files = []
    for scan_dir in PY_SCAN_DIRS:
        if scan_dir.exists():
            py_files.extend(scan_dir.glob("*.py"))
            py_files.extend(scan_dir.glob("**/*.py"))

    print("\n[STEP 2] Python Path Patching:")
    print("-" * 60)
    for py_file in sorted(set(py_files)):
        if "__pycache__" in str(py_file):
            continue
        try:
            content = py_file.read_text(encoding="utf-8")
        except Exception:
            continue

        new_content = content
        file_changes = []
        for old_pat, new_pat in replacements:
            if old_pat in new_content:
                count = new_content.count(old_pat)
                new_content = new_content.replace(old_pat, new_pat)
                file_changes.append((old_pat, new_pat, count))

        if file_changes:
            changes.append((py_file, file_changes, content, new_content))
            rel = py_file.relative_to(BASE_DIR)
            for old_p, new_p, cnt in file_changes:
                print(f"  {rel}: '{old_p}' → '{new_p}'  ({cnt} occurrence{'s' if cnt>1 else ''})")

    if not dry_run:
        for py_file, _, _, new_content in changes:
            py_file.write_text(new_content, encoding="utf-8")
        print(f"\n  ✓ Patched {len(changes)} Python files.")
    else:
        print(f"\n  [DRY RUN] Would patch {len(changes)} file(s).")

    return changes


# ── Step 3: Generate manifest ───────────────────────────────────────────────

MANIFEST_EXTENSIONS = {".json", ".csv", ".parquet"}

def generate_manifest() -> dict:
    """Build a fresh data_lake_manifest.json with hashes + row counts + null audits."""
    print("\n[STEP 3] Generating Data Lake Manifest:")
    print("-" * 60)

    manifest = {
        "schema_version": "2.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generator": "engine/data_lake_manager.py",
        "base_path": str(UNIFIED),
        "tiers": {},
        "files": {},
        "summary": {}
    }

    tier_labels = {
        "1_raw":         "Original high-volume raw files (150k–200k rows)",
        "2_cleaned":     "De-duped, schema-validated datasets",
        "3_enriched":    "Derived signal streams (Parquet: sentiment, MCA, GitHub)",
        "4_production":  "Pipeline output JSON summaries (fed to dashboard)",
        "knowledge_graph":"Master Knowledge Graph (3.2M data points)",
        "identities":    "Investor identities + oracle transaction log",
        "outputs":       "Legacy output artefacts",
    }

    total_files = 0
    total_size  = 0
    total_rows  = 0

    for tier_dir in sorted(UNIFIED.iterdir()):
        if not tier_dir.is_dir() or tier_dir.is_symlink():
            continue
        tier_name = tier_dir.name
        tier_files = {}

        for f in sorted(tier_dir.glob("*")):
            if not f.is_file():
                continue
            if f.suffix.lower() not in MANIFEST_EXTENSIONS:
                continue

            size = f.stat().st_size
            print(f"  Hashing {f.name} ({format_size(size)}) …", end=" ", flush=True)
            fhash   = sha256_file(f)
            rows    = row_count(f)
            nulls   = null_audit(f)
            total_null = sum(v for v in nulls.values() if isinstance(v, (int, float)))

            print(f"rows={rows if rows >= 0 else '?'}, nulls={int(total_null)}")

            entry = {
                "file_name":    f.name,
                "tier":         tier_name,
                "size_bytes":   size,
                "size_human":   format_size(size),
                "file_hash":    fhash,
                "hash_algo":    "sha256",
                "row_count":    rows,
                "null_counts":  {k: int(v) for k, v in nulls.items() if v > 0},
                "total_nulls":  int(total_null),
                "scanned_at":   datetime.now(timezone.utc).isoformat(),
            }
            tier_files[f.name] = entry
            manifest["files"][f"{tier_name}/{f.name}"] = entry
            total_files += 1
            total_size  += size
            if rows >= 0:
                total_rows += rows

        manifest["tiers"][tier_name] = {
            "description": tier_labels.get(tier_name, ""),
            "file_count":  len(tier_files),
            "files":       list(tier_files.keys()),
        }

    manifest["summary"] = {
        "total_files":       total_files,
        "total_size_bytes":  total_size,
        "total_size_human":  format_size(total_size),
        "total_rows_approx": total_rows,
        "tiers_scanned":     len(manifest["tiers"]),
    }

    manifest_path = BASE_DIR / "data_lake_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\n  ✓ Manifest written → {manifest_path}")
    print(f"  Summary: {total_files} files | {format_size(total_size)} | ~{total_rows:,} rows")
    return manifest


# ── Step 4: NaN audit on production JSON ───────────────────────────────────

def audit_production_jsons():
    """Scan 4_production/ (or production/) for any remaining NaN string values."""
    prod_dirs = [UNIFIED / "4_production", UNIFIED / "production"]
    prod = next((d for d in prod_dirs if d.exists()), None)
    if not prod:
        print("\n[STEP 4] Production folder not found — skipping NaN audit.")
        return

    print(f"\n[STEP 4] NaN Audit on {prod.name}/:")
    print("-" * 60)
    issues = []
    for f in sorted(prod.glob("*.json")):
        text = f.read_text(encoding="utf-8")
        nan_count = text.lower().count('"nan"') + text.lower().count(': nan,') + text.lower().count(':nan,')
        if nan_count > 0:
            print(f"  ⚠ {f.name}: {nan_count} NaN value(s) detected")
            issues.append((f, nan_count))
        else:
            print(f"  ✓ {f.name}: clean")
    if not issues:
        print("  All production JSON files are NaN-free ✓")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="IntelliStake Data Lake Manager")
    parser.add_argument("--dry-run",       action="store_true", help="Print plan only, no file changes")
    parser.add_argument("--manifest-only", action="store_true", help="Only regenerate manifest.json")
    args = parser.parse_args()

    print("=" * 60)
    print("  IntelliStake — Data Lake Manager v2.0")
    print(f"  Base: {BASE_DIR}")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print("=" * 60)

    if not args.manifest_only:
        rename_tiers(dry_run=args.dry_run)
        patch_py_paths(dry_run=args.dry_run)

    generate_manifest()
    audit_production_jsons()

    print("\n" + "=" * 60)
    print("  ✅ Data Lake Manager complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
