"""
IntelliStake — GitHub Velocity Collector
=========================================
Collects GitHub repository metrics for tech startups using free API.
High impact for R² improvement.

Run: python engine/collect_github_data.py
"""

import os, sys, json, warnings, argparse
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any
import time

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
EXTERNAL_DIR = BASE_DIR / "unified_data" / "external_data"
CLEANED_DIR = BASE_DIR / "unified_data" / "cleaned"

# ── GitHub API ────────────────────────────────────────────────────────────────

GITHUB_API = "https://api.github.com"
RATE_LIMIT_DELAY = 1  # seconds between requests to avoid rate limit


def extract_github_urls(df: pd.DataFrame) -> List[Dict]:
    """Extract GitHub URLs from startup data."""
    print("[1/4] Extracting GitHub URLs from startup data...")
    
    github_urls = []
    
    # Check common column names for GitHub URLs
    url_cols = ["github_url", "github_link", "repo_url", "repository_url", "source_code_url"]
    
    for col in url_cols:
        if col in df.columns:
            for idx, row in df.iterrows():
                url = row.get(col)
                if url and "github.com" in str(url):
                    github_urls.append({
                        "startup_name": row.get("startup_name", ""),
                        "github_url": url,
                        "row_index": idx
                    })
    
    # Also try to find GitHub orgs from other fields
    if len(github_urls) < 100:
        # Search in description or other text fields
        text_cols = ["description", "technology_stack", "products", "github"]
        for col in text_cols:
            if col in df.columns:
                for idx, row in df.iterrows():
                    val = str(row.get(col, ""))
                    if "github.com/" in val:
                        try:
                            # Extract github.com/owner/repo pattern
                            parts = val.split("github.com/")[-1].split("/")
                            if len(parts) >= 2:
                                owner, repo = parts[0], parts[1].split("?")[0]
                                github_urls.append({
                                    "startup_name": row.get("startup_name", ""),
                                    "github_url": f"https://github.com/{owner}/{repo}",
                                    "row_index": idx
                                })
                        except:
                            pass
    
    print(f"  Found {len(github_urls)} potential GitHub URLs")
    return github_urls


def parse_github_url(url: str) -> tuple:
    """Parse owner and repo from GitHub URL."""
    try:
        # Handle various URL formats
        url = url.strip().rstrip("/")
        if "github.com/" in url:
            parts = url.split("github.com/")[-1].split("/")
            if len(parts) >= 2:
                owner = parts[0]
                repo = parts[1].split("?")[0]
                return owner, repo
    except:
        pass
    return None, None


def fetch_github_repo_data(owner: str, repo: str) -> Dict:
    """Fetch repository data from GitHub API."""
    import urllib.request
    
    url = f"{GITHUB_API}/repos/{owner}/{repo}"
    
    try:
        req = urllib.request.Request(url)
        req.add_header("Accept", "application/vnd.github.v3+json")
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            
            return {
                "owner": owner,
                "repo": repo,
                "full_name": data.get("full_name"),
                "stars": data.get("stargazers_count", 0),
                "forks": data.get("forks_count", 0),
                "watchers": data.get("watchers_count", 0),
                "open_issues": data.get("open_issues_count", 0),
                "language": data.get("language"),
                "license": data.get("license", {}).get("name") if data.get("license") else None,
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at"),
                "pushed_at": data.get("pushed_at"),
                "size": data.get("size"),
                "topics": data.get("topics", []),
                "description": data.get("description"),
            }
    except Exception as e:
        return {
            "owner": owner,
            "repo": repo,
            "error": str(e)
        }


def collect_github_data(github_urls: List[Dict]) -> List[Dict]:
    """Collect GitHub data for all URLs."""
    print(f"[2/4] Collecting GitHub data for {len(github_urls)} repos...")
    print("  (Rate limited: 60 requests/hour unauthenticated)")
    
    collected = []
    
    for i, item in enumerate(github_urls):
        owner, repo = parse_github_url(item["github_url"])
        
        if owner and repo:
            data = fetch_github_repo_data(owner, repo)
            data["startup_name"] = item["startup_name"]
            data["github_url"] = item["github_url"]
            collected.append(data)
            
            if (i + 1) % 10 == 0:
                print(f"  Progress: {i+1}/{len(github_urls)} repos processed")
            
            # Rate limiting
            time.sleep(RATE_LIMIT_DELAY)
    
    print(f"  ✓ Collected data for {len(collected)} repositories")
    return collected


def enrich_startup_data(df: pd.DataFrame, github_data: List[Dict]) -> pd.DataFrame:
    """Enrich startup data with GitHub metrics."""
    print("[3/4] Enriching startup data with GitHub metrics...")
    
    # Create lookup dict
    github_lookup = {}
    for item in github_data:
        # Match by startup name or URL
        name = item.get("startup_name", "").lower()
        url = item.get("github_url", "").lower()
        github_lookup[name] = item
        github_lookup[url] = item
    
    # Add GitHub columns
    df["github_stars"] = 0
    df["github_forks"] = 0
    df["github_watchers"] = 0
    df["github_language"] = ""
    df["github_license"] = ""
    df["github_has_repo"] = False
    
    for idx, row in df.iterrows():
        name = str(row.get("startup_name", "")).lower()
        url = str(row.get("github_url", "")).lower()
        
        gh = github_lookup.get(name) or github_lookup.get(url)
        
        if gh and "error" not in gh:
            df.at[idx, "github_stars"] = gh.get("stars", 0)
            df.at[idx, "github_forks"] = gh.get("forks", 0)
            df.at[idx, "github_watchers"] = gh.get("watchers", 0)
            df.at[idx, "github_language"] = gh.get("language", "")
            df.at[idx, "github_license"] = gh.get("license", "")
            df.at[idx, "github_has_repo"] = True
    
    has_repo_count = df["github_has_repo"].sum()
    print(f"  ✓ Matched {has_repo_count} startups with GitHub repos")
    
    return df


def save_github_data(github_data: List[Dict]):
    """Save collected GitHub data."""
    print("[4/4] Saving GitHub data...")
    
    output_file = EXTERNAL_DIR / "github_velocity.json"
    with open(output_file, "w") as f:
        json.dump(github_data, f, indent=2)
    
    print(f"  ✓ Saved → {output_file}")
    
    # Also create summary
    successful = [d for d in github_data if "error" not in d]
    failed = [d for d in github_data if "error" in d]
    
    summary = {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "total_repos": len(github_data),
        "successful": len(successful),
        "failed": len(failed),
        "languages": list(set(d.get("language") for d in successful if d.get("language"))),
        "total_stars": sum(d.get("stars", 0) for d in successful),
        "total_forks": sum(d.get("forks", 0) for d in successful),
    }
    
    summary_file = EXTERNAL_DIR / "github_velocity_summary.json"
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"  ✓ Summary → {summary_file}")
    
    return summary


def main():
    print("\n" + "=" * 60)
    print("  IntelliStake — GitHub Velocity Collector")
    print("  Collecting repo metrics for tech startups")
    print("=" * 60 + "\n")
    
    # Load startup data
    cleaned_file = CLEANED_DIR / "intellistake_startups_clean.json"
    with open(cleaned_file, "r") as f:
        data = json.load(f)
    
    startups = data if isinstance(data, list) else data.get("startups", data.get("data", []))
    df = pd.DataFrame(startups)
    
    print(f"  Loaded {len(df)} startups")
    
    # Extract GitHub URLs
    github_urls = extract_github_urls(df)
    
    if not github_urls:
        print("  ⚠ No GitHub URLs found in data.")
        print("  → To collect GitHub data, add 'github_url' column to your startup data")
        print("  → Or manually add GitHub org/repo URLs")
        return
    
    # Collect GitHub data
    github_data = collect_github_data(github_urls)
    
    # Save raw data
    summary = save_github_data(github_data)
    
    # Enrich startup data
    df_enriched = enrich_startup_data(df, github_data)
    
    # Save enriched startup data
    enriched_file = EXTERNAL_DIR / "startups_enriched_with_github.json"
    df_enriched.to_json(enriched_file, orient="records", indent=2)
    
    print(f"\n  ✓ Enriched data saved → {enriched_file}")
    
    print("\n" + "=" * 60)
    print("  COLLECTION SUMMARY")
    print("=" * 60)
    print(f"  Total repos attempted: {summary['total_repos']}")
    print(f"  Successful: {summary['successful']}")
    print(f"  Failed: {summary['failed']}")
    print(f"  Total stars: {summary['total_stars']}")
    print(f"  Total forks: {summary['total_forks']}")
    print(f"  Languages: {summary['languages']}")
    
    return summary


if __name__ == "__main__":
    main()