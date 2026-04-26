"""
IntelliStake — External Data Collector
=======================================
Collects additional features from free/accessible sources to improve R².
Saves to unified_data/external_data/

Run: python engine/collect_external_data.py
"""

import os, sys, json, warnings, argparse, time
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
EXTERNAL_DIR = BASE_DIR / "unified_data" / "external_data"
EXTERNAL_DIR.mkdir(parents=True, exist_ok=True)

# ── Data Collection Functions ──────────────────────────────────────────────

def collect_mca_filings() -> Dict:
    """
    Collect MCA (Ministry of Corporate Affairs) filing data for Indian companies.
    MCA provides free company master data and filing history.
    """
    print("[1/8] Collecting MCA filings data...")
    
    # MCA public data - company master information
    # Note: Actual MCA API requires paid access, but basic company info is available
    # through various free datasets and scraping of MCA portal
    
    mca_data = {
        "source": "mca.gov.in (Ministry of Corporate Affairs)",
        "description": "Indian company filings and registration data",
        "data_type": "company_master",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "note": "MCA full API requires paid access. Free CIN/FCRN lookup available at datakund or through ROC portals.",
        "fields_available": [
            "cin_number", "company_name", "incorporation_date", 
            "registered_address", "authorized_capital", "paid_capital",
            "roc_code", "company_status", "filing_history"
        ],
        "how_to_get": "Register at mca.gov.in for API access or use paid data providers (Tofler, Zauba)",
    }
    
    print(f"  ✓ MCA data structure defined")
    return mca_data


def collect_crunchbase_free() -> Dict:
    """
    Collect available Crunchbase-style data from free sources.
    """
    print("[2/8] Collecting funding/VC data structure...")
    
    # Crunchbase offers limited free tier
    # Alternative: Use GitHub datasets, Wikipedia lists, news archives
    
    funding_data = {
        "source": "crunchbase (free tier) / alternative datasets",
        "description": "Funding rounds, investor details, company metrics",
        "data_type": "funding_rounds",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "note": "Full Crunchbase/PitchBook requires paid subscription",
        "free_alternatives": [
            "GitHub: irdamo/india-startup-funding",
            "Kaggle: sudalai/india-startup-funding", 
            "Kaggle: arpan129/startups-funding-dataset",
            "Wikipedia: List of Indian unicorns",
            "YourStory funding database",
            "VCCircle funding news"
        ],
        "fields_available": [
            "company_name", "funding_round", "amount_usd", 
            "date", "lead_investor", "all_investors", "valuation"
        ],
    }
    
    print(f"  ✓ Funding data structure defined")
    return funding_data


def collect_github_velocity() -> Dict:
    """
    Collect GitHub repository metrics for tech startups.
    """
    print("[3/8] Collecting GitHub velocity data...")
    
    # GitHub API is free for public repos
    # Can collect: stars, forks, commits, contributors, languages
    
    github_data = {
        "source": "api.github.com",
        "description": "Repository metrics for tech startups",
        "data_type": "github_velocity",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "api_endpoint": "https://api.github.com/repos/{owner}/{repo}",
        "rate_limit": "60 requests/hour (unauthenticated), 5000/hour (authenticated)",
        "fields_collectable": [
            "repo_name", "stars", "forks", "watchers",
            "primary_language", "created_at", "updated_at",
            "open_issues", "license", "topics"
        ],
        "how_to_use": "Query by company GitHub org/repo URL from startup data",
    }
    
    print(f"  ✓ GitHub data structure defined")
    return github_data


def collect_web_traffic() -> Dict:
    """
    Collect web traffic data structure.
    """
    print("[4/8] Collecting web traffic data structure...")
    
    traffic_data = {
        "source": "similarweb.com (free tier) / app stores",
        "description": "Website and app traffic estimates",
        "data_type": "web_traffic",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "note": "Similarweb free tier limited. App Store/Play Store stats available.",
        "free_alternatives": [
            "App Annie (Sensor Tower) - limited free tier",
            "App Store rankings - via RSS or scraping",
            "Google Trends - for search volume",
            "BuiltWith - technology stack lookup"
        ],
        "fields_available": [
            "domain", "monthly_visits", "bounce_rate", 
            "page_views", "top_countries", "top_referrals"
        ],
    }
    
    print(f"  ✓ Web traffic data structure defined")
    return traffic_data


def collect_market_context() -> Dict:
    """
    Collect market context features (sector multiples, interest rates, etc.)
    """
    print("[5/8] Collecting market context data...")
    
    # Free market data from FRED, World Bank, SEBI, NSE
    
    market_data = {
        "source": "fred.stlouisfed.org, data.worldbank.org, nseindia.com",
        "description": "Macro and market context features",
        "data_type": "market_context",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "free_data_sources": {
            "interest_rates": "FRED API - Federal Reserve Economic Data",
            "gdp_growth": "World Bank API",
            "nse_indices": "NSE India - National Stock Exchange",
            "bse_sectors": "BSE India - Bombay Stock Exchange",
            "india_vc_trends": "IVCA reports, YourStory funding reports"
        },
        "fields_available": [
            "repo_rate", "gdp_growth_rate", "sensex_nifty",
            "sector_pe_ratios", "vc_funding_volume", "deal_count"
        ],
    }
    
    print(f"  ✓ Market context data structure defined")
    return market_data


def collect_team_signals() -> Dict:
    """
    Collect team quality signals structure.
    """
    print("[6/8] Collecting team signals data structure...")
    
    team_data = {
        "source": "linkedin.com, crunchbase, manual research",
        "description": "Founder and team quality signals",
        "data_type": "team_signals",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "note": "Requires manual research or paid LinkedIn API",
        "fields_collectable": [
            "founder_names", "linkedin_profiles", "prior_exits",
            "education", "work_experience", "domain_expertise",
            "team_size", "advisor_board"
        ],
        "how_to_get": "Manual research, LinkedIn Sales Navigator, or paid APIs",
    }
    
    print(f"  ✓ Team signals data structure defined")
    return team_data


def collect_survival_outcomes() -> Dict:
    """
    Collect survival/outcome labels structure.
    """
    print("[7/8] Collecting survival/outcome data structure...")
    
    outcome_data = {
        "source": "news datasets, MCA status changes, CB Insights",
        "description": "Startup outcome labels (shutdown, unicorn, acqui-hire, etc.)",
        "data_type": "survival_outcomes",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "free_sources": [
            "News API - for funding/death announcements",
            "MCA ROC filings - for company status changes",
            "Wikipedia - unicorn lists",
            "YourStory - startup news archive"
        ],
        "outcome_types": [
            "active", "shutdown", "acquired", "acqui_hired", 
            "ipo", "unicorn", "decacorn", "down_round", "flat_round"
        ],
    }
    
    print(f"  ✓ Survival/outcome data structure defined")
    return outcome_data


def collect_india_policy() -> Dict:
    """
    Collect India-specific policy markers.
    """
    print("[8/8] Collecting India policy data...")
    
    policy_data = {
        "source": "dpiit.gov.in, gst.gov.in, sebi.gov.in",
        "description": "India-specific policy and compliance markers",
        "data_type": "india_policy",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "data_sources": {
            "dpiit_startups": "DPIIT recognized startup list (free download)",
            "gst_filing": "GST filing regularity (paid APIs)",
            "sebi_filings": "SEBI disclosures for listed startups",
            "startup_india": "Startup India portal database"
        },
        "fields_available": [
            "dpiit_recognition", "gst_filing_status", 
            "patent_count", "seed_fund_eligibility"
        ],
    }
    
    print(f"  ✓ India policy data structure defined")
    return policy_data


def create_enriched_startup_template() -> Dict:
    """
    Create the template for enriched startup records.
    """
    print("\n[+] Creating enriched startup template...")
    
    template = {
        "template_version": "1.0",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "fields": {
            # Core (already have)
            "startup_name": "string",
            "total_funding_usd": "float",
            "valuation_usd": "float",
            "company_age_years": "int",
            "employees": "int",
            
            # NEW: Funding round details
            "funding_rounds": [
                {
                    "round_type": "seed|series_a|...",
                    "amount_usd": "float",
                    "date": "YYYY-MM-DD",
                    "lead_investor": "string",
                    "all_investors": ["string"],
                    "pre_money": "float",
                    "post_money": "float"
                }
            ],
            
            # NEW: Financial fundamentals
            "financials": {
                "annual_revenue_usd": "float",
                "revenue_growth_yoy": "float",
                "burn_rate_usd_monthly": "float",
                "runway_months": "int",
                "gross_margin_pct": "float"
            },
            
            # NEW: GitHub velocity
            "github": {
                "repo_url": "string",
                "stars": "int",
                "forks": "int",
                "contributors": "int",
                "primary_language": "string",
                "last_commit": "date"
            },
            
            # NEW: Web traffic
            "web_traffic": {
                "monthly_visits": "int",
                "bounce_rate": "float",
                "top_country": "string"
            },
            
            # NEW: Team signals
            "team": {
                "founder_count": "int",
                "founder_exits": "int",
                "advisors": ["string"],
                "avg_founder_experience_years": "float"
            },
            
            # NEW: Market context
            "market": {
                "sector_pe_ratio": "float",
                "funding_climate": "bullish|neutral|bearish",
                "competitor_count": "int"
            },
            
            # NEW: Outcomes
            "outcome": {
                "status": "active|shutdown|acquired|unicorn",
                "last_funding_date": "date",
                "down_round": "bool"
            },
            
            # NEW: India policy
            "india": {
                "dpiit_recognized": "bool",
                "patent_count": "int",
                "gst_compliant": "bool"
            }
        }
    }
    
    print(f"  ✓ Template created with {len(template['fields'])} field groups")
    return template


def main():
    print("\n" + "=" * 60)
    print("  IntelliStake — External Data Collector")
    print("  Collecting data source structures and templates")
    print("=" * 60 + "\n")
    
    # Collect all data source structures
    data_sources = {}
    
    data_sources["mca_filings"] = collect_mca_filings()
    data_sources["funding_data"] = collect_crunchbase_free()
    data_sources["github_velocity"] = collect_github_velocity()
    data_sources["web_traffic"] = collect_web_traffic()
    data_sources["market_context"] = collect_market_context()
    data_sources["team_signals"] = collect_team_signals()
    data_sources["survival_outcomes"] = collect_survival_outcomes()
    data_sources["india_policy"] = collect_india_policy()
    data_sources["enriched_template"] = create_enriched_startup_template()
    
    # Save all data source structures
    output_file = EXTERNAL_DIR / "data_sources.json"
    with open(output_file, "w") as f:
        json.dump(data_sources, f, indent=2)
    
    print(f"\n  ✓ All data sources saved → {output_file}")
    
    # Create a summary of what's available vs what needs collection
    summary = {
        "collection_date": datetime.now(timezone.utc).isoformat(),
        "data_sources": {
            "ready_to_collect": [
                "GitHub velocity (free API)",
                "Market context (FRED, World Bank free APIs)",
                "MCA company master (partial free)"
            ],
            "requires_paid_access": [
                "Crunchbase full data",
                "PitchBook/Tracxn",
                "Similarweb traffic",
                "Sensor Tower app data",
                "LinkedIn team data"
            ],
            "requires_manual_research": [
                "Founder backgrounds",
                "Prior exits",
                "Detailed financials"
            ]
        },
        "priority_order": [
            "1. GitHub velocity (free, high impact)",
            "2. Market context features (free, medium impact)",
            "3. Funding round details (partial free, high impact)",
            "4. Team signals (manual/paid, medium impact)",
            "5. Financial fundamentals (paid, high impact)"
        ]
    }
    
    summary_file = EXTERNAL_DIR / "collection_summary.json"
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"  ✓ Summary saved → {summary_file}")
    
    print("\n" + "=" * 60)
    print("  DATA COLLECTION GUIDE")
    print("=" * 60)
    print("""
To actually collect the data and improve R²:

1. GITHUB VELOCITY (Free, High Impact)
   → Run: python engine/collect_github_data.py
   → Uses free GitHub API to fetch repo metrics

2. MARKET CONTEXT (Free, Medium Impact)  
   → Run: python engine/collect_market_data.py
   → Uses FRED, World Bank free APIs

3. FUNDING DATA (Partial Free)
   → Your existing data has 32,461 rows from crunchbase_vc
   → Already in: intellistake_startups_clean.json

4. FOR BETTER DATA (Paid):
   → Crunchbase (~$30/mo for startup tier)
   → PitchBook (~$50/mo for education)
   → Tofler (~$20/mo for India private co)
   → Similarweb (~$100/mo for traffic)

5. MANUAL ENRICHMENT:
   → Founder LinkedIn research
   → Company news monitoring
   → ROC filing checks
""")
    
    return data_sources


if __name__ == "__main__":
    main()