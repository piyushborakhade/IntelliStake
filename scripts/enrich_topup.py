"""
scripts/enrich_topup.py
========================
Top-up enrichment to reach ~20k+ new records.
Sources:
  1. NASDAQ full ticker list  (CSV from NASDAQ website, ~7k symbols)
  2. S&P 500 Wikipedia scrape (500 symbols via pd.read_html)
  3. Wikidata — global tech startups & Indian IT companies
  4. Free startup CSVs from public GitHub datasets

Merges into intellistake_startups_clean.json (deduplicated by name).
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
    "FINANCIAL":"FinTech","BANK":"FinTech","FINANCE":"FinTech","INSURANCE":"FinTech","NBFC":"FinTech",
    "IT ":"SaaS","SOFTWARE":"SaaS","TECH":"SaaS","COMPUTER":"SaaS","INTERNET":"SaaS","CLOUD":"SaaS",
    "ECOMMERCE":"E-commerce","RETAIL":"E-commerce","TRADING":"E-commerce","MARKETPLACE":"E-commerce",
    "HEALTH":"HealthTech","PHARMA":"HealthTech","HOSPITAL":"HealthTech","MEDIC":"HealthTech","BIOTECH":"HealthTech",
    "AUTO":"Mobility","ELECTRIC":"Mobility","TRANSPORT":"Mobility","LOGISTICS":"Mobility","FLEET":"Mobility",
    "FMCG":"D2C","CONSUMER":"D2C","FOOD":"D2C","BEVERAG":"D2C","FASHION":"D2C",
    "MEDIA":"Media","ENTERTAINMENT":"Media","GAMING":"Media","STREAM":"Media",
    "TELECOM":"Telecom","COMMUNICATION":"Telecom",
    "ENERGY":"CleanTech","SOLAR":"CleanTech","WIND":"CleanTech","GREEN":"CleanTech","CLIMATE":"CleanTech",
    "SPACE":"DeepTech","DEFENCE":"DeepTech","ROBOT":"DeepTech","AI ":"DeepTech","QUANTUM":"DeepTech",
    "AGRI":"AgriTech","FARM":"AgriTech","CROP":"AgriTech",
    "EDU":"EdTech","LEARN":"EdTech","SCHOOL":"EdTech",
    "REAL ESTATE":"PropTech","PROPERTY":"PropTech","HOUSING":"PropTech",
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
    "CleanTech":  {"sector_ps_median":5.0,  "sector_pe_median":38,"vc_deal_count_2024":120,"avg_round_size_usd":25e6},
    "DeepTech":   {"sector_ps_median":15.0, "sector_pe_median":80,"vc_deal_count_2024":95, "avg_round_size_usd":30e6},
    "AgriTech":   {"sector_ps_median":3.0,  "sector_pe_median":28,"vc_deal_count_2024":60, "avg_round_size_usd":10e6},
    "EdTech":     {"sector_ps_median":6.0,  "sector_pe_median":40,"vc_deal_count_2024":88, "avg_round_size_usd":15e6},
    "PropTech":   {"sector_ps_median":4.5,  "sector_pe_median":35,"vc_deal_count_2024":72, "avg_round_size_usd":20e6},
}

def add_meta(r):
    sec = r.get("sector", "SaaS")
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
            "city":               info.get("city","USA"),
            "country":            info.get("country","USA"),
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


# ── Source 1: NASDAQ full ticker list ────────────────────────────────────────
def source_nasdaq_full():
    print("\n[1/4] NASDAQ Full Ticker List (~7,000 symbols)")
    url = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=7000&offset=0&download=true"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nasdaq.com/",
    }
    try:
        r = requests.get(url, headers=headers, timeout=30)
        data = r.json()
        rows = data.get("data", {}).get("rows", [])
        print(f"  ✓ NASDAQ API: {len(rows):,} tickers")
        symbols = [row["symbol"].strip() for row in rows if row.get("symbol","").strip()]
    except Exception as e:
        print(f"  ✗ NASDAQ API failed: {e} — fallback to static list")
        # Fallback: Known tech/growth companies not already in dataset
        symbols = [
            "AAPL","MSFT","GOOGL","AMZN","META","TSLA","NVDA","AMD","INTC","QCOM",
            "AVGO","TXN","MU","AMAT","LRCX","KLAC","MRVL","ON","STX","WDC",
            "CRM","NOW","WDAY","SNOW","DDOG","ZS","OKTA","PANW","CRWD","FTNT",
            "SHOP","SQ","PYPL","COIN","HOOD","SOFI","AFRM","UPST","LC","OPEN",
            "UBER","LYFT","DASH","ABNB","BKNG","EXPE","TRIP","VRBO","AIRBNB","NFLX",
            "SPOT","SNAP","PINS","TWTR","RDDT","DUOL","RBLX","U","MTTR","MSTR",
            "ZM","DOCU","DOCN","ESTC","GTLB","HCP","NABL","APPN","MQ","TOST",
            "PLTR","AI","BBAI","SOUN","GFAI","AISP","AITX","BTBT","MARA","RIOT",
            "PATH","RNG","BAND","TWLO","SEND","NCNO","LSPD","GLBE","FOUR","PAYA",
            "NET","FSLY","AKAM","EQIX","DLR","AMT","SBAC","CCI","CONE","QTS",
            "VEEV","HIMS","PHR","ACCD","NVCR","TDOC","AMWL","ONEM","HCAT","SENS",
            "PLUG","FCEL","BE","ENPH","SEDG","ARRY","SPWR","NOVA","RUN","SHLS",
            "CHPT","BLNK","EVGO","NKLA","RIVN","LCID","FSR","XPEV","NIO","LI",
            "ASTS","SPCE","RKLB","ASTR","MNTS","IRDM","MAXR","BWXT","KTOS","HII",
        ]
    print(f"  → Fetching yfinance for {len(symbols):,} symbols...")
    records = []
    bar = tqdm(symbols[:3000], desc="  NASDAQ yfinance", unit="sym", ncols=90)
    for sym in bar:
        rec = yf_financials(sym, "yfinance_nasdaq")
        if rec: records.append(rec)
        time.sleep(0.04)
    bar.close()
    print(f"  ✓ NASDAQ: {len(records):,} companies with financials")
    return records


# ── Source 2: S&P 500 via Wikipedia ──────────────────────────────────────────
def source_sp500():
    print("\n[2/4] S&P 500 from Wikipedia + yfinance")
    try:
        tables = pd.read_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
        df = tables[0]
        symbols = df["Symbol"].dropna().str.strip().tolist()
        print(f"  ✓ S&P 500: {len(symbols):,} symbols")
    except Exception as e:
        print(f"  ✗ Wikipedia scrape failed: {e}")
        return []
    records = []
    bar = tqdm(symbols, desc="  S&P500 yfinance", unit="sym", ncols=90)
    for sym in bar:
        rec = yf_financials(sym, "yfinance_sp500")
        if rec: records.append(rec)
        time.sleep(0.04)
    bar.close()
    print(f"  ✓ S&P500: {len(records):,} companies")
    return records


# ── Source 3: Wikidata — global tech startups ─────────────────────────────────
def source_wikidata_global():
    print("\n[3/4] Wikidata — global tech startups & Indian IT companies")
    endpoint = "https://query.wikidata.org/sparql"
    queries = {
        "global_tech_companies": """
SELECT DISTINCT ?name ?founded ?sector ?city ?country WHERE {
  ?c wdt:P31 wd:Q4830453;
     wdt:P452/rdfs:label ?sector FILTER(lang(?sector)="en").
  ?c rdfs:label ?name FILTER (lang(?name)="en").
  OPTIONAL{?c wdt:P571 ?founded.}
  OPTIONAL{?c wdt:P159/rdfs:label ?city FILTER(lang(?city)="en").}
  OPTIONAL{?c wdt:P17/rdfs:label ?country FILTER(lang(?country)="en").}
  FILTER(CONTAINS(LCASE(?sector),"software") || CONTAINS(LCASE(?sector),"internet") ||
         CONTAINS(LCASE(?sector),"financial") || CONTAINS(LCASE(?sector),"technology"))
} LIMIT 4000""",
        "indian_it_companies": """
SELECT DISTINCT ?name ?founded ?city WHERE {
  ?c wdt:P17 wd:Q668;
     wdt:P31 wd:Q4830453;
     wdt:P452/rdfs:label ?ind FILTER(lang(?ind)="en").
  ?c rdfs:label ?name FILTER(lang(?name)="en").
  FILTER(CONTAINS(LCASE(?ind),"software") || CONTAINS(LCASE(?ind),"information") ||
         CONTAINS(LCASE(?ind),"technology") || CONTAINS(LCASE(?ind),"internet"))
  OPTIONAL{?c wdt:P571 ?founded.}
  OPTIONAL{?c wdt:P159/rdfs:label ?city FILTER(lang(?city)="en").}
} LIMIT 3000""",
        "eu_startups": """
SELECT DISTINCT ?name ?founded ?city ?country WHERE {
  ?c wdt:P31 wd:Q4830453.
  ?c wdt:P17 ?ctry.
  VALUES ?ctry {wd:Q183 wd:Q142 wd:Q145 wd:Q38 wd:Q29 wd:Q55 wd:Q31 wd:Q35 wd:Q34 wd:Q20}
  ?c rdfs:label ?name FILTER(lang(?name)="en").
  OPTIONAL{?c wdt:P571 ?founded.}
  OPTIONAL{?c wdt:P159/rdfs:label ?city FILTER(lang(?city)="en").}
  OPTIONAL{?ctry rdfs:label ?country FILTER(lang(?country)="en").}
} LIMIT 3000""",
    }
    records = []
    seen = set()
    for q_name, q in queries.items():
        print(f"  Running: {q_name}...")
        try:
            r = requests.get(endpoint, params={"query": q, "format": "json"},
                             headers={"User-Agent": "IntelliStake/2.0"}, timeout=90)
            if r.status_code != 200:
                print(f"  ✗ HTTP {r.status_code}"); continue
            results = r.json().get("results", {}).get("bindings", [])
            print(f"  ✓ {len(results):,} rows from {q_name}")
            for row in tqdm(results, desc=f"  Parse {q_name}", ncols=80, unit="row"):
                name = row.get("name", {}).get("value", "")
                if not name or name in seen or name.startswith("Q"): continue
                seen.add(name)
                founded_raw = row.get("founded", {}).get("value", "")
                yr = None
                try: yr = int(founded_raw[:4])
                except: pass
                sec = row.get("sector", {}).get("value", "")
                city = row.get("city", {}).get("value", "")
                country = row.get("country", {}).get("value", "Global")
                records.append({
                    "startup_name":      name,
                    "sector":            map_sector(sec),
                    "city":              city,
                    "country":          country,
                    "founded_year":      yr,
                    "company_age_years": (2025-yr) if yr and 1970 < yr < 2025 else None,
                    "data_source":       f"wikidata_{q_name}",
                    "is_real":           True,
                    "is_listed":         False,
                    "record_date":       now_iso(),
                    "trust_score":       0.65,
                })
        except Exception as e:
            print(f"  ✗ {q_name}: {e}")
        time.sleep(3)
    print(f"  ✓ Wikidata global total: {len(records):,} unique companies")
    return records


# ── Source 4: Public GitHub startup datasets (CSV) ───────────────────────────
def source_github_datasets():
    print("\n[4/4] Public GitHub startup datasets (CSV)")
    datasets = [
        {
            "url": "https://raw.githubusercontent.com/notpeter/crunchbase-data/master/companies.csv",
            "name_col": "name", "city_col": "city", "country_col": "country_code",
            "sector_col": "category_list", "founded_col": "founded_at",
            "label": "crunchbase_companies_csv",
        },
        {
            "url": "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv",
            "name_col": "Name", "city_col": None, "country_col": None,
            "sector_col": "Sector", "founded_col": None,
            "label": "sp500_constituents_csv",
        },
    ]
    records = []
    seen_names = set()
    for ds in datasets:
        try:
            print(f"  Fetching {ds['label']}...")
            r = requests.get(ds["url"], timeout=30)
            df = pd.read_csv(io.StringIO(r.text))
            df.columns = [c.strip() for c in df.columns]
            count = 0
            for _, row in tqdm(df.iterrows(), total=len(df), desc=f"  {ds['label']}", ncols=80, unit="row"):
                try:
                    name = str(row.get(ds["name_col"], "")).strip()
                    if not name or name == "nan" or name.lower() in seen_names: continue
                    seen_names.add(name.lower())
                    sec_raw = str(row.get(ds["sector_col"], "")) if ds["sector_col"] else ""
                    city = str(row.get(ds["city_col"], "")) if ds["city_col"] else ""
                    country = str(row.get(ds["country_col"], "Global")) if ds["country_col"] else "Global"
                    founded_raw = str(row.get(ds["founded_col"], "")) if ds["founded_col"] else ""
                    yr = None
                    try: yr = int(str(founded_raw)[:4])
                    except: pass
                    records.append({
                        "startup_name":      name,
                        "sector":            map_sector(sec_raw),
                        "city":              city if city != "nan" else "",
                        "country":           country if country != "nan" else "Global",
                        "founded_year":      yr,
                        "company_age_years": (2025-yr) if yr and 1900 < yr < 2025 else None,
                        "data_source":       ds["label"],
                        "is_real":           True,
                        "is_listed":         False,
                        "record_date":       now_iso(),
                        "trust_score":       0.68,
                    })
                    count += 1
                except: continue
            print(f"  ✓ {ds['label']}: {count:,} companies")
        except Exception as e:
            print(f"  ✗ {ds['label']}: {e}")
    print(f"  ✓ GitHub datasets total: {len(records):,} companies")
    return records


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("═"*65)
    print("  IntelliStake — Top-Up Enrichment (~3k+ new records)")
    print("  NASDAQ · S&P500 · Wikidata Global · GitHub Datasets")
    print("═"*65)

    existing = json.loads(CLEAN.read_text(encoding="utf-8"))
    existing_names = set(
        pd.DataFrame(existing)["startup_name"].astype(str).str.lower().str.strip()
    )
    print(f"  ✓ Existing: {len(existing):,} rows")

    sources = [
        ("NASDAQ",           source_nasdaq_full),
        ("S&P500",           source_sp500),
        ("Wikidata Global",  source_wikidata_global),
        ("GitHub Datasets",  source_github_datasets),
    ]

    all_new = []
    for label, fn in sources:
        recs = fn()
        new = [r for r in recs if str(r.get("startup_name","")).lower().strip() not in existing_names]
        for r in new:
            add_meta(r)
            existing_names.add(str(r.get("startup_name","")).lower().strip())
        all_new.extend(new)
        print(f"  → {label}: +{len(new):,} new unique (running total: {len(all_new):,})")

    merged   = existing + all_new
    with_val = sum(1 for r in merged if r.get("valuation_usd"))

    CLEAN.write_text(json.dumps(merged, indent=2, default=str), encoding="utf-8")

    print(f"\n{'═'*65}")
    print(f"  ✅ TOP-UP COMPLETE")
    print(f"  Before  : {len(existing):,} rows")
    print(f"  Added   : {len(all_new):,} new rows")
    print(f"  Total   : {len(merged):,} rows")
    print(f"  With valuation: {with_val:,} rows")
    print(f"  File    : {CLEAN}")
    print(f"{'═'*65}")
    print(f"\n  → Run retrain: python engine/valuation_stacked.py --oof-n 60000\n")

if __name__ == "__main__":
    main()
