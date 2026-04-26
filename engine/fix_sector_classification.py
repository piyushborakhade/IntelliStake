"""
engine/fix_sector_classification.py
=====================================
BLOCK 1 — Fix sector="SaaS" misclassifications from noisy Wikidata/NASDAQ sources.
Checks industry_raw -> description -> startup_name in that order.
"""

import json, re
from pathlib import Path
from collections import defaultdict

BASE  = Path(__file__).resolve().parent.parent
CLEAN = BASE / "unified_data" / "cleaned" / "intellistake_startups_clean.json"

# Extended map: (keywords_tuple) → sector
EXTENDED_SECTOR_MAP = [
    (["bank","banking","nbfc","microfinance","cooperative credit","credit union","financial service","fintech","payment","lending","neobank","wealth management","insurance","insurtech","brokerage","asset management"],                        "FinTech"),
    (["health","pharma","biotech","medical","hospital","diagnostic","clinic","therapeut","oncology","genomic","medtech","dental","surgical","pathology"],                                                                                         "HealthTech"),
    (["ecommerce","e-commerce","retail","marketplace","consumer goods","direct-to-consumer","d2c","fashion","apparel","grocery","supermarket","department store","fmcg","beverage","food delivery"],                                              "E-commerce"),
    (["edtech","education","learning","school","university","tutoring","online course","upskilling","reskilling","lms","training platform"],                                                                                                      "EdTech"),
    (["logistics","supply chain","shipping","delivery","freight","courier","warehousing","last mile","fleet management","cold chain"],                                                                                                            "Mobility"),
    (["agri","agriculture","farm","crop","irrigation","fertiliz","seed","precision farming","aquaculture"],                                                                                                                                       "AgriTech"),
    (["real estate","property","realty","housing","proptech","construction","infrastructure","land","mortgage","reit"],                                                                                                                           "PropTech"),
    (["gaming","game","esport","video game","mobile game","game studio","game engine"],                                                                                                                                                          "Media"),
    (["media","content","entertainment","streaming","ott","film","music","podcast","broadcasting","news","publishing"],                                                                                                                           "Media"),
    (["cyber","security","infosec","cybersecurity","firewall","endpoint","zero trust","siem","soc"],                                                                                                                                             "SaaS"),
    (["solar","renewable","clean energy","wind energy","ev charging","electric vehicle","greentech","cleantech","climate","carbon","sustainability"],                                                                                             "CleanTech"),
    (["aluminum","mining","oil","gas","chemical","manufacturing","industrial","steel","cement","textile","auto parts","aerospace","defence","defense"],                                                                                           "Manufacturing"),
    (["telecom","telecommunication","wireless","5g","fiber","isp","satellite communication"],                                                                                                                                                    "Telecom"),
    (["saas","software","cloud","enterprise software","b2b","erp","crm","api","developer tool","devops","infrastructure","platform","no-code","low-code","data analytics","artificial intelligence","machine learning","computer"],               "SaaS"),
    (["auto","automobile","mobility","electric vehicle","ride-hail","rideshare","ev","scooter","bike","autonomous"],                                                                                                                              "Mobility"),
    (["space","satellite","aerospace","rocket","drone","uav","deeptech","quantum","robotics","robot"],                                                                                                                                            "DeepTech"),
]

def classify(text: str) -> str | None:
    if not text:
        return None
    t = text.lower()
    for keywords, sector in EXTENDED_SECTOR_MAP:
        for kw in keywords:
            if kw in t:
                return sector
    return None

def main():
    print("Loading data...", end=" ", flush=True)
    data = json.loads(CLEAN.read_text(encoding="utf-8"))
    print(f"{len(data):,} records")

    reclassified = 0
    new_sector_counts = defaultdict(int)
    old_sector_counts = defaultdict(int)

    for r in data:
        old_sec = r.get("sector", "SaaS") or "SaaS"
        old_sector_counts[old_sec] += 1

        # Only attempt re-classification if currently "SaaS" or missing
        if old_sec not in ("SaaS", None, "", "nan"):
            continue

        new_sec = None
        # 1st: try industry_raw
        new_sec = classify(r.get("industry_raw", ""))
        # 2nd: try description
        if not new_sec:
            new_sec = classify(r.get("description", ""))
        # 3rd: try startup_name
        if not new_sec:
            new_sec = classify(r.get("startup_name", ""))

        if new_sec and new_sec != "SaaS":
            r["sector"] = new_sec
            r["sector_revised"] = True
            new_sector_counts[new_sec] += 1
            reclassified += 1

    print(f"\n  ✓ Re-classified: {reclassified:,} records")
    print(f"\n  Breakdown by new sector:")
    for sec, cnt in sorted(new_sector_counts.items(), key=lambda x: -x[1]):
        print(f"    {sec:<20} : {cnt:,}")

    print("\n  Old sector distribution (top 10):")
    for sec, cnt in sorted(old_sector_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"    {sec:<20} : {cnt:,}")

    print("\nSaving...", end=" ", flush=True)
    CLEAN.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    print("✓")
    print(f"\n  BLOCK 1 COMPLETE — {reclassified:,} records re-classified")
    return reclassified

if __name__ == "__main__":
    main()
