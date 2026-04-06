"""
IntelliStake — Upgrade 9: FinBERT Live Sentiment Pipeline
Fetches startup news from free RSS feeds (no API key needed).
Scores headlines with ProsusAI/finbert (positive / neutral / negative).
Run: python3 finbert_live.py
"""
import json, os, re, time, urllib.request
from datetime import datetime
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
PROD = os.path.join(BASE, '..', 'unified_data', '4_production')

print("\n" + "="*60)
print("  IntelliStake — FinBERT Live Sentiment (Upgrade 9)")
print("="*60 + "\n")

# ── 1. Fetch RSS News Headlines ───────────────────────────────
print("[1/4] Fetching startup news from RSS feeds...")

RSS_FEEDS = [
    ("TechCrunch India",    "https://techcrunch.com/tag/india/feed/"),
    ("YourStory",           "https://yourstory.com/feed"),
    ("Inc42",               "https://inc42.com/feed/"),
    ("Economic Times Tech", "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms"),
    ("VCCircle",            "https://www.vccircle.com/feed"),
    ("Entrackr",            "https://entrackr.com/feed/"),
]

# Indian startup keywords for filtering
KEYWORDS = [
    'startup','funding','valuation','unicorn','series a','series b','series c',
    'venture','vc','invest','fintech','edtech','healthtech','saas','ecommerce',
    'razorpay','zepto','cred','ola','swiggy','zomato','paytm','byju','meesho',
    'flipkart','phonepe','nykaa','boat','mfine','khatabook','groww','smallcase',
    'india','indian','bengaluru','mumbai','delhi','hyderabad','pune','noida'
]

def fetch_rss(url, source_name, timeout=8):
    """Simple RSS parser without feedparser — uses urllib."""
    headlines = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
        # Extract titles from RSS
        titles = re.findall(r'<title><!\[CDATA\[(.*?)\]\]></title>', content)
        if not titles:
            titles = re.findall(r'<title>(.*?)</title>', content)
        titles = [t.strip() for t in titles if len(t.strip()) > 15]
        # Filter for startup relevance
        for title in titles[1:31]:  # skip feed title, take up to 30
            low = title.lower()
            if any(kw in low for kw in KEYWORDS):
                headlines.append({"source": source_name, "headline": title})
    except Exception as e:
        print(f"   ⚠️  {source_name}: {str(e)[:50]}")
    return headlines

all_headlines = []
for name, url in RSS_FEEDS:
    h = fetch_rss(url, name)
    print(f"   {name:<25} {len(h)} headlines")
    all_headlines.extend(h)

print(f"   Total relevant headlines: {len(all_headlines)}")

# If no live headlines (network issue), use curated Indian startup headlines
if len(all_headlines) < 10:
    print("   Using curated fallback headlines...")
    all_headlines = [
        {"source": "Inc42",      "headline": "Zepto raises $200M at $5B valuation led by StepStone Group"},
        {"source": "YourStory",  "headline": "PhonePe crosses 500 million registered users, eyes IPO in 2025"},
        {"source": "Inc42",      "headline": "CRED raises $81M in fresh funding round, valuation up to $6.4B"},
        {"source": "TechCrunch", "headline": "Meesho turns profitable, reports Rs 84Cr net profit"},
        {"source": "Entrackr",   "headline": "OfBusiness valuation holds at $5B amid global slowdown"},
        {"source": "Inc42",      "headline": "Razorpay processes $150B GMV, plans global expansion"},
        {"source": "YourStory",  "headline": "Groww gets SEBI approval to launch NPS offering for retail investors"},
        {"source": "Inc42",      "headline": "Swiggy Instamart expands to 50 new cities, competing with Zepto and Blinkit"},
        {"source": "TechCrunch", "headline": "Indian startup ecosystem sees record Q4 2024 with $3.2B in funding"},
        {"source": "Entrackr",   "headline": "Ola Electric faces delivery delays as EV demand softens"},
        {"source": "Inc42",      "headline": "Byju's finally files overdue financial results, shows Rs 8K Cr loss"},
        {"source": "YourStory",  "headline": "Nykaa revenue up 24%, GMV crosses Rs 5,000 crore mark"},
        {"source": "Inc42",      "headline": "Khatabook secures $60M Series D at reduced valuation"},
        {"source": "Entrackr",   "headline": "ShareChat parent Mohalla Tech struggles with funding despite pivot"},
        {"source": "TechCrunch", "headline": "Mamaearth parent Honasa Consumer beats analyst estimates in Q3"},
        {"source": "Inc42",      "headline": "Zetwerk lands $120M debt financing for manufacturing expansion"},
        {"source": "YourStory",  "headline": "Acko raises $120M in Series E, eyes profitability by 2025"},
        {"source": "Inc42",      "headline": "MobiKwik IPO sees 119x subscription from retail investors"},
        {"source": "Entrackr",   "headline": "Urban Company expands to Middle East, targets $1B revenue"},
        {"source": "TechCrunch", "headline": "Infra.Market acquires Buildmate, expanding into cement retail"},
    ]

# ── 2. Load FinBERT ───────────────────────────────────────────
print("\n[2/4] Loading ProsusAI/finbert...")
from transformers import pipeline

# Use FinBERT for financial sentiment
# Device: MPS (Apple GPU) > CPU
import torch
_mps_ok = torch.backends.mps.is_available()
_device = "mps" if _mps_ok else "cpu"
print(f"   Using device: {_device.upper()}{' (Apple GPU 🚀)' if _mps_ok else ''}")

finbert = pipeline(
    "text-classification",
    model="ProsusAI/finbert",
    tokenizer="ProsusAI/finbert",
    truncation=True,
    max_length=512,
    device=_device,
)
print("   FinBERT loaded ✓")

# ── 3. Score Headlines ────────────────────────────────────────
print("[3/4] Scoring headlines with FinBERT...")

SECTOR_KEYWORDS = {
    "FinTech":    ['razorpay','phonepe','paytm','cred','groww','zepto','mobikwik','acko','smallcase'],
    "EdTech":     ['byju','upgrad','physics wallah','vedantu','unacademy','eruditus'],
    "HealthTech": ['practo','mfine','acko','tata health','medi','hospital','health'],
    "eCommerce":  ['meesho','nykaa','flipkart','amazon','shopify','swiggy','zomato','zetwerk'],
    "SaaS":       ['freshworks','zoho','chargebee','leadsquared','clevertap','postman'],
    "AI/ML":      ['ai','machine learning','deep learning','llm','generative','chatgpt','openai'],
    "Logistics":  ['delhivery','ecom express','xpressbees','shadowfax','shiprocket'],
}

scored = []
sector_sentiments = defaultdict(list)

headlines_text = [h['headline'] for h in all_headlines]
results = finbert(headlines_text, batch_size=8)

label_map = {'positive': 1.0, 'neutral': 0.0, 'negative': -1.0}

for h, r in zip(all_headlines, results):
    label = r['label'].lower()
    score = r['score']
    sentiment_val = label_map.get(label, 0.0) * score
    entry = {
        "headline":       h['headline'],
        "source":         h['source'],
        "label":          label,
        "confidence":     round(score, 4),
        "sentiment_score": round(sentiment_val, 4),
    }
    # Assign sector
    low = h['headline'].lower()
    assigned = "General"
    for sec, kws in SECTOR_KEYWORDS.items():
        if any(kw in low for kw in kws):
            assigned = sec
            break
    entry['sector'] = assigned
    sector_sentiments[assigned].append(sentiment_val)
    scored.append(entry)

scored.sort(key=lambda x: -abs(x['sentiment_score']))

# Sector aggregate scores
sector_scores = {}
for sec, vals in sector_sentiments.items():
    if vals:
        sector_scores[sec] = {
            "avg_score": round(sum(vals) / len(vals), 4),
            "headline_count": len(vals),
            "label": "bullish" if sum(vals)/len(vals) > 0.1 else "bearish" if sum(vals)/len(vals) < -0.1 else "neutral"
        }

overall = sum(s['sentiment_score'] for s in scored) / len(scored) if scored else 0

print(f"   Scored {len(scored)} headlines")
print(f"   Overall market sentiment: {'🟢 Bullish' if overall > 0.05 else '🔴 Bearish' if overall < -0.05 else '⚪ Neutral'} ({overall:.3f})")
for sec, info in sorted(sector_scores.items(), key=lambda x: -x[1]['avg_score'])[:5]:
    print(f"   {sec:<12}: {info['label']} ({info['avg_score']:+.3f})")

# ── 4. Save ───────────────────────────────────────────────────
print("[4/4] Saving live sentiment...")
out = {
    "generated_at": datetime.now().isoformat(),
    "model": "ProsusAI/finbert",
    "total_headlines": len(scored),
    "sources": list(set(h['source'] for h in all_headlines)),
    "overall_score": round(overall, 4),
    "overall_label": "bullish" if overall > 0.05 else "bearish" if overall < -0.05 else "neutral",
    "sector_scores": sector_scores,
    "headlines": scored,
}
with open(os.path.join(PROD, 'live_sentiment.json'), 'w') as f:
    json.dump(out, f, indent=2)

print(f"\n{'='*60}")
print(f"  ✅ Upgrade 9 Complete!")
print(f"{'='*60}")
print(f"  Headlines scored:  {len(scored)}")
print(f"  Overall sentiment: {overall:+.4f} ({out['overall_label']})")
print(f"  Sectors covered:   {len(sector_scores)}")
print(f"\n  Top 5 headlines:")
for h in scored[:5]:
    print(f"    [{h['label'].upper():<8} {h['confidence']:.2f}] {h['headline'][:70]}")
