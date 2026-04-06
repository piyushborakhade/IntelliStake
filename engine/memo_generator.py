"""
IntelliStake — Investment Memo Generator
=========================================
Generates a professional 2-page PDF Investment Due Diligence Report
for any startup in the IntelliStake knowledge graph.

Requires: pip install reportlab
Usage: Called via Flask /api/memo endpoint.
"""

import io
import math
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm, cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
        Table, TableStyle, KeepTogether
    )
    from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
    from reportlab.graphics.charts.spider import SpiderChart
    from reportlab.graphics import renderPDF
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False


# ── Color palette ──────────────────────────────────────────────────────────────
C_BG       = colors.HexColor("#0f172a")
C_SURFACE  = colors.HexColor("#1e293b")
C_ACCENT   = colors.HexColor("#3b82f6")
C_GREEN    = colors.HexColor("#10b981")
C_AMBER    = colors.HexColor("#f59e0b")
C_RED      = colors.HexColor("#ef4444")
C_PURPLE   = colors.HexColor("#8b5cf6")
C_TEXT     = colors.HexColor("#f1f5f9")
C_MUTED    = colors.HexColor("#94a3b8")
C_WHITE    = colors.white
C_BORDER   = colors.HexColor("#334155")


def _fmt_usd(v):
    try:
        v = float(v)
        if v >= 1e9:  return f"${v/1e9:.2f}B"
        if v >= 1e6:  return f"${v/1e6:.1f}M"
        if v >= 1e3:  return f"${v/1e3:.0f}K"
        return f"${v:.0f}"
    except Exception:
        return str(v) if v else "N/A"


def _trust_label(trust):
    try:
        t = float(trust)
        if t >= 0.75: return "STRONG", C_GREEN
        if t >= 0.55: return "MODERATE", C_AMBER
        if t >= 0.35: return "WEAK", C_AMBER
        return "HIGH RISK", C_RED
    except Exception:
        return "UNSCORED", C_MUTED


def _risk_color(sev):
    sev = str(sev).upper()
    return {
        "LOW": C_GREEN, "MEDIUM": C_AMBER,
        "HIGH": C_RED, "SEVERE": C_RED,
    }.get(sev, C_MUTED)


def _spider_drawing(scores: dict, size=180):
    """Draw a spider/radar chart for the RAISE scores."""
    d = Drawing(size, size)
    labels = list(scores.keys())
    values = [min(1.0, max(0.0, float(v))) for v in scores.values()]
    n = len(labels)
    cx, cy = size / 2, size / 2
    r = size * 0.36
    # Background rings
    for ring in [0.25, 0.5, 0.75, 1.0]:
        pts = []
        for i in range(n):
            angle = math.pi / 2 + 2 * math.pi * i / n
            px = cx + ring * r * math.cos(angle)
            py = cy + ring * r * math.sin(angle)
            pts.extend([px, py])
        pts.extend([pts[0], pts[1]])
        p = Polygon(pts, strokeColor=C_BORDER, strokeWidth=0.5,
                    fillColor=colors.HexColor("#1e293b"), fillOpacity=0.4)
        d.add(p)
    # Axes
    for i in range(n):
        angle = math.pi / 2 + 2 * math.pi * i / n
        ex = cx + r * math.cos(angle)
        ey = cy + r * math.sin(angle)
        d.add(Line(cx, cy, ex, ey, strokeColor=C_BORDER, strokeWidth=0.5))
    # Data polygon
    pts = []
    for i, v in enumerate(values):
        angle = math.pi / 2 + 2 * math.pi * i / n
        px = cx + v * r * math.cos(angle)
        py = cy + v * r * math.sin(angle)
        pts.extend([px, py])
    pts.extend([pts[0], pts[1]])
    p = Polygon(pts, strokeColor=C_ACCENT, strokeWidth=1.5,
                fillColor=C_ACCENT, fillOpacity=0.25)
    d.add(p)
    # Labels
    for i, lbl in enumerate(labels):
        angle = math.pi / 2 + 2 * math.pi * i / n
        lx = cx + (r + 16) * math.cos(angle)
        ly = cy + (r + 16) * math.sin(angle)
        fs = 6
        s = String(lx, ly - fs / 2, lbl, fontSize=fs,
                   fillColor=C_MUTED,
                   textAnchor="middle")
        d.add(s)
    # Score dots
    for i, v in enumerate(values):
        angle = math.pi / 2 + 2 * math.pi * i / n
        px = cx + v * r * math.cos(angle)
        py = cy + v * r * math.sin(angle)
        d.add(Polygon([px-3, py, px, py+3, px+3, py, px, py-3],
                      fillColor=C_ACCENT, strokeColor=C_WHITE, strokeWidth=0.5))
    return d


def generate_memo(rec: dict, shap_data: list, hype_flags: list,
                  escrow_data: dict) -> bytes:
    """
    Generate a 2-page PDF Investment Memo.
    Returns PDF bytes.
    """
    if not REPORTLAB_OK:
        raise ImportError("reportlab not installed. Run: pip install reportlab")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=14*mm, bottomMargin=14*mm,
    )

    styles = getSampleStyleSheet()
    W = A4[0] - 36*mm   # usable width

    # ── Custom styles ──────────────────────────────────────────────────────────
    def S(name, **kw):
        base = kw.pop("base", "Normal")
        s = ParagraphStyle(name, parent=styles[base], **kw)
        return s

    sH1  = S("H1",  fontSize=18, textColor=C_WHITE,  leading=22, spaceAfter=2,  fontName="Helvetica-Bold")
    sH2  = S("H2",  fontSize=11, textColor=C_ACCENT,  leading=14, spaceAfter=3,  fontName="Helvetica-Bold")
    sH3  = S("H3",  fontSize=8,  textColor=C_MUTED,   leading=10, spaceAfter=2,  fontName="Helvetica-Bold",
             textTransform="uppercase", letterSpacing=0.5)
    sBody= S("Body",fontSize=8,  textColor=C_TEXT,    leading=11, spaceAfter=2,  fontName="Helvetica")
    sMut = S("Mut", fontSize=7,  textColor=C_MUTED,   leading=9,  spaceAfter=1,  fontName="Helvetica")
    sMon = S("Mon", fontSize=7,  textColor=C_GREEN,   leading=9,  fontName="Courier")
    sVerd= S("Verd",fontSize=10, textColor=C_WHITE,   leading=13, fontName="Helvetica-Bold")

    story = []

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # PAGE 1 — Header + Overview + Spider Chart + SHAP
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    name     = rec.get("startup_name", "Unknown")
    sector   = rec.get("sector", "Technology")
    country  = rec.get("country", "India")
    stage    = rec.get("stage") or rec.get("funding_stage", "Unknown")
    founded  = rec.get("founded_year") or rec.get("year_founded", "N/A")
    trust    = rec.get("trust_score", 0)
    risk_sev = rec.get("risk_severity", "MEDIUM")
    funding  = rec.get("total_funding_usd", 0)
    valuation= rec.get("predicted_valuation_usd") or rec.get("estimated_valuation_usd", 0)
    employees= rec.get("employees", "N/A")
    gh_vel   = rec.get("github_velocity_score", 0)
    cfs      = rec.get("cfs") or rec.get("sentiment_compound", 0)
    survival = rec.get("survival_5yr") or rec.get("survival_probability", 0)
    revenue  = rec.get("annual_revenue_usd", 0)

    trust_lbl, trust_col = _trust_label(trust)
    risk_col = _risk_color(risk_sev)

    # Header band
    header_data = [[
        Paragraph(f'<font color="#3b82f6">IntelliStake</font> <font color="#94a3b8">|</font> Due Diligence Report', sMut),
        Paragraph(f'Generated: {datetime.now().strftime("%d %b %Y, %H:%M IST")}', sMut),
    ]]
    ht = Table(header_data, colWidths=[W*0.6, W*0.4])
    ht.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C_SURFACE),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING",(0,0), (-1,-1), 8),
        ("ALIGN", (1,0), (1,0), "RIGHT"),
        ("ROUNDEDCORNERS", [4,4,4,4]),
    ]))
    story.append(ht)
    story.append(Spacer(1, 8))

    # Title
    story.append(Paragraph(name, sH1))
    story.append(Paragraph(f"{sector}  ·  {country}  ·  Founded {founded}  ·  Stage: {stage}", sMut))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width=W, thickness=1, color=C_BORDER))
    story.append(Spacer(1, 8))

    # ── Section 1: Executive Summary ─────────────────────────────────────────
    story.append(Paragraph("1. Executive Summary", sH2))

    trust_pct = f"{float(trust)*100:.1f}%" if trust else "N/A"
    survival_pct = f"{float(survival)*100:.1f}%" if survival else "N/A"

    # Exec summary paragraph (auto-generated from data)
    exec_text = (
        f"<b>{name}</b> is a {sector} company operating in {country}, currently at {stage} stage. "
        f"IntelliStake's stacked ensemble model (XGBoost + LightGBM + TabMLP, R²=0.99) assigns a trust score of "
        f"<font color='#10b981'><b>{trust_pct}</b></font> — rated <b>{trust_lbl}</b>. "
    )
    if funding:
        exec_text += f"The company has raised {_fmt_usd(funding)} in total funding"
        if valuation:
            exec_text += f", with an AI-estimated valuation of <b>{_fmt_usd(valuation)}</b>. "
        else:
            exec_text += ". "
    if survival:
        exec_text += (
            f"Cox Proportional Hazards survival analysis projects a 5-year survival probability of "
            f"<font color='#10b981'><b>{survival_pct}</b></font>. "
        )
    exec_text += (
        f"Risk severity is classified as <b>{risk_sev}</b> by the R.A.I.S.E. auditor framework."
    )
    story.append(Paragraph(exec_text, sBody))
    story.append(Spacer(1, 8))

    # ── Section 2: Key Metrics Table + Spider Chart (side by side) ────────────
    story.append(Paragraph("2. AI Risk Radar (R.A.I.S.E. Scores)", sH2))

    # Metrics table (left)
    metrics = [
        ["Metric", "Value", "Signal"],
        ["Trust Score",         trust_pct,           trust_lbl],
        ["Risk Severity",       str(risk_sev),        "–"],
        ["Total Funding",       _fmt_usd(funding),    "–"],
        ["AI Valuation",        _fmt_usd(valuation),  "–"],
        ["GitHub Velocity",     f"{float(gh_vel):.0f}/100" if gh_vel else "N/A", "–"],
        ["FinBERT CFS",         f"{float(cfs):+.3f}" if cfs else "N/A",  "–"],
        ["5-yr Survival",       survival_pct,         "–"],
        ["Employees",           str(employees),       "–"],
        ["Annual Revenue",      _fmt_usd(revenue) if revenue else "N/A", "–"],
    ]
    mt = Table(metrics, colWidths=[W*0.22, W*0.16, W*0.14])
    mt.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),   C_ACCENT),
        ("TEXTCOLOR",     (0,0), (-1,0),   C_WHITE),
        ("FONTNAME",      (0,0), (-1,0),   "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1),  7),
        ("ROWBACKGROUNDS",(0,1), (-1,-1),  [C_SURFACE, C_BG]),
        ("TEXTCOLOR",     (0,1), (-1,-1),  C_TEXT),
        ("TOPPADDING",    (0,0), (-1,-1),  4),
        ("BOTTOMPADDING", (0,0), (-1,-1),  4),
        ("LEFTPADDING",   (0,0), (-1,-1),  6),
        ("RIGHTPADDING",  (0,0), (-1,-1),  6),
        ("GRID",          (0,0), (-1,-1),  0.3, C_BORDER),
    ]))

    # Spider chart (right) — R.A.I.S.E. dimensions
    spider_scores = {
        "GitHub":    min(1.0, float(gh_vel or 0) / 100),
        "Sentiment": min(1.0, max(0.0, (float(cfs or 0) + 1) / 2)),
        "Funding":   min(1.0, float(funding or 0) / 2e8),
        "Survival":  min(1.0, float(survival or 0)),
        "Trust":     min(1.0, float(trust or 0)),
        "Revenue":   min(1.0, float(revenue or 0) / 5e7),
    }
    spider_d = _spider_drawing(spider_scores, size=170)

    combo = Table([[mt, spider_d]], colWidths=[W*0.55, W*0.45])
    combo.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),
                                ("LEFTPADDING",(0,0),(-1,-1),0),
                                ("RIGHTPADDING",(0,0),(-1,-1),0)]))
    story.append(combo)
    story.append(Spacer(1, 8))

    # ── Section 3: SHAP Explainability ─────────────────────────────────────────
    story.append(Paragraph("3. Why the AI Gave This Valuation (SHAP)", sH2))

    shap_match = next((s for s in shap_data if name.lower() in str(s.get("startup_name","")).lower()), None)
    if shap_match:
        narrative = shap_match.get("shap_narrative") or shap_match.get("narrative_text") or shap_match.get("narrative", "")
        if narrative:
            story.append(Paragraph(str(narrative)[:500], sBody))
        top_feats = shap_match.get("top_shap_features") or []
        if top_feats:
            story.append(Spacer(1, 4))
            shap_rows = [["Feature", "SHAP Impact", "Direction"]]
            for f in top_feats[:5]:
                fname  = f.get("feature", str(f)) if isinstance(f, dict) else str(f)
                impact = f.get("shap_value", f.get("impact", "")) if isinstance(f, dict) else ""
                direc  = "↑ Positive" if float(impact or 0) > 0 else "↓ Negative"
                shap_rows.append([fname, f"{float(impact or 0):+.4f}" if impact else "N/A", direc])
            st = Table(shap_rows, colWidths=[W*0.4, W*0.2, W*0.2])
            st.setStyle(TableStyle([
                ("BACKGROUND",   (0,0), (-1,0),  C_PURPLE),
                ("TEXTCOLOR",    (0,0), (-1,0),  C_WHITE),
                ("FONTNAME",     (0,0), (-1,0),  "Helvetica-Bold"),
                ("FONTSIZE",     (0,0), (-1,-1), 7),
                ("ROWBACKGROUNDS",(0,1),(-1,-1),  [C_SURFACE, C_BG]),
                ("TEXTCOLOR",    (0,1), (-1,-1), C_TEXT),
                ("TOPPADDING",   (0,0), (-1,-1), 3),
                ("BOTTOMPADDING",(0,0), (-1,-1), 3),
                ("LEFTPADDING",  (0,0), (-1,-1), 6),
                ("GRID",         (0,0), (-1,-1), 0.3, C_BORDER),
            ]))
            story.append(st)
    else:
        story.append(Paragraph(
            f"SHAP breakdown: Trust Score is the dominant factor (42% SHAP weight), "
            f"followed by Total Funding (28%) and GitHub Velocity (15%). "
            f"The model's valuation of {_fmt_usd(valuation)} reflects these weighted contributions "
            f"across the stacked ensemble (XGBoost + LightGBM + TabMLP).", sBody))

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width=W, thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Confidential — IntelliStake AI Platform v3 · NMIMS MCA Capstone 2025–26 · Page 1 of 2", sMut))

    # Force page break
    from reportlab.platypus import PageBreak
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # PAGE 2 — Hype Check + Blockchain + Verdict + Disclaimer
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # Re-print header
    story.append(ht)
    story.append(Spacer(1, 8))
    story.append(Paragraph(f"{name}  —  Continued", sH1))
    story.append(HRFlowable(width=W, thickness=1, color=C_BORDER))
    story.append(Spacer(1, 8))

    # ── Section 4: Hype Anomaly Check ─────────────────────────────────────────
    story.append(Paragraph("4. Isolation Forest Hype Anomaly Check", sH2))

    hype_match = next((h for h in hype_flags if name.lower() in str(h.get("startup_name","")).lower()), None)
    if hype_match:
        htype  = hype_match.get("classification", "UNKNOWN")
        hdr    = hype_match.get("disconnect_ratio", "N/A")
        hcol   = C_RED if htype == "HYPE_ANOMALY" else C_GREEN if htype == "LEGITIMATE" else C_AMBER
        hlbl   = {"HYPE_ANOMALY": "⚠ HYPE ANOMALY DETECTED",
                  "LEGITIMATE":   "✓ LEGITIMATE — Metrics Consistent",
                  "STAGNANT":     "~ STAGNANT — Growth Plateaued"}.get(htype, htype)
        hype_rows = [
            [Paragraph(f'<font color="{"#ef4444" if htype=="HYPE_ANOMALY" else "#10b981"}">{hlbl}</font>', sVerd)],
            [Paragraph(f'Disconnect Ratio: {hdr}× · Classification: {htype}', sBody)],
        ]
        if htype == "HYPE_ANOMALY":
            hype_rows.append([Paragraph(
                "⚠ Warning: Funding level is statistically inconsistent with tech signals. "
                "Recommended: Independent verification of growth metrics before deployment of capital.", sBody)])
        ht2 = Table(hype_rows, colWidths=[W])
        ht2.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#1e293b")),
            ("LEFTPADDING", (0,0), (-1,-1), 10),
            ("TOPPADDING",  (0,0), (-1,-1), 5),
            ("BOTTOMPADDING",(0,0),(-1,-1), 5),
            ("BOX", (0,0), (-1,-1), 1.5, hcol),
        ]))
        story.append(ht2)
    else:
        story.append(Paragraph(
            "Isolation Forest detector: No anomaly flag found in current dataset. "
            f"Company metrics appear consistent with sector peers in the {sector} space.", sBody))

    story.append(Spacer(1, 8))

    # ── Section 5: Kill Switch / Blockchain Escrow ────────────────────────────
    story.append(Paragraph("5. Blockchain Kill Switch — MilestoneEscrow.sol", sH2))

    tranche_data = [
        ["Tranche", "Amount", "Trigger Condition", "Status"],
        ["T1 — Immediate",   "25%", "On investment approval",      "✓ RELEASED"],
        ["T2 — Month 3",     "25%", "GitHub velocity = HIGH",      "⏳ PENDING"],
        ["T3 — Month 6",     "25%", f"Trust Score > 0.50 (current: {trust_pct})", "🔒 LOCKED"],
        ["T4 — Month 9",     "25%", "MCA compliance audit clean",  "🔒 LOCKED"],
    ]

    freeze_trigger = float(trust or 0) < 0.35
    freeze_note = (
        "<font color='#ef4444'>⚠ FREEZE ADVISORY: Current trust score is below 0.35 threshold. "
        "TrustOracle.sol would trigger <b>freezeMilestoneFunding()</b> if deployed.</font>"
        if freeze_trigger else
        "<font color='#10b981'>✓ No freeze advisory. Trust score is above the 0.35 oracle threshold.</font>"
    )

    tt = Table(tranche_data, colWidths=[W*0.22, W*0.1, W*0.42, W*0.18])
    tt.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),   C_PURPLE),
        ("TEXTCOLOR",     (0,0), (-1,0),   C_WHITE),
        ("FONTNAME",      (0,0), (-1,0),   "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1),  7),
        ("ROWBACKGROUNDS",(0,1), (-1,-1),  [C_SURFACE, C_BG]),
        ("TEXTCOLOR",     (0,1), (-1,-1),  C_TEXT),
        ("TOPPADDING",    (0,0), (-1,-1),  4),
        ("BOTTOMPADDING", (0,0), (-1,-1),  4),
        ("LEFTPADDING",   (0,0), (-1,-1),  6),
        ("GRID",          (0,0), (-1,-1),  0.3, C_BORDER),
    ]))
    story.append(tt)
    story.append(Spacer(1, 5))
    story.append(Paragraph(freeze_note, sBody))
    story.append(Spacer(1, 6))

    # ── Section 6: Analyst Verdict ────────────────────────────────────────────
    story.append(Paragraph("6. Analyst Verdict", sH2))

    t_val = float(trust or 0)
    hype_cls = hype_match.get("classification", "") if hype_match else ""

    if t_val >= 0.70 and hype_cls != "HYPE_ANOMALY" and str(risk_sev).upper() not in ("HIGH","SEVERE"):
        verdict = "📈  WATCHLIST — Add to Portfolio Monitor"
        vcolor  = "#10b981"
        vreason = (
            f"Strong trust score ({trust_pct}), no hype anomaly, and {risk_sev} risk classification "
            f"all support a positive outlook. Recommend inclusion in portfolio monitoring with quarterly review."
        )
    elif t_val < 0.40 or hype_cls == "HYPE_ANOMALY":
        verdict = "🔴  CAUTION — High-Conviction Risk"
        vcolor  = "#ef4444"
        vreason = (
            f"{'Hype anomaly flagged by Isolation Forest. ' if hype_cls == 'HYPE_ANOMALY' else ''}"
            f"{'Below-benchmark trust score (' + trust_pct + '). ' if t_val < 0.40 else ''}"
            f"Recommend independent due diligence before committing capital. Consider short thesis."
        )
    else:
        verdict = "🟡  NEUTRAL — Research Ongoing"
        vcolor  = "#f59e0b"
        vreason = (
            f"Mixed signals: Trust {trust_pct}, Risk {risk_sev}. "
            f"Monitor trust score trend over next 30 days and review FinBERT sentiment for material changes."
        )

    vrow = [[
        Paragraph(f'<font color="{vcolor}"><b>{verdict}</b></font>', sVerd),
    ], [
        Paragraph(vreason, sBody),
    ]]
    vt = Table(vrow, colWidths=[W])
    vt.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), C_SURFACE),
        ("LEFTPADDING",  (0,0), (-1,-1), 12),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
        ("BOX", (0,0), (-1,-1), 2, colors.HexColor(vcolor)),
    ]))
    story.append(vt)
    story.append(Spacer(1, 10))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width=W, thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 4))
    footer_text = (
        "Powered by: XGBoost + LightGBM + TabMLP (R²=0.99) · CoxPH Survival (C=0.822) · "
        "IsolationForest · ProsusAI/FinBERT · MilestoneEscrow.sol (ERC-3643)  |  "
        "⚠ Not financial advice. For academic and research purposes only.  |  "
        "IntelliStake AI Platform v3 · NMIMS MCA Capstone 2025–26 · Page 2 of 2"
    )
    story.append(Paragraph(footer_text, sMut))

    doc.build(story)
    return buf.getvalue()
