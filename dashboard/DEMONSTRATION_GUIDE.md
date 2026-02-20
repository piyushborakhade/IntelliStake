# IntelliStake Dashboard - Quick Start Guide

## 🚀 Running the Dashboard

### Step 1: Navigate to Dashboard
```bash
cd /Users/piyushborakhade/Desktop/Capstone/intellistake-dashboard
```

### Step 2: Start Server
```bash
npm run dev
```

### Step 3: Open Browser
Navigate to: **http://localhost:5173**

---

## 📍 Dashboard Structure

### Pages Available

1. **Home** (`/`) - Landing page with project overview
2. **AI Valuation** (`/phase1`) - Phase 1 AI engine showcase  
3. **Portfolio** (`/phase2-finance`) - Black-Litterman optimizer
4. **Blockchain** (`/phase2-blockchain`) - ERC-3643 smart contract
5. **Oracle** (`/phase2-oracle`) - Chainlink integration
6. **Architecture** (`/architecture`) - Complete system overview

---

## 🎓 Professor Demonstration Script

### 1. Start at Homepage (30 seconds)
- Show animated gradient background
- Highlight three domains: AI, Finance, Blockchain
- Point out key metrics: 0.88 R², 9.99% return, ERC-3643

### 2. Navigate to AI Valuation (2 minutes)
- Explain XGBoost + LightGBM models
- Show feature importance chart (employee count 71.3%)
- Discuss R² scores (0.87-0.89)

### 3. Navigate to Portfolio (2 minutes)
- Explain Black-Litterman methodology
- Show portfolio allocation pie chart
- Highlight 9.99% expected return, 0.388 Sharpe ratio

### 4. Navigate to Blockchain (1.5 minutes)
- Explain ERC-3643 compliance
- Walk through milestone escrow flow (5 steps)
- Show compliance checks

### 5. Navigate to Oracle (1.5 minutes)
- Show data flow: Python → Chainlink → Ethereum
- Explain EVM encoding (float → uint256)
- Discuss reliability features

### 6. Navigate to Architecture (1 minute)
- Show end-to-end flow diagram
- Review technical specifications table
- Mention future roadmap

**Total Time**: 8-10 minutes

---

## ✅ Verification Checklist

Before demonstrating:
- [ ] Server running on `localhost:5173`
- [ ] Homepage loads with animated background
- [ ] Phase 1 chart displays correctly
- [ ] Phase 2 Finance pie chart loads
- [ ] All navigation links work
- [ ] Data from CSV appears in tables

---

## 🛠️ Troubleshooting

### Server won't start
```bash
# Reinstall dependencies
npm install
npm run dev
```

### Charts not displaying
- Check browser console (F12)
- Verify Chart.js installed: `npm list chart.js`

### CSV data not loading
- Verify file exists: `ls public/Phase_2_Dev/investment_recommendations.csv`
- Check browser Network tab for 404 errors

---

## 📊 Key Features to Highlight

### Visual Design
- Dark fintech theme with glassmorphism
- Animated gradient orbs
- Smooth transitions and hover effects
- Professional color scheme (purple-blue gradients)

### Interactive Elements
- Chart.js visualizations (bar, pie charts)
- Sortable data tables
- Responsive navigation menu
- Code syntax highlighting

### Technical Depth
- Real CSV data loading (PapaParse)
- React Router for SPA navigation
- Component-based architecture
- Custom design system (600+ lines CSS)

---

## 🎯 What This Demonstrates

1. **Full-stack capability**: Frontend development with React
2. **Data visualization**: Interactive charts and tables
3. **Design expertise**: Modern UI/UX principles
4. **Technical breadth**: AI + Finance + Blockchain integration
5. **Professional presentation**: Production-ready dashboard

---

**Access**: `http://localhost:5173`  
**Port**: 5173  
**Framework**: Vite + React  
**Status**: ✅ Production Ready
