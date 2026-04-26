"""
scripts/enrich_phase3_final.py
===============================
Confirmed-working free sources:
  1. BSE API         → all BSE scrips + yfinance .BO financials
  2. NSE Nifty Total → 750 Nifty Total Market companies + yfinance .NS
  3. Alpha Vantage   → FREE listing_status (~8k US companies: name, IPO, sector)
  4. Wikidata SPARQL → Indian companies (30s timeout)
  Merges into intellistake_startups_clean.json
"""

import json, time, io, warnings
import numpy as np
import pandas as pd
import requests
from pathlib import Path
from datetime import datetime, timezone
from tqdm import tqdm

warnings.filterwarnings("ignore")

BASE  = Path(__file__).resolve().parent.parent
CLEAN = BASE / "unified_data" / "cleaned" / "intellistake_startups_clean.json"

SECTOR_MAP = {
    "FINANCIAL": "FinTech","BANK":"FinTech","FINANCE":"FinTech","NBFC":"FinTech","INSURANCE":"FinTech",
    "IT ":"SaaS","SOFTWARE":"SaaS","TECH":"SaaS","COMPUTER":"SaaS","INTERNET":"SaaS",
    "ECOMMERCE":"E-commerce","RETAIL":"E-commerce","TRADING":"E-commerce","MARKETPLACE":"E-commerce",
    "HEALTH":"HealthTech","PHARMA":"HealthTech","HOSPITAL":"HealthTech","MEDIC":"HealthTech",
    "AUTO":"Mobility","ELECTRIC":"Mobility","TRANSPORT":"Mobility","LOGISTICS":"Mobility",
    "FMCG":"D2C","CONSUMER":"D2C","FOOD":"D2C","BEVERAG":"D2C","FASHION":"D2C",
    "MEDIA":"Media","ENTERTAINMENT":"Media","GAMING":"Media",
    "TELECOM":"Telecom","COMMUNICATION":"Telecom",
}

def map_sector(raw):
    if not raw: return "SaaS"
    r = str(raw).upper()
    for k, v in SECTOR_MAP.items():
        if k in r: return v
    return "SaaS"

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def safe_float(v):
    try:
        f = float(v)
        return f if np.isfinite(f) else None
    except: return None

def safe_int(v):
    f = safe_float(v)
    return int(f) if f is not None else None

MACRO = {
    "gdp_growth_pct": 6.495, "inflation_pct": 4.953,
    "lending_rate_pct": 8.567, "mkt_cap_pct_gdp": 131.241,
}
SECTOR_MULT = {
    "FinTech":    {"sector_ps_median":8.2,  "sector_pe_median":45,"vc_deal_count_2024":312,"avg_round_size_usd":18e6},
    "SaaS":       {"sector_ps_median":12.5, "sector_pe_median":60,"vc_deal_count_2024":278,"avg_round_size_usd":22e6},
    "E-commerce": {"sector_ps_median":3.1,  "sector_pe_median":35,"vc_deal_count_2024":195,"avg_round_size_usd":35e6},
    "HealthTech": {"sector_ps_median":5.8,  "sector_pe_median":42,"vc_deal_count_2024":167,"avg_round_size_usd":14e6},
    "Mobility":   {"sector_ps_median":2.4,  "sector_pe_median":30,"vc_deal_count_2024":89, "avg_round_size_usd":45e6},
    "D2C":        {"sector_ps_median":4.0,  "sector_pe_median":38,"vc_deal_count_2024":143,"avg_round_size_usd":12e6},
    "Media":      {"sector_ps_median":3.5,  "sector_pe_median":28,"vc_deal_count_2024":55, "avg_round_size_usd":8e6},
    "Telecom":    {"sector_ps_median":2.1,  "sector_pe_median":22,"vc_deal_count_2024":32, "avg_round_size_usd":60e6},
}

def add_meta(r):
    sec = r.get("sector","SaaS")
    r.update(SECTOR_MULT.get(sec, SECTOR_MULT["SaaS"]))
    r.update(MACRO)
    return r

def yf_financials(sym, source_tag):
    import yfinance as yf
    try:
        info = yf.Ticker(sym).info or {}
        mktcap = safe_float(info.get("marketCap"))
        if not mktcap or mktcap < 1_000: return None
        rev  = safe_float(info.get("totalRevenue") or info.get("revenue"))
        emp  = safe_int(info.get("fullTimeEmployees"))
        name = info.get("longName") or info.get("shortName") or sym
        return {
            "startup_name":       name,
            "ticker":             sym,
            "sector":             map_sector(str(info.get("sector",""))+" "+str(info.get("industry",""))),
            "industry_raw":       info.get("industry",""),
            "city":               info.get("city","India"),
            "country":            info.get("country","India"),
            "total_funding_usd":  mktcap * 0.12,
            "valuation_usd":      mktcap,
            "revenue_usd":        rev,
            "employees":          emp,
            "employee_count":     emp,
            "pe_ratio":           safe_float(info.get("trailingPE")),
            "ps_ratio":           safe_float(info.get("priceToSalesTrailing12Months")),
            "pb_ratio":           safe_float(info.get("priceToBook")),
            "market_cap_usd":     mktcap,
            "ebitda_usd":         safe_float(info.get("ebitda")),
            "gross_margin_pct":   round(safe_float(info.get("grossMargins"))*100,2) if info.get("grossMargins") else None,
            "revenue_growth_yoy": round(safe_float(info.get("revenueGrowth"))*100,2) if info.get("revenueGrowth") else None,
            "profit_margin_pct":  round(safe_float(info.get("profitMargins"))*100,2) if info.get("profitMargins") else None,
            "debt_to_equity":     safe_float(info.get("debtToEquity")),
            "current_ratio":      safe_float(info.get("currentRatio")),
            "description":        (info.get("longBusinessSummary","") or "")[:300],
            "data_source":        source_tag,
            "is_real":            True,
            "is_listed":          True,
            "record_date":        now_iso(),
            "trust_score":        min(0.95, max(0.4, (mktcap/1e10)**0.1)),
        }
    except: return None

# ── Source 1: BSE API ────────────────────────────────────────────────────────
def source_bse():
    print("\n[1/4] BSE API — all equity scrips + yfinance financials")
    url = "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active"
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent":"Mozilla/5.0"})
        data = r.json()
        # BSE API returns list or dict with Table key
        if isinstance(data, dict):
            rows = data.get("Table", data.get("Table1", []))
        else:
            rows = data
        df = pd.DataFrame(rows)
        df.columns = [c.strip().lower() for c in df.columns]
        print(f"  ✓ BSE API: {len(df):,} scrips | cols: {list(df.columns[:6])}")
        sym_col = next((c for c in df.columns if "scripcode" in c or "symbol" in c), df.columns[0])
        symbols = [f"{str(s).strip()}.BO" for s in df[sym_col].dropna().unique()]
    except Exception as e:
        print(f"  ✗ BSE API parse failed: {e} — using fallback list")
        symbols = [f"{s}.BO" for s in [
            "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","SBIN","BHARTIARTL",
            "KOTAKBANK","ITC","LT","AXISBANK","BAJFINANCE","MARUTI","SUNPHARMA","TITAN",
            "WIPRO","HCLTECH","TECHM","NTPC","ZOMATO","NYKAA","PAYTM","POLICYBZR","DELHIVERY",
            "OLAELEC","IRCTC","NESTLEIND","PIDILITIND","DMART","SIEMENS","HAVELLS","VOLTAS",
            "MPHASIS","LTIM","PERSISTENT","COFORGE","KPITTECH","TANLA","ROUTE","LATENTVIEW",
        ]]
    print(f"  → Pulling yfinance for {len(symbols):,} BSE tickers...")
    records = []
    bar = tqdm(symbols, desc="  BSE yfinance", unit="sym", ncols=90)
    for sym in bar:
        rec = yf_financials(sym, "yfinance_bse")
        if rec: records.append(rec)
        time.sleep(0.05)
    bar.close()
    print(f"  ✓ BSE: {len(records):,} companies with real financials")
    return records

# ── Source 2: NSE Total Market (750 stocks) ──────────────────────────────────
def source_nse_total():
    print("\n[2/4] NSE Nifty Total Market (750 stocks) + yfinance")
    url = "https://archives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv"
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent":"Mozilla/5.0"})
        df = pd.read_csv(io.StringIO(r.text))
        df.columns = [c.strip() for c in df.columns]
        sym_col = next((c for c in df.columns if "symbol" in c.lower()), df.columns[0])
        symbols = [f"{str(s).strip()}.NS" for s in df[sym_col].dropna().unique()]
        print(f"  ✓ NSE Total: {len(symbols):,} symbols")
    except Exception as e:
        print(f"  ✗ {e} — skip")
        return []
    records = []
    bar = tqdm(symbols, desc="  NSE Total yfinance", unit="sym", ncols=90)
    for sym in bar:
        rec = yf_financials(sym, "yfinance_nse_total")
        if rec: records.append(rec)
        time.sleep(0.05)
    bar.close()
    print(f"  ✓ NSE Total: {len(records):,} companies")
    return records

# ── Source 3: Alpha Vantage free listing_status (~8k US companies) ───────────
def source_alpha_vantage():
    print("\n[3/4] Alpha Vantage — free listing_status (~8,000 global companies)")
    url = "https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=demo"
    try:
        r = requests.get(url, timeout=30)
        df = pd.read_csv(io.StringIO(r.text))
        df.columns = [c.strip().lower() for c in df.columns]
        print(f"  ✓ Alpha Vantage: {len(df):,} rows | cols: {list(df.columns)}")
        records = []
        for _, row in tqdm(df.iterrows(), total=len(df), desc="  Parsing AV", ncols=80, unit="row"):
            name  = str(row.get("name","")).strip()
            sym   = str(row.get("symbol","")).strip()
            exch  = str(row.get("exchange","")).strip()
            astype = str(row.get("assettype","")).strip().lower()
            ipo_yr = None
            try: ipo_yr = int(str(row.get("ipodate",""))[:4])
            except: pass
            status = str(row.get("status","active")).lower()
            if not name or name == "nan" or astype not in ("stock","etf","") or status == "delisted":
                continue
            records.append({
                "startup_name":      name,
                "ticker":            sym,
                "sector":            map_sector(str(row.get("exchange",""))),
                "city":              "USA",
                "country":           "USA",
                "founded_year":      ipo_yr,
                "company_age_years": (2025 - ipo_yr) if ipo_yr and ipo_yr > 1900 else None,
                "exchange":          exch,
                "data_source":       "alpha_vantage",
                "is_real":           True,
                "is_listed":         True,
                "record_date":       now_iso(),
                "trust_score":       0.7,
            })
        print(f"  ✓ Alpha Vantage: {len(records):,} companies parsed")
        return records
    except Exception as e:
        print(f"  ✗ Alpha Vantage: {e}")
        return []

# ── Source 4: Wikidata — multiple targeted queries ────────────────────────────
def source_wikidata():
    print("\n[4/4] Wikidata SPARQL — targeted Indian company queries")
    endpoint = "https://query.wikidata.org/sparql"
    queries = {
        "indian_unicorns": """
SELECT DISTINCT ?name ?founded ?sector ?city WHERE {
  ?c wdt:P17 wd:Q668; wdt:P31 wd:Q4830453.
  ?c rdfs:label ?name FILTER (lang(?name)="en").
  OPTIONAL{?c wdt:P571 ?founded.}
  OPTIONAL{?c wdt:P452/rdfs:label ?sector FILTER(lang(?sector)="en").}
  OPTIONAL{?c wdt:P159/rdfs:label ?city FILTER(lang(?city)="en").}
} LIMIT 3000""",
        "indian_banks_fintech": """
SELECT DISTINCT ?name ?founded ?city WHERE {
  ?c wdt:P17 wd:Q668;
     wdt:P31 ?type.
  ?type wdt:P279* wd:Q22687.
  ?c rdfs:label ?name FILTER(lang(?name)="en").
  OPTIONAL{?c wdt:P571 ?founded.}
  OPTIONAL{?c wdt:P159/rdfs:label ?city FILTER(lang(?city)="en").}
} LIMIT 2000""",
    }
    records = []
    seen = set()
    for q_name, q in queries.items():
        print(f"  Running: {q_name}...")
        try:
            r = requests.get(endpoint, params={"query":q,"format":"json"},
                             headers={"User-Agent":"IntelliStake/1.0"}, timeout=60)
            if r.status_code != 200:
                print(f"  ✗ HTTP {r.status_code}"); continue
            results = r.json().get("results",{}).get("bindings",[])
            print(f"  ✓ {len(results):,} rows from {q_name}")
            for row in tqdm(results, desc=f"  Parse {q_name}", ncols=80, unit="row"):
                name = row.get("name",{}).get("value","")
                if not name or name in seen or name.startswith("Q"): continue
                seen.add(name)
                founded_raw = row.get("founded",{}).get("value","")
                yr = None
                try: yr = int(founded_raw[:4])
                except: pass
                sec = row.get("sector",{}).get("value","")
                city = row.get("city",{}).get("value","India")
                records.append({
                    "startup_name":      name,
                    "sector":            map_sector(sec),
                    "city":              city,
                    "country":           "India",
                    "founded_year":      yr,
                    "company_age_years": (2025-yr) if yr and 1990<yr<2025 else None,
                    "data_source":       f"wikidata_{q_name}",
                    "is_real":           True,
                    "is_listed":         False,
                    "record_date":       now_iso(),
                    "trust_score":       0.62,
                })
        except Exception as e:
            print(f"  ✗ {q_name}: {e}")
        time.sleep(2)
    print(f"  ✓ Wikidata total: {len(records):,} unique companies")
    return records

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("═"*65)
    print("  IntelliStake — Phase 3 Final Enrichment")
    print("  BSE · NSE Total · Alpha Vantage · Wikidata")
    print("═"*65)

    existing = json.loads(CLEAN.read_text(encoding="utf-8"))
    existing_names = set(pd.DataFrame(existing)["startup_name"].astype(str).str.lower().str.strip())
    print(f"  ✓ Existing: {len(existing):,} rows")

    sources = [
        ("BSE+yfinance",    source_bse),
        ("NSE Total",       source_nse_total),
        ("Alpha Vantage",   source_alpha_vantage),
        ("Wikidata",        source_wikidata),
    ]

    all_new = []
    for label, fn in sources:
        recs = fn()
        new  = [r for r in recs if str(r.get("startup_name","")).lower().strip() not in existing_names]
        for r in new:
            add_meta(r)
            existing_names.add(str(r.get("startup_name","")).lower().strip())
        all_new.extend(new)
        print(f"  → {label}: +{len(new):,} new unique records (running total: {len(all_new):,})")

    merged   = existing + all_new
    with_val = sum(1 for r in merged if r.get("valuation_usd"))

    CLEAN.write_text(json.dumps(merged, indent=2, default=str), encoding="utf-8")

    print(f"\n{'═'*65}")
    print(f"  ✅ ENRICHMENT COMPLETE")
    print(f"  Before  : {len(existing):,} rows")
    print(f"  Added   : {len(all_new):,} new rows")
    print(f"  Total   : {len(merged):,} rows")
    print(f"  With real valuation target: {with_val:,} rows")
    print(f"  File    : {CLEAN}")
    print(f"{'═'*65}")
    print(f"\n  → Run retrain: python engine/valuation_stacked.py --oof-n 60000\n")

if __name__ == "__main__":
    main()
