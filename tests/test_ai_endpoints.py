import requests

API_BASE = "http://localhost:5500/api"

endpoints = [
    ("/trust-score", {"github_velocity_score": 0.8, "sentiment_compound": 0.3, "employee_count": 500, "total_funding_usd": 5000000}),
    ("/sentiment/ensemble", {"texts": ["This startup raised 50M. We think this is fantastic news!"]}),
    ("/montecarlo", None),
]

for endpoint, payload in endpoints:
    url = f"{API_BASE}{endpoint}"
    try:
        if payload:
            res = requests.post(url, json=payload)
        else:
            res = requests.get(url)
        print(f"[{endpoint}] Status: {res.status_code}")
        print(res.json())
    except Exception as e:
        print(f"[{endpoint}] Error: {e}")
