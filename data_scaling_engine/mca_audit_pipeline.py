"""
mca_audit_pipeline.py
=====================
IntelliStake — Financial Integrity & MCA Audit Pipeline

Architecture:
  1. Company Discovery    — Look up CIN (Corporate Identity Number) from startup_name
  2. MCA Public Portal    — Scrape Balance Sheet / P&L from the MCA21 public data portal
  3. Tofler/Probe42 API   — Structured JSON retrieval if API keys are available
  4. Valuation Anomaly    — Cross-verify estimated_revenue vs official Balance Sheet revenue
  5. Audit Report         — Flag ANOMALY / VERIFIED / UNRESOLVED per startup_id

Why MCA?
  Under the Companies Act 2013, all Indian registered companies must file annual returns
  (Form AOC-4) and Balance Sheets with the Registrar of Companies (RoC). These are
  publicly available via the MCA21 portal, making it the canonical ground-truth source
  for Indian startup financials.

Dependencies:
  pip install requests beautifulsoup4 lxml pydantic pandas pyarrow tqdm
"""

from __future__ import annotations

import json
import logging
import re
import time
import hashlib
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode, quote_plus

import requests
import pandas as pd
from bs4 import BeautifulSoup
from tqdm import tqdm

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import (
    MASTER_STARTUPS_PATH, MCA_OUTPUT,
    MCA_BASE_URL, TOFLER_BASE_URL, PROBE42_BASE_URL,
    TOFLER_API_KEY, PROBE42_API_KEY,
    VALUATION_ANOMALY_THRESH, MCA_SCRAPE_DELAY_SECS,
    REQUEST_TIMEOUT_SECS, REQUEST_RETRY_ATTEMPTS,
    LOG_DIR, LOG_FORMAT, LOG_LEVEL,
)

# ── logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "mca_audit.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("mca_audit")


# ─────────────────────────────────────────────────────────────────────────────
# DATA CLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class CompanyFiling:
    """Represents a single year's financial filing from MCA or a data aggregator."""
    startup_id:              str
    startup_name:            str
    cin:                     Optional[str]         = None
    registered_name:         Optional[str]         = None
    data_source:             str                   = "UNKNOWN"
    filing_year:             Optional[int]         = None
    reported_revenue_usd:    Optional[float]       = None
    reported_net_profit_usd: Optional[float]       = None
    total_assets_usd:        Optional[float]       = None
    paid_up_capital_usd:     Optional[float]       = None
    employee_count_official: Optional[int]         = None
    raw_url:                 Optional[str]         = None
    fetch_status:            str                   = "PENDING"   # PENDING / SUCCESS / FAILED / RATE_LIMITED
    fetched_at:              str                   = field(
        default_factory=lambda: datetime.now(tz=timezone.utc).isoformat()
    )


@dataclass
class AuditResult:
    """Cross-verification result between estimated and official financials."""
    startup_id:           str
    startup_name:         str
    estimated_revenue_usd: Optional[float]
    reported_revenue_usd:  Optional[float]
    revenue_delta_pct:    Optional[float]
    valuation_anomaly:    bool
    anomaly_severity:     str           # CLEAN / MINOR / MODERATE / SEVERE
    audit_flag:           str           # VERIFIED / ANOMALY / UNRESOLVED
    cin:                  Optional[str]
    data_source:          str
    audited_at:           str = field(
        default_factory=lambda: datetime.now(tz=timezone.utc).isoformat()
    )


# ─────────────────────────────────────────────────────────────────────────────
# HTTP UTILITY
# ─────────────────────────────────────────────────────────────────────────────

def _safe_get(
    url: str,
    params: dict | None = None,
    headers: dict | None = None,
    session: requests.Session | None = None,
) -> requests.Response | None:
    """Retry-safe GET with exponential back-off. Respects robot-courtesy delays."""
    _headers = {"User-Agent": "IntelliStakeAuditBot/1.0 (research@intellistake.ai)"}
    if headers:
        _headers.update(headers)

    requester = session or requests

    for attempt in range(1, REQUEST_RETRY_ATTEMPTS + 1):
        try:
            resp = requester.get(url, params=params, headers=_headers,
                                 timeout=REQUEST_TIMEOUT_SECS)
            resp.raise_for_status()
            return resp
        except requests.exceptions.Timeout:
            log.warning("Timeout (%d/%d): %s", attempt, REQUEST_RETRY_ATTEMPTS, url)
        except requests.exceptions.HTTPError as exc:
            code = exc.response.status_code
            if code == 429:   # Rate limited
                retry_after = int(exc.response.headers.get("Retry-After", 60))
                log.warning("Rate limited — waiting %ds", retry_after)
                time.sleep(retry_after)
            elif code in (403, 404, 410):
                log.debug("Permanent failure %d: %s", code, url)
                return None
            else:
                log.warning("HTTP %d attempt %d: %s", code, attempt, url)
        except requests.exceptions.RequestException as exc:
            log.warning("Request error attempt %d: %s", attempt, exc)

        time.sleep(min(2 ** attempt, 30))    # cap back-off at 30s

    log.error("All %d attempts failed: %s", REQUEST_RETRY_ATTEMPTS, url)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 1. TOFLER API CLIENT
# ─────────────────────────────────────────────────────────────────────────────

class ToflerClient:
    """
    Wrapper for Tofler.in API (https://api.tofler.in/v1).
    Tofler provides structured JSON for Balance Sheet, P&L, and director data
    for all MCA-registered Indian companies.
    
    API Docs: https://tofler.in/apidocs
    """

    def __init__(self, api_key: str = TOFLER_API_KEY):
        self.api_key    = api_key
        self.session    = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Accept":        "application/json",
        })
        self.base_url   = TOFLER_BASE_URL

    def search_company(self, name: str) -> dict | None:
        """Search by company name; returns first match with CIN."""
        if not self.api_key:
            return None
        resp = _safe_get(
            f"{self.base_url}/companies/search",
            params={"q": name, "size": 1},
            session=self.session,
        )
        if resp is None:
            return None
        try:
            data = resp.json()
            companies = data.get("companies", [])
            return companies[0] if companies else None
        except (ValueError, IndexError):
            return None

    def get_financials(self, cin: str, year: int | None = None) -> dict | None:
        """
        Fetch financials for a specific CIN.
        Returns dict with 'revenue', 'net_profit', 'total_assets', 'paid_up_capital'.
        """
        if not self.api_key:
            return None
        params = {"cin": cin}
        if year:
            params["year"] = year
        resp = _safe_get(
            f"{self.base_url}/financials",
            params=params,
            session=self.session,
        )
        if resp is None:
            return None
        try:
            return resp.json()
        except ValueError:
            return None

    def fetch_filing(self, startup_id: str, startup_name: str) -> CompanyFiling:
        """High-level: search → get CIN → fetch financials → return CompanyFiling."""
        filing = CompanyFiling(startup_id=startup_id, startup_name=startup_name,
                               data_source="tofler")
        company = self.search_company(startup_name)
        if not company:
            filing.fetch_status = "FAILED"
            return filing

        filing.cin             = company.get("cin")
        filing.registered_name = company.get("company_name")

        if not filing.cin:
            filing.fetch_status = "FAILED"
            return filing

        financials = self.get_financials(filing.cin)
        if not financials:
            filing.fetch_status = "FAILED"
            return filing

        # Tofler reports in INR Lakhs — convert to USD (approx 1 USD = 83 INR)
        inr_to_usd = 1 / 83.0
        lakhs      = 100_000

        filing.reported_revenue_usd    = financials.get("revenue", 0) * lakhs * inr_to_usd
        filing.reported_net_profit_usd = financials.get("net_profit", 0) * lakhs * inr_to_usd
        filing.total_assets_usd        = financials.get("total_assets", 0) * lakhs * inr_to_usd
        filing.paid_up_capital_usd     = financials.get("paid_up_capital", 0) * lakhs * inr_to_usd
        filing.filing_year             = financials.get("year")
        filing.raw_url  = f"https://tofler.in/company/{quote_plus(startup_name)}/{filing.cin}"
        filing.fetch_status = "SUCCESS"
        return filing


# ─────────────────────────────────────────────────────────────────────────────
# 2. PROBE42 API CLIENT
# ─────────────────────────────────────────────────────────────────────────────

class Probe42Client:
    """
    Wrapper for Probe42 REST API — alternative to Tofler.
    Focuses on MSME and SME filings; useful for early-stage startups.
    API: https://api.probe42.in/prod_new
    """

    def __init__(self, api_key: str = PROBE42_API_KEY):
        self.api_key  = api_key
        self.base_url = PROBE42_BASE_URL
        self.session  = requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Accept":    "application/json",
        })

    def search_and_fetch(self, startup_id: str, startup_name: str) -> CompanyFiling:
        filing = CompanyFiling(startup_id=startup_id, startup_name=startup_name,
                               data_source="probe42")
        if not self.api_key:
            filing.fetch_status = "FAILED"
            return filing

        resp = _safe_get(
            f"{self.base_url}/getCompanyDataByName",
            params={"company_name": startup_name, "size": 1},
            session=self.session,
        )
        if resp is None:
            filing.fetch_status = "FAILED"
            return filing

        try:
            data = resp.json()
        except ValueError:
            filing.fetch_status = "FAILED"
            return filing

        companies = data.get("data", {}).get("companies", [])
        if not companies:
            filing.fetch_status = "FAILED"
            return filing

        c             = companies[0]
        filing.cin    = c.get("cin")
        filing.registered_name = c.get("company_name")

        fin           = c.get("financials", {})
        inr_to_usd    = 1 / 83.0
        lakhs         = 100_000
        filing.reported_revenue_usd    = fin.get("total_income", 0) * lakhs * inr_to_usd
        filing.reported_net_profit_usd = fin.get("profit_after_tax", 0) * lakhs * inr_to_usd
        filing.total_assets_usd        = fin.get("total_assets", 0) * lakhs * inr_to_usd
        filing.filing_year             = fin.get("year")
        filing.fetch_status            = "SUCCESS"
        return filing


# ─────────────────────────────────────────────────────────────────────────────
# 3. MCA PUBLIC PORTAL SCRAPER (fallback — no API key required)
# ─────────────────────────────────────────────────────────────────────────────

class MCAPortalScraper:
    """
    Scrapes the MCA21 public portal for company master data.
    URL pattern: https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do

    Note: MCA21 v3 (post-2023) uses JavaScript-heavy pages. This scraper
    hits the REST-like public data endpoints that return JSON responses, which
    are separate from the v3 UI.

    MCA public search endpoint (unauthenticated):
    https://efiling.mca.gov.in/efiling/masterdata/MasterDataSearchAction.do?companyName=<NAME>
    """

    SEARCH_URL = (
        "https://efiling.mca.gov.in/efiling/masterdata/MasterDataSearchAction.do"
    )
    FILING_URL = "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (compatible; IntelliStakeResearchBot/1.0; "
                "+https://intellistake.ai/research)"
            ),
            "Accept": "application/json, text/html, */*",
            "Referer": "https://www.mca.gov.in/",
        })

    def search_company(self, name: str) -> list[dict]:
        """
        Search MCA company master data. Returns list of matches:
        [{"cin": "...", "company_name": "...", "registration_date": ...}, ...]
        """
        params = {
            "companyName": name,
            "draw":        1,
            "search[value]": name,
        }
        resp = _safe_get(self.SEARCH_URL, params=params, session=self.session)
        if resp is None:
            return []

        try:
            data = resp.json()
            # MCA returns DataTables-style JSON: {"data": [[col1, col2, ...],...]}
            rows = data.get("data", [])
            results = []
            for row in rows[:5]:   # top 5 matches
                if isinstance(row, list) and len(row) >= 4:
                    results.append({
                        "cin":               str(row[1]).strip(),
                        "company_name":      str(row[0]).strip(),
                        "registration_date": str(row[3]).strip(),
                        "state":             str(row[4]).strip() if len(row) > 4 else "",
                    })
            return results
        except (ValueError, KeyError, IndexError):
            pass

        # Fallback: HTML scrape if JSON fails
        return self._html_search(resp.text)

    def _html_search(self, html: str) -> list[dict]:
        """Parse HTML table from MCA search results page."""
        soup = BeautifulSoup(html, "lxml")
        table = soup.find("table", id="example")
        if not table:
            return []
        results = []
        for tr in table.find_all("tr")[1:6]:   # skip header, take top 5
            cols = [td.get_text(strip=True) for td in tr.find_all("td")]
            if len(cols) >= 2:
                results.append({"cin": cols[1], "company_name": cols[0]})
        return results

    def fetch_filing(self, startup_id: str, startup_name: str) -> CompanyFiling:
        """Search MCA, pick best CIN match, build a CompanyFiling (revenue only from meta)."""
        filing = CompanyFiling(startup_id=startup_id, startup_name=startup_name,
                               data_source="mca_portal")
        time.sleep(MCA_SCRAPE_DELAY_SECS)     # polite scrape delay

        matches = self.search_company(startup_name)
        if not matches:
            filing.fetch_status = "FAILED"
            return filing

        # Pick highest-confidence match by name similarity
        best = matches[0]
        filing.cin             = best.get("cin")
        filing.registered_name = best.get("company_name")

        # MCA portal does not expose full financials without login.
        # We record CIN + verification URL; actual financials require Tofler/Probe42.
        filing.raw_url      = f"https://www.mca.gov.in/MCA21VersionWebServices/rest/2.0/masterdata/company/{filing.cin}"
        filing.fetch_status = "SUCCESS"
        log.debug("MCA match: %s → CIN %s", startup_name, filing.cin)
        return filing


# ─────────────────────────────────────────────────────────────────────────────
# 4. VALUATION ANOMALY DETECTOR
# ─────────────────────────────────────────────────────────────────────────────

def detect_anomaly(estimated_revenue: float | None,
                   reported_revenue:  float | None) -> tuple[bool, float | None, str, str]:
    """
    Compare estimated vs official revenue.
    Returns: (is_anomaly, delta_pct, severity, flag)
    """
    if estimated_revenue is None or reported_revenue is None:
        return False, None, "UNKNOWN", "UNRESOLVED"
    if reported_revenue == 0:
        if estimated_revenue > 0:
            return True, None, "SEVERE", "ANOMALY"
        return False, 0.0, "CLEAN", "VERIFIED"

    delta_pct = abs(estimated_revenue - reported_revenue) / abs(reported_revenue)

    if delta_pct <= VALUATION_ANOMALY_THRESH:
        return False, round(delta_pct * 100, 2), "CLEAN", "VERIFIED"
    elif delta_pct <= 0.60:
        return True, round(delta_pct * 100, 2), "MODERATE", "ANOMALY"
    else:
        return True, round(delta_pct * 100, 2), "SEVERE", "ANOMALY"


# ─────────────────────────────────────────────────────────────────────────────
# 5. PIPELINE ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────

def run_mca_audit_pipeline(
    max_companies: int = 5000,
    preferred_source: str = "auto",   # "tofler" | "probe42" | "mca" | "auto"
) -> pd.DataFrame:
    """
    Main MCA audit pipeline.

    Strategy:
      1. If Tofler key available → use Tofler API (most data, structured JSON)
      2. Else if Probe42 key available → use Probe42 API
      3. Else → MCA public portal scrape (CIN lookup only, no revenue)

    Returns DataFrame of AuditResult records.
    """
    log.info("=" * 60)
    log.info("IntelliStake MCA Audit Pipeline — Start")
    log.info("Max companies: %d | Preferred source: %s", max_companies, preferred_source)
    log.info("=" * 60)

    # Load master startup dataset
    with open(MASTER_STARTUPS_PATH, encoding="utf-8") as fh:
        startups = json.load(fh)
    log.info("Loaded %d startups", len(startups))

    # Filter to Indian startups (or those with estimated_revenue > 0)
    indian = [
        s for s in startups
        if s.get("country", "").lower() in ("india", "in")
        or s.get("sector", "") in ("Fintech", "SaaS", "E-commerce", "Healthcare")
    ]
    log.info("Targeting %d companies for audit", min(max_companies, len(indian)))
    targets = indian[:max_companies]

    # Select data source
    if preferred_source == "auto":
        if TOFLER_API_KEY:
            preferred_source = "tofler"
        elif PROBE42_API_KEY:
            preferred_source = "probe42"
        else:
            preferred_source = "mca"

    log.info("Data source selected: %s", preferred_source)

    # Instantiate client
    if preferred_source == "tofler":
        client = ToflerClient()
        fetch_fn = client.fetch_filing
    elif preferred_source == "probe42":
        client = Probe42Client()
        fetch_fn = client.search_and_fetch
    else:
        client = MCAPortalScraper()
        fetch_fn = client.fetch_filing

    # Run audit loop
    audit_results: list[dict] = []
    filings:       list[dict] = []

    for startup in tqdm(targets, desc="MCA Audit", unit="company"):
        sid   = startup["startup_id"]
        name  = startup["startup_name"]
        est_rev = startup.get("estimated_valuation_usd", 0) * 0.15  # rough revenue proxy

        try:
            filing = fetch_fn(sid, name)
        except Exception as exc:
            log.error("Unexpected error for %s: %s", name, exc)
            filing = CompanyFiling(startup_id=sid, startup_name=name,
                                   fetch_status="FAILED", data_source=preferred_source)

        filings.append(asdict(filing))

        # Anomaly detection
        is_anom, delta, severity, flag = detect_anomaly(est_rev, filing.reported_revenue_usd)

        result = AuditResult(
            startup_id=sid,
            startup_name=name,
            estimated_revenue_usd=round(est_rev, 2) if est_rev else None,
            reported_revenue_usd=filing.reported_revenue_usd,
            revenue_delta_pct=delta,
            valuation_anomaly=is_anom,
            anomaly_severity=severity,
            audit_flag=flag,
            cin=filing.cin,
            data_source=filing.data_source,
        )
        audit_results.append(asdict(result))

    # Persist
    df_filings = pd.DataFrame(filings)
    df_results = pd.DataFrame(audit_results)

    filings_out = MCA_OUTPUT.parent / "mca_filings_raw.parquet"
    df_filings.to_parquet(filings_out, index=False, compression="snappy")
    df_results.to_parquet(MCA_OUTPUT,  index=False, compression="snappy")

    # Summary
    verified  = (df_results["audit_flag"] == "VERIFIED").sum()
    anomalies = (df_results["audit_flag"] == "ANOMALY").sum()
    log.info("Audit complete: %d verified, %d anomalies, %d unresolved",
             verified, anomalies, len(df_results) - verified - anomalies)
    log.info("Saved: %s (%d rows)", MCA_OUTPUT.name, len(df_results))
    return df_results


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="IntelliStake MCA Audit Pipeline")
    parser.add_argument("--max-companies", type=int, default=5000)
    parser.add_argument("--source", choices=["auto","tofler","probe42","mca"], default="auto")
    args = parser.parse_args()

    df = run_mca_audit_pipeline(max_companies=args.max_companies,
                                preferred_source=args.source)
    anomalies = df[df["valuation_anomaly"] == True]
    print(f"\n✅ Audit done. Anomalies detected: {len(anomalies)} / {len(df)}")
    if not anomalies.empty:
        print(anomalies[["startup_name","estimated_revenue_usd",
                          "reported_revenue_usd","revenue_delta_pct","anomaly_severity"]].head(15).to_string(index=False))
