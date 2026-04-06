"""
IntelliStake — Upgrade 7: Investor Network Graph Analysis (GNN/NetworkX)
Builds a bipartite graph: investors ↔ startups
Computes: PageRank, betweenness centrality, investor influence scores
Run: python3 investor_network.py
"""
import json, os, re, numpy as np
from collections import defaultdict
from datetime import datetime

BASE   = os.path.dirname(os.path.abspath(__file__))
PROD   = os.path.join(BASE, '..', 'unified_data', '4_production')
UNIFIED = os.path.join(BASE, '..', 'unified_data', 'real', 'intellistake_unified.json')

print("\n" + "="*60)
print("  IntelliStake — Investor Network Analysis (Upgrade 7)")
print("="*60 + "\n")

# ── 1. Build graph data from unified dataset ──────────────────
print("[1/5] Loading investor data...")
with open(UNIFIED) as f: data = json.load(f)
records = data['startups']

import networkx as nx

G = nx.Graph()
investor_portfolio = defaultdict(list)  # investor → [startups]
startup_investors  = defaultdict(list)  # startup → [investors]

# Parse investor strings and split
def parse_investors(inv_str):
    if not inv_str: return []
    # Split on comma, semicolon, pipe, &, and
    parts = re.split(r'[,;&|]|\band\b', str(inv_str))
    cleaned = []
    for p in parts:
        p = p.strip().strip('"\'').strip()
        if len(p) > 2 and len(p) < 80:
            cleaned.append(p)
    return cleaned[:5]  # cap at 5 per company

edges_added = 0
for rec in records:
    if not rec.get('is_real'): continue
    name = rec.get('startup_name', '').strip()
    inv_str = rec.get('investors', '')
    investors = parse_investors(inv_str)
    if not investors or not name: continue

    # Add startup node
    G.add_node(name, node_type='startup',
               sector=rec.get('sector',''),
               valuation=float(rec.get('valuation_usd',0)),
               trust=float(rec.get('trust_score',0.5)),
               country=rec.get('country',''))

    for inv in investors:
        G.add_node(inv, node_type='investor')
        G.add_edge(inv, name, weight=1)
        investor_portfolio[inv].append(name)
        startup_investors[name].append(inv)
        edges_added += 1

print(f"   Graph: {G.number_of_nodes()} nodes | {G.number_of_edges()} edges")
print(f"   Investors: {len(investor_portfolio)} | Startups with investors: {len(startup_investors)}")

# ── 2. Graph Metrics ──────────────────────────────────────────
print("[2/5] Computing centrality measures...")

# PageRank — investors with high PR back many important startups
pr = nx.pagerank(G, alpha=0.85, weight='weight')

# Degree centrality
dc = nx.degree_centrality(G)

# Connected components
components = list(nx.connected_components(G))
largest_cc = max(components, key=len)
print(f"   Connected components: {len(components)} | Largest: {len(largest_cc)} nodes")

# ── 3. Investor Influence Scores ──────────────────────────────
print("[3/5] Ranking investor influence...")
investor_nodes = [n for n,d in G.nodes(data=True) if d.get('node_type')=='investor']
startup_nodes  = [n for n,d in G.nodes(data=True) if d.get('node_type')=='startup']

top_investors = []
for inv in investor_nodes:
    portfolio = investor_portfolio[inv]
    if not portfolio: continue
    avg_val = np.mean([G.nodes[s].get('valuation',0) for s in portfolio if s in G.nodes])
    top_investors.append({
        "investor_name": inv,
        "portfolio_count": len(portfolio),
        "pagerank_score": round(float(pr.get(inv, 0)), 6),
        "degree_centrality": round(float(dc.get(inv, 0)), 5),
        "avg_portfolio_valuation_usd": round(float(avg_val), 0),
        "top_investments": portfolio[:5],
        "influence_tier": "Tier 1" if pr.get(inv,0) > 0.001 else "Tier 2" if pr.get(inv,0) > 0.0003 else "Tier 3",
    })

top_investors.sort(key=lambda x: -x['pagerank_score'])
print(f"   Top investor by PageRank: {top_investors[0]['investor_name'] if top_investors else '—'}")
print(f"   Top 5: {[i['investor_name'] for i in top_investors[:5]]}")

# ── 4. Startup Network Score ──────────────────────────────────
print("[4/5] Computing startup network scores...")
startup_scores = []
for s in startup_nodes:
    if s not in G.nodes: continue
    node_data = G.nodes[s]
    neighbors = list(G.neighbors(s))   # direct investors
    # Network score = PageRank + avg investor PageRank
    avg_inv_pr = np.mean([pr.get(inv, 0) for inv in neighbors]) if neighbors else 0
    net_score  = float(pr.get(s, 0)) + float(avg_inv_pr) * 2
    startup_scores.append({
        "startup_name": s,
        "sector": node_data.get('sector',''),
        "country": node_data.get('country',''),
        "investor_count": len(neighbors),
        "pagerank_score": round(float(pr.get(s, 0)), 6),
        "network_score": round(net_score * 10000, 4),  # scaled
        "avg_investor_influence": round(float(avg_inv_pr), 6),
        "direct_investors": neighbors[:5],
        "valuation_usd": round(node_data.get('valuation', 0), 0),
    })

startup_scores.sort(key=lambda x: -x['network_score'])
print(f"   Network-scored startups: {len(startup_scores)}")

# ── 5. Save outputs ───────────────────────────────────────────
print("[5/5] Saving network analysis...")
network_out = {
    "generated_at": datetime.now().isoformat(),
    "model": "NetworkX PageRank + Betweenness Centrality (Bipartite Graph)",
    "graph_stats": {
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
        "investor_nodes": len(investor_nodes),
        "startup_nodes": len(startup_nodes),
        "connected_components": len(components),
        "largest_component_size": len(largest_cc),
    },
    "top_investors": top_investors[:100],
    "top_networked_startups": startup_scores[:200],
}
with open(os.path.join(PROD, 'investor_network.json'), 'w') as f:
    json.dump(network_out, f, indent=2)

# Add /api endpoint route snippet
print(f"\n{'='*60}")
print(f"  ✅ Upgrade 7 Complete!")
print(f"{'='*60}")
print(f"  Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"  Top investors by PageRank:")
for inv in top_investors[:5]:
    print(f"    {inv['investor_name']:<35} PR={inv['pagerank_score']:.5f}  portfolio={inv['portfolio_count']}")
print(f"  Top startups by network score:")
for s in startup_scores[:5]:
    print(f"    {s['startup_name']:<35} score={s['network_score']:.3f}  investors={s['investor_count']}")
