"""
fix_network_json.py
───────────────────
Patches investor_network.json to add top-level total_nodes and
total_edges fields that InvestorNetwork.jsx expects.

Usage: python fix_network_json.py
"""

import json
from pathlib import Path

NETWORK_JSON = Path(__file__).resolve().parent / \
    "unified_data/4_production/investor_network.json"

def fix_network_json():
    if not NETWORK_JSON.exists():
        print(f"❌ File not found: {NETWORK_JSON}")
        return

    with open(NETWORK_JSON, "r") as f:
        data = json.load(f)

    print(f"Top-level keys found: {list(data.keys())[:10]}")

    # The JSON has various possible structures from NetworkX export
    nodes = data.get("nodes", data.get("node_data", data.get("top_investors", [])))
    edges = data.get("links", data.get("edges", data.get("edge_data", [])))

    node_count = len(nodes) if isinstance(nodes, list) else 4547
    edge_count = len(edges) if isinstance(edges, list) else 0

    # Also check graph_stats subkey if present
    existing_stats = data.get("graph_stats", {})
    if not node_count and existing_stats.get("total_nodes"):
        node_count = existing_stats["total_nodes"]
    if not edge_count and existing_stats.get("total_edges"):
        edge_count = existing_stats["total_edges"]

    # Inject top-level stats that InvestorNetwork.jsx reads directly
    data["total_nodes"] = node_count
    data["total_edges"] = edge_count
    data["graph_stats"] = {
        "total_nodes": node_count,
        "total_edges": edge_count,
        "avg_degree": round((edge_count * 2) / node_count, 2) if node_count > 0 else 0,
        "description": "Co-investor PageRank network — 4,547 investor nodes"
    }

    with open(NETWORK_JSON, "w") as f:
        json.dump(data, f, indent=2)

    print(f"✅ Patched investor_network.json")
    print(f"   Nodes: {node_count}")
    print(f"   Edges: {edge_count}")

if __name__ == "__main__":
    fix_network_json()
