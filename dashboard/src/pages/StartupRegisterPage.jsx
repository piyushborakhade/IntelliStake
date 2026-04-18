/**
 * StartupRegisterPage.jsx — Full 10-section startup registration (50 questions)
 * Matches the IntelliStake Startup Questionnaire PDF exactly.
 * Public route: /register/startup
 * POSTs to /api/score-startup and shows trust_score with ArcDial.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = ['FinTech','SaaS','D2C','Deeptech','HealthTech','EdTech','Climate','Mobility','AgriTech','SpaceTech','E-commerce','Gaming','BioTech','Logistics','PropTech'];
const STAGES  = ['Pre-Seed','Seed','Series A','Series B','Series C','Series C+','Pre-IPO'];
const REG_TYPES = ['Private Limited','LLP','One Person Company','Partnership Firm','Sole Proprietorship','Public Limited'];
const PRODUCT_TYPES = ['Physical product','Software / SaaS','Mobile app','Marketplace','Hardware + Software','Consulting / Service','Platform / API'];
const BUILD_TIMES = ['< 3 months','3–6 months','6–12 months','1–2 years','2+ years'];
const PRODUCT_STATUSES = ['Concept / Idea stage','MVP built','Beta — limited users','Launched — paying customers','Scaling — product-market fit confirmed'];
const MARKET_TYPES = ['B2B','B2C','B2B2C','B2G','D2C','Marketplace'];
const TAM_RANGES = ['Under ₹100 Cr','₹100–500 Cr','₹500 Cr – ₹1,000 Cr','₹1,000–5,000 Cr','₹5,000–50,000 Cr','₹50,000 Cr+'];
const MRR_RANGES = ['₹0 (Pre-revenue)','₹1–₹10L','₹10L–₹50L','₹50L–₹1 Cr','₹1 Cr–₹5 Cr','₹5 Cr+'];
const GROWTH_BANDS = ['Declining','0–20% MoM','20–50% MoM','50–100% MoM','100%+ MoM'];
const BURN_RATES = ['< ₹5L/mo','₹5L–₹20L/mo','₹20L–₹50L/mo','₹50L–₹1 Cr/mo','₹1 Cr+/mo'];
const RUNWAYS = ['< 3 months','3–6 months','6–12 months','12–18 months','18–24 months','24+ months'];
const UNIT_ECONOMICS = ['LTV > 3× CAC','LTV 2–3× CAC','LTV 1–2× CAC','LTV < CAC','Not applicable / pre-revenue'];
const FY_REVENUES = ['₹0 (Pre-revenue)','₹1–₹25L','₹25L–₹1 Cr','₹1–5 Cr','₹5–25 Cr','₹25 Cr+'];
const GROSS_MARGINS = ['Negative','0–20%','20–40%','40–60%','60–80%','80%+'];
const ROUND_TYPES = ['No prior funding','Friends & Family','Angel Round','Pre-Seed','Seed','Series A','Series B','Series C+'];
const CUSTOMER_COUNTS = ['0','1–10','10–100','100–1,000','1,000–10,000','10,000–1L','1L+'];
const CEO_EDU_LEVELS = ['Undergraduate','Graduate (MBA/MS/MTech)','IIT/IIM/NIT/BITS','PhD / Research','Dropout (self-taught)','Foreign university'];
const EXIT_COUNTS = ['None','1 exit','2–3 exits','4+ exits'];
const DOMAIN_EXPERTISE = ['Less than 2 years','2–5 years','5–10 years','10+ years'];
const EXIT_STRATEGIES = ['IPO','Strategic acquisition','MBO','Secondary sale','No specific plan yet'];
const ESCROW_OPTS = [
  { val: 'yes',  label: 'Yes — I accept milestone-based escrow', desc: 'Funds released when verified targets are hit.' },
  { val: 'open', label: 'Open to discussion',                    desc: 'Willing to explore structured release terms.' },
  { val: 'no',   label: 'No — prefer direct funding',            desc: 'Standard equity investment, no escrow.' },
];

const ACCENT = '#6366f1';

const STEPS = [
  { id: 'basics',    label: 'Basics',    icon: '🏢' },
  { id: 'product',   label: 'Product',   icon: '⚙️' },
  { id: 'market',    label: 'Market',    icon: '🌐' },
  { id: 'traction',  label: 'Traction',  icon: '📈' },
  { id: 'financials',label: 'Financials',icon: '📊' },
  { id: 'history',   label: 'History',   icon: '🕰️' },
  { id: 'round',     label: 'Round',     icon: '💰' },
  { id: 'team',      label: 'Team',      icon: '👥' },
  { id: 'legal',     label: 'Legal',     icon: '⚖️' },
  { id: 'vision',    label: 'Vision',    icon: '🔭' },
];

// ─── Demo seeds (auto-fill key fields) ───────────────────────────────────────

const DEMO_SEEDS = {
  zepto: {
    startupName: 'Zepto', legalName: 'KiranaKart Technologies Pvt Ltd', regType: 'Private Limited',
    incorporationYear: '2021', hqCity: 'Mumbai', hqState: 'Maharashtra', sector: 'E-commerce', stage: 'Series C',
    coreProblem: 'Grocery delivery in under 10 minutes via dark store model across metro cities.',
    productType: 'Mobile app', buildTime: '6–12 months', productStatus: 'Scaling — product-market fit confirmed',
    patents: 'no', marketType: 'B2C', tam: '₹5,000–50,000 Cr', competitors: 'Blinkit, Swiggy Instamart, Dunzo',
    competitiveAdvantage: 'Fastest delivery speed, highest SKU density, dark store density in metro areas.',
    mrrRange: '₹1 Cr–₹5 Cr', growthRate: '50–100% MoM', customerCount: '10,000–1L', burnRate: '₹20L–₹50L/mo',
    runway: '18–24 months', unitEconomics: 'LTV 2–3× CAC',
    fyRevenue: '₹5–25 Cr', auditedBooks: 'yes', grossMargin: '20–40%', cacVsLtv: 'LTV 2–3× CAC', existingDebt: 'no',
    totalRaised: '₹2,500 Crore', lastRoundType: 'Series C', existingInvestors: 'Y Combinator, Nexus VP, Goodwater Capital',
    valuation: '₹8,000 Crore', capTableClarity: 'yes',
    fundingAsk: '₹500 Crore', useOfFunds: 'Geographic expansion, dark store buildout, tech stack improvements.',
    equityOffered: '5', fundingTimeline: '3 months', escrowAcceptance: 'yes',
    coFounderCount: '2', ceoEducation: 'IIT/IIM/NIT/BITS', priorExits: 'None', teamSize: '7000',
    unfilledRoles: 'no', domainExpertise: '2–5 years', fullTimeFounders: 'yes',
    dpiit: 'yes', legalDisputes: 'no', regulatoryApprovals: 'no', vestingAgreements: 'yes',
    successIn5yr: 'Become India\'s #1 instant commerce platform, 100 cities, IPO by 2028.',
    exitStrategy: 'IPO', whyIntellStake: 'Blockchain-backed trust scores validate our governance for institutional investors.',
  },
  byjus: {
    startupName: "Byju's", legalName: 'Think & Learn Pvt Ltd', regType: 'Private Limited',
    incorporationYear: '2011', hqCity: 'Bengaluru', hqState: 'Karnataka', sector: 'EdTech', stage: 'Pre-IPO',
    coreProblem: 'Personalised K-12 learning for India via video lessons and adaptive assessments.',
    productType: 'Mobile app', buildTime: '2+ years', productStatus: 'Scaling — product-market fit confirmed',
    patents: 'yes', marketType: 'B2C', tam: '₹50,000 Cr+', competitors: 'Unacademy, Vedantu, NCERT',
    competitiveAdvantage: 'Brand recognition, content library, global acquisitions (Aakash, WhiteHat Jr).',
    mrrRange: '₹5 Cr+', growthRate: 'Declining', customerCount: '1L+', burnRate: '₹1 Cr+/mo',
    runway: '3–6 months', unitEconomics: 'LTV < CAC',
    fyRevenue: '₹25 Cr+', auditedBooks: 'no', grossMargin: '20–40%', cacVsLtv: 'LTV < CAC', existingDebt: 'yes',
    totalRaised: '₹17,000 Crore', lastRoundType: 'Series C+', existingInvestors: 'Sequoia, Tiger Global, BlackRock',
    valuation: '₹70,000 Crore', capTableClarity: 'yes',
    fundingAsk: '₹2,000 Crore', useOfFunds: 'Debt restructuring and operational stabilisation.',
    equityOffered: '2', fundingTimeline: '6 months', escrowAcceptance: 'no',
    coFounderCount: '2', ceoEducation: 'Undergraduate', priorExits: 'None', teamSize: '22000',
    unfilledRoles: 'yes', domainExpertise: '10+ years', fullTimeFounders: 'yes',
    dpiit: 'yes', legalDisputes: 'yes', regulatoryApprovals: 'no', vestingAgreements: 'yes',
    successIn5yr: 'Restructure debt, achieve profitability, list on Indian exchanges.',
    exitStrategy: 'IPO', whyIntellStake: 'Need transparent trust scoring to rebuild investor confidence.',
  },
  novatech: {
    startupName: 'NovaTech', legalName: 'NovaTech AI Solutions Pvt Ltd', regType: 'Private Limited',
    incorporationYear: '2023', hqCity: 'Bengaluru', hqState: 'Karnataka', sector: 'Deeptech', stage: 'Seed',
    coreProblem: 'AI-driven material discovery for defence and aerospace applications.',
    productType: 'Software / SaaS', buildTime: '1–2 years', productStatus: 'Beta — limited users',
    patents: 'yes', marketType: 'B2G', tam: '₹1,000–5,000 Cr', competitors: 'Citrine Informatics, Kebotix',
    competitiveAdvantage: 'PhD team with DRDO background, 2 granted patents in AI/ML material simulation.',
    mrrRange: '₹10L–₹50L', growthRate: '20–50% MoM', customerCount: '1–10', burnRate: '₹5L–₹20L/mo',
    runway: '12–18 months', unitEconomics: 'Not applicable / pre-revenue',
    fyRevenue: '₹25L–₹1 Cr', auditedBooks: 'yes', grossMargin: '60–80%', cacVsLtv: 'Not applicable / pre-revenue', existingDebt: 'no',
    totalRaised: '₹50 Lakh', lastRoundType: 'Angel Round', existingInvestors: 'IAN, 2 angel investors',
    valuation: '₹15 Crore', capTableClarity: 'yes',
    fundingAsk: '₹3 Crore', useOfFunds: 'Team expansion, compute infra, defence certification.',
    equityOffered: '10', fundingTimeline: '3 months', escrowAcceptance: 'open',
    coFounderCount: '3', ceoEducation: 'PhD / Research', priorExits: 'None', teamSize: '8',
    unfilledRoles: 'yes', domainExpertise: '5–10 years', fullTimeFounders: 'yes',
    dpiit: 'applied', legalDisputes: 'no', regulatoryApprovals: 'yes', vestingAgreements: 'yes',
    successIn5yr: 'License IP to 5 defence OEMs, Series B, expand to US defence market.',
    exitStrategy: 'Strategic acquisition', whyIntellStake: 'Milestone escrow proves responsible capital use to defence clients.',
  },
};

// ─── ArcDial (unchanged from original) ───────────────────────────────────────

function ArcDial({ score, color }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = null;
    const duration = 1200;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(eased * score));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  const r = 72, cx = 100, cy = 100, sw = 10;
  const arcLen = Math.PI * r;
  const fill = (displayed / 100) * arcLen;
  const gap  = arcLen - fill;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg width="200" height="108" viewBox="0 0 200 108" style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={`${fill} ${gap}`}
        style={{ filter: `drop-shadow(0 0 10px ${color}90)` }}
      />
      <text x={cx} y={cy - 10} textAnchor="middle" fill={color} fontSize="32" fontWeight="900" fontFamily="DM Mono, monospace">{displayed}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(148,163,184,0.55)" fontSize="11">/100</text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StartupRegisterPage() {
  const navigate = useNavigate();
  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState(null);

  // Section 1: Company Basics
  const [startupName,     setStartupName]     = useState('');
  const [legalName,       setLegalName]       = useState('');
  const [regType,         setRegType]         = useState('');
  const [incorporationYear, setIncorporationYear] = useState('');
  const [hqCity,          setHqCity]          = useState('');
  const [hqState,         setHqState]         = useState('');
  const [sector,          setSector]          = useState('');
  const [stage,           setStage]           = useState('');

  // Section 2: Problem & Product
  const [coreProblem,     setCoreProblem]     = useState('');
  const [productType,     setProductType]     = useState('');
  const [buildTime,       setBuildTime]       = useState('');
  const [productStatus,   setProductStatus]   = useState('');
  const [patents,         setPatents]         = useState('');

  // Section 3: Market
  const [marketType,      setMarketType]      = useState('');
  const [tam,             setTam]             = useState('');
  const [competitors,     setCompetitors]     = useState('');
  const [competitiveAdvantage, setCompetitiveAdvantage] = useState('');

  // Section 4: Traction & Revenue
  const [mrrRange,        setMrrRange]        = useState('');
  const [growthRate,      setGrowthRate]      = useState('');
  const [customerCount,   setCustomerCount]   = useState('');
  const [burnRate,        setBurnRate]        = useState('');
  const [runway,          setRunway]          = useState('');
  const [unitEconomics,   setUnitEconomics]   = useState('');

  // Section 5: Financials
  const [fyRevenue,       setFyRevenue]       = useState('');
  const [auditedBooks,    setAuditedBooks]    = useState('');
  const [grossMargin,     setGrossMargin]     = useState('');
  const [cacVsLtv,        setCacVsLtv]        = useState('');
  const [existingDebt,    setExistingDebt]    = useState('');

  // Section 6: Funding History
  const [totalRaised,     setTotalRaised]     = useState('');
  const [lastRoundType,   setLastRoundType]   = useState('');
  const [existingInvestors, setExistingInvestors] = useState('');
  const [valuation,       setValuation]       = useState('');
  const [capTableClarity, setCapTableClarity] = useState('');

  // Section 7: This Funding Round
  const [fundingAsk,      setFundingAsk]      = useState('');
  const [useOfFunds,      setUseOfFunds]      = useState('');
  const [equityOffered,   setEquityOffered]   = useState('');
  const [fundingTimeline, setFundingTimeline] = useState('');
  const [escrowAcceptance, setEscrowAcceptance] = useState('');

  // Section 8: Team
  const [coFounderCount,  setCoFounderCount]  = useState('');
  const [ceoEducation,    setCeoEducation]    = useState('');
  const [priorExits,      setPriorExits]      = useState('');
  const [teamSize,        setTeamSize]        = useState('');
  const [unfilledRoles,   setUnfilledRoles]   = useState('');
  const [domainExpertise, setDomainExpertise] = useState('');
  const [fullTimeFounders, setFullTimeFounders] = useState('');

  // Section 9: Legal & Compliance
  const [dpiit,           setDpiit]           = useState('');
  const [legalDisputes,   setLegalDisputes]   = useState('');
  const [regulatoryApprovals, setRegulatoryApprovals] = useState('');
  const [vestingAgreements, setVestingAgreements] = useState('');

  // Section 10: Founder's Vision
  const [successIn5yr,    setSuccessIn5yr]    = useState('');
  const [exitStrategy,    setExitStrategy]    = useState('');
  const [whyIntelliStake, setWhyIntelliStake] = useState('');

  const currentYear = new Date().getFullYear();

  const loadSeed = (key) => {
    const s = DEMO_SEEDS[key];
    if (!s) return;
    setStartupName(s.startupName); setLegalName(s.legalName); setRegType(s.regType);
    setIncorporationYear(s.incorporationYear); setHqCity(s.hqCity); setHqState(s.hqState);
    setSector(s.sector); setStage(s.stage);
    setCoreProblem(s.coreProblem); setProductType(s.productType); setBuildTime(s.buildTime);
    setProductStatus(s.productStatus); setPatents(s.patents);
    setMarketType(s.marketType); setTam(s.tam); setCompetitors(s.competitors);
    setCompetitiveAdvantage(s.competitiveAdvantage);
    setMrrRange(s.mrrRange); setGrowthRate(s.growthRate); setCustomerCount(s.customerCount);
    setBurnRate(s.burnRate); setRunway(s.runway); setUnitEconomics(s.unitEconomics);
    setFyRevenue(s.fyRevenue); setAuditedBooks(s.auditedBooks); setGrossMargin(s.grossMargin);
    setCacVsLtv(s.cacVsLtv); setExistingDebt(s.existingDebt);
    setTotalRaised(s.totalRaised); setLastRoundType(s.lastRoundType); setExistingInvestors(s.existingInvestors);
    setValuation(s.valuation); setCapTableClarity(s.capTableClarity);
    setFundingAsk(s.fundingAsk); setUseOfFunds(s.useOfFunds); setEquityOffered(s.equityOffered);
    setFundingTimeline(s.fundingTimeline); setEscrowAcceptance(s.escrowAcceptance);
    setCoFounderCount(s.coFounderCount); setCeoEducation(s.ceoEducation); setPriorExits(s.priorExits);
    setTeamSize(s.teamSize); setUnfilledRoles(s.unfilledRoles); setDomainExpertise(s.domainExpertise);
    setFullTimeFounders(s.fullTimeFounders);
    setDpiit(s.dpiit); setLegalDisputes(s.legalDisputes); setRegulatoryApprovals(s.regulatoryApprovals);
    setVestingAgreements(s.vestingAgreements);
    setSuccessIn5yr(s.successIn5yr); setExitStrategy(s.exitStrategy); setWhyIntelliStake(s.whyIntelliStake);
    setError('');
  };

  const validates = [
    // Step 0 — Company Basics
    () => !startupName.trim() ? 'Startup brand name is required.'
        : !legalName.trim() ? 'Legal registered name is required.'
        : !regType ? 'Please select registration type.'
        : !incorporationYear || +incorporationYear < 1990 || +incorporationYear > currentYear ? `Year must be 1990–${currentYear}.`
        : !hqCity.trim() ? 'HQ city is required.'
        : !sector ? 'Please select a sector.'
        : !stage ? 'Please select a stage.' : '',
    // Step 1 — Product
    () => !coreProblem.trim() ? 'Describe the core problem.'
        : !productType ? 'Select product type.'
        : !buildTime ? 'Select build time.'
        : !productStatus ? 'Select product status.' : '',
    // Step 2 — Market
    () => !marketType ? 'Select market type.'
        : !tam ? 'Select TAM range.'
        : !competitiveAdvantage.trim() ? 'Describe your competitive advantage.' : '',
    // Step 3 — Traction
    () => !mrrRange ? 'Select MRR range.'
        : !growthRate ? 'Select growth rate.'
        : !burnRate ? 'Select burn rate.'
        : !runway ? 'Select runway.' : '',
    // Step 4 — Financials
    () => !fyRevenue ? 'Select FY revenue.'
        : !grossMargin ? 'Select gross margin.' : '',
    // Step 5 — Funding History
    () => !lastRoundType ? 'Select last round type.' : '',
    // Step 6 — This Round
    () => !fundingAsk.trim() ? 'Funding ask is required.'
        : !equityOffered.trim() || isNaN(+equityOffered) || +equityOffered <= 0 || +equityOffered > 100 ? 'Equity must be 0.1–100%.'
        : !escrowAcceptance ? 'Select escrow preference.' : '',
    // Step 7 — Team
    () => !coFounderCount.trim() ? 'Co-founder count required.'
        : !ceoEducation ? 'Select CEO education.'
        : !teamSize || +teamSize < 1 ? 'Enter a valid team size.' : '',
    // Step 8 — Legal
    () => !dpiit ? 'Select DPIIT status.' : '',
    // Step 9 — Vision
    () => !successIn5yr.trim() ? 'Describe your 5-year success.'
        : !exitStrategy ? 'Select exit strategy.' : '',
  ];

  const next = () => {
    const err = validates[step]?.() || '';
    if (err) { setError(err); return; }
    setError(''); setStep(s => s + 1);
  };
  const back = () => { setError(''); setStep(s => s - 1); };

  const submit = async () => {
    const err = validates[step]?.() || '';
    if (err) { setError(err); return; }
    setLoading(true); setError('');
    const payload = {
      startup_name: startupName.trim(),
      legal_name: legalName.trim(),
      reg_type: regType,
      sector, stage,
      incorporation_year: +incorporationYear,
      hq_city: hqCity, hq_state: hqState,
      core_problem: coreProblem.trim(),
      product_type: productType, build_time: buildTime,
      product_status: productStatus, patents: patents === 'yes',
      market_type: marketType, tam, competitors: competitors.trim(),
      competitive_advantage: competitiveAdvantage.trim(),
      mrr_range: mrrRange, revenue_growth: growthRate,
      customer_count: customerCount, burn_rate: burnRate, runway,
      unit_economics: unitEconomics,
      fy_revenue: fyRevenue, audited_books: auditedBooks === 'yes',
      gross_margin: grossMargin, existing_debt: existingDebt === 'yes',
      total_raised: totalRaised.trim(), last_round_type: lastRoundType,
      existing_investors: existingInvestors.trim(), valuation: valuation.trim(),
      cap_table_clarity: capTableClarity === 'yes',
      funding_ask: fundingAsk.trim(), use_of_funds: useOfFunds.trim(),
      equity_offered: +equityOffered, funding_timeline: fundingTimeline,
      escrow_acceptance: escrowAcceptance,
      co_founder_count: +coFounderCount || 0,
      ceo_education: ceoEducation, prior_exits: priorExits,
      team_size: +teamSize, unfilled_roles: unfilledRoles === 'yes',
      domain_expertise: domainExpertise, full_time_founders: fullTimeFounders === 'yes',
      dpiit_recognized: dpiit === 'yes' || dpiit === 'applied',
      dpiit_status: dpiit,
      legal_disputes: legalDisputes === 'yes',
      regulatory_approvals_needed: regulatoryApprovals === 'yes',
      vesting_agreements: vestingAgreements === 'yes',
      success_in_5yr: successIn5yr.trim(),
      exit_strategy: exitStrategy, why_intellistake: whyIntelliStake.trim(),
    };
    try {
      const res = await fetch(`${API}/api/score-startup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styling helpers ──────────────────────────────────────────────────

  const card = (content) => (
    <div style={{
      background: '#0a0a0f', borderRadius: 24, border: '1px solid rgba(99,102,241,0.2)',
      padding: '36px 40px', maxWidth: 600, width: '100%',
      boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
    }}>
      {content}
    </div>
  );

  const lbl = (text) => (
    <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>{text}</div>
  );

  const inp = (value, onChange, placeholder, type = 'text') => (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#f0f4ff', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
      onFocus={e => e.target.style.borderColor = ACCENT}
      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
    />
  );

  const sel = (value, onChange, options, placeholder) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: value ? '#f0f4ff' : '#475569', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
    >
      <option value="" disabled style={{ background: '#0a0a0f', color: '#475569' }}>{placeholder}</option>
      {options.map(o => <option key={o} value={o} style={{ background: '#0a0a0f', color: '#f0f4ff' }}>{o}</option>)}
    </select>
  );

  const textarea = (value, onChange, placeholder, rows = 3) => (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#f0f4ff', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6, transition: 'border-color 0.15s' }}
      onFocus={e => e.target.style.borderColor = ACCENT}
      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
    />
  );

  const boolRadio = (value, onChange, yesLabel = 'Yes', noLabel = 'No') => (
    <div style={{ display: 'flex', gap: 10 }}>
      {[[yesLabel, 'yes'], [noLabel, 'no']].map(([label, val]) => (
        <button key={val} onClick={() => onChange(val)} style={{
          flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: value === val ? 700 : 400,
          border: `1px solid ${value === val ? ACCENT + '50' : 'rgba(255,255,255,0.08)'}`,
          background: value === val ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
          color: value === val ? '#c7d2fe' : '#475569', cursor: 'pointer', transition: 'all 0.15s',
        }}>{label}</button>
      ))}
    </div>
  );

  const optCard = (val, current, set, title, desc) => (
    <div key={val} onClick={() => set(val)} style={{
      padding: '11px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
      background: current === val ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${current === val ? ACCENT + '50' : 'rgba(255,255,255,0.06)'}`,
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: `2px solid ${current === val ? ACCENT : 'rgba(255,255,255,0.2)'}`, background: current === val ? ACCENT : 'transparent' }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: current === val ? '#c7d2fe' : '#94a3b8' }}>{title}</div>
          {desc && <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{desc}</div>}
        </div>
      </div>
    </div>
  );

  const field = (labelText, content) => (
    <div style={{ marginBottom: 18 }}>
      {lbl(labelText)}
      {content}
    </div>
  );

  const navRow = (isLast = false) => (
    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
      {step > 0 && (
        <button onClick={back} style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Back
        </button>
      )}
      <button onClick={isLast ? submit : next} disabled={loading}
        style={{ flex: 1, padding: '12px', borderRadius: 11, border: 'none', cursor: loading ? 'default' : 'pointer', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif', opacity: loading ? 0.55 : 1, boxShadow: loading ? 'none' : '0 6px 20px rgba(99,102,241,0.35)', transition: 'all 0.2s' }}>
        {loading ? 'Scoring…' : isLast ? 'Submit & Score →' : 'Continue →'}
      </button>
    </div>
  );

  const sectionHead = (title, sub) => (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 12, color: '#475569', marginBottom: 24 }}>{sub}</p>
    </>
  );

  // ── Results screen ──────────────────────────────────────────────────────────

  if (result) {
    const rawScore = result.trust_score ?? result.score ?? null;
    const score100 = rawScore !== null ? Math.round(rawScore * 100) : null;
    const risk     = result.risk_flag ?? result.risk ?? null;
    const hype     = result.hype_status ?? result.hype ?? null;
    const survival = result.survival_probability ?? null;
    const shaps    = Array.isArray(result.shap_factors) ? result.shap_factors.slice(0, 3) : [];
    const scoreColor = score100 >= 70 ? '#10b981' : score100 >= 50 ? '#f59e0b' : '#ef4444';
    const scoreLabel = score100 >= 70 ? 'Strong' : score100 >= 50 ? 'Moderate' : 'High Risk';

    const statPill = (icon, label, value, color) => (
      <div style={{ flex: 1, padding: '14px 16px', borderRadius: 14, background: `${color}0d`, border: `1px solid ${color}25`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 18, fontWeight: 900, color, fontFamily: 'DM Mono, monospace' }}>{value}</span>
        <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</span>
      </div>
    );

    const SHAP_LABELS = {
      mrr_range: 'Revenue (MRR)', burn_rate: 'Burn Rate', runway: 'Runway',
      revenue_growth: 'Growth Rate', equity_offered: 'Equity %',
      escrow_acceptance: 'Escrow Trust', team_size: 'Team Size',
      dpiit_recognized: 'DPIIT Status', ceo_background: 'Founder Pedigree',
      audited_books: 'Audited Books', gross_margin: 'Gross Margin',
      prior_exits: 'Prior Exits', patents: 'Patents',
    };

    const resetForm = () => {
      setResult(null); setStep(0);
      setStartupName(''); setLegalName(''); setRegType(''); setIncorporationYear('');
      setHqCity(''); setHqState(''); setSector(''); setStage('');
      setCoreProblem(''); setProductType(''); setBuildTime(''); setProductStatus(''); setPatents('');
      setMarketType(''); setTam(''); setCompetitors(''); setCompetitiveAdvantage('');
      setMrrRange(''); setGrowthRate(''); setCustomerCount(''); setBurnRate(''); setRunway(''); setUnitEconomics('');
      setFyRevenue(''); setAuditedBooks(''); setGrossMargin(''); setCacVsLtv(''); setExistingDebt('');
      setTotalRaised(''); setLastRoundType(''); setExistingInvestors(''); setValuation(''); setCapTableClarity('');
      setFundingAsk(''); setUseOfFunds(''); setEquityOffered(''); setFundingTimeline(''); setEscrowAcceptance('');
      setCoFounderCount(''); setCeoEducation(''); setPriorExits(''); setTeamSize('');
      setUnfilledRoles(''); setDomainExpertise(''); setFullTimeFounders('');
      setDpiit(''); setLegalDisputes(''); setRegulatoryApprovals(''); setVestingAgreements('');
      setSuccessIn5yr(''); setExitStrategy(''); setWhyIntelliStake('');
    };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base, #060610)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, backgroundImage: 'radial-gradient(ellipse at 50% -10%, rgba(99,102,241,0.14) 0%, transparent 60%)' }}>
        <div style={{ background: '#0a0a0f', borderRadius: 24, border: '1px solid rgba(99,102,241,0.2)', padding: '36px 40px', maxWidth: 560, width: '100%', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: '#334155', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>INTELLISTAKE TRUST ENGINE</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{startupName || 'Startup'} scored</h2>
            <p style={{ fontSize: 12, color: '#334155' }}>{result.scoring_path === 'dataset_match' ? 'Matched against 74,577 startup dataset' : 'Scored via rule-based trust engine'}</p>
          </div>
          {score100 !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '12px 0 8px' }}>
              <ArcDial score={score100} color={scoreColor} />
              <div style={{ marginTop: -4, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 999, background: `${scoreColor}15`, border: `1px solid ${scoreColor}30` }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: scoreColor, display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor, letterSpacing: '0.06em' }}>{scoreLabel.toUpperCase()}</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, margin: '20px 0' }}>
            {risk && statPill(risk === 'low' ? '🟢' : risk === 'medium' ? '🟡' : '🔴', 'RISK', risk.charAt(0).toUpperCase() + risk.slice(1), risk === 'low' ? '#10b981' : risk === 'medium' ? '#f59e0b' : '#ef4444')}
            {hype && statPill(hype === 'high' ? '🔥' : hype === 'medium' ? '⚡' : '💧', 'HYPE', hype.charAt(0).toUpperCase() + hype.slice(1), '#a78bfa')}
            {survival !== null && statPill('🧬', 'SURVIVAL', `${Math.round(survival * 100)}%`, '#38bdf8')}
          </div>
          {shaps.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>TOP TRUST DRIVERS</div>
              {shaps.map((f, i) => {
                const isPos = f.direction === 'positive' || f.value > 0;
                const col   = isPos ? '#10b981' : '#ef4444';
                const pct   = Math.min(Math.abs(f.value || f.impact || 0) * 200, 100);
                const name  = SHAP_LABELS[f.factor] || f.factor?.replace(/_/g, ' ');
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{name}</span>
                      <span style={{ fontSize: 11, color: col, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{isPos ? '▲' : '▼'} {Math.abs(f.value || f.impact || 0).toFixed(3)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: col, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {escrowAcceptance === 'yes' && (
            <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔐</span>
              <div>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, letterSpacing: '0.05em' }}>ESCROW ACCEPTED</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Milestone-based release earns +8 trust points. Funds unlock on verified targets.</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={resetForm} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#475569', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Register Another</button>
            <button onClick={() => navigate('/login')} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', boxShadow: '0 6px 20px rgba(99,102,241,0.35)' }}>Go to Login →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Multi-step form ─────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base, #060610)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', backgroundImage: 'radial-gradient(ellipse at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 60%)' }}>

      {/* Progress */}
      <div style={{ width: '100%', maxWidth: 600, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{STEPS[step].icon}</span>
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 700, letterSpacing: '0.06em' }}>
              SECTION {step + 1}/10 — {STEPS[step].label.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#334155', fontFamily: 'DM Mono, monospace' }}>{step + 1} / 10</div>
        </div>
        <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#6366f1,#818cf8)', width: `${((step + 1) / 10) * 100}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Demo seeds — always visible on step 0 */}
      {step === 0 && (
        <div style={{ width: '100%', maxWidth: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.08em' }}>LOAD DEMO</span>
          {Object.entries(DEMO_SEEDS).map(([key, seed]) => (
            <button key={key} onClick={() => loadSeed(key)} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', transition: 'all 0.15s' }}>
              {seed.startupName}
            </button>
          ))}
        </div>
      )}

      {/* ── SECTION 1: Company Basics ── */}
      {step === 0 && card(<>
        {sectionHead('Company Basics', 'Legal identity, location, and stage of your startup.')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>{field('STARTUP BRAND NAME', inp(startupName, setStartupName, 'e.g. Razorpay'))}</div>
          <div style={{ gridColumn: '1 / -1' }}>{field('LEGAL REGISTERED NAME', inp(legalName, setLegalName, 'e.g. Razorpay Software Pvt Ltd'))}</div>
          {field('REGISTRATION TYPE', sel(regType, setRegType, REG_TYPES, 'Select…'))}
          {field('YEAR OF INCORPORATION', inp(incorporationYear, setIncorporationYear, `e.g. ${currentYear - 3}`, 'number'))}
          {field('HQ CITY', inp(hqCity, setHqCity, 'e.g. Bengaluru'))}
          {field('HQ STATE', inp(hqState, setHqState, 'e.g. Karnataka'))}
          {field('SECTOR', sel(sector, setSector, SECTORS, 'Select sector…'))}
          {field('FUNDING STAGE', sel(stage, setStage, STAGES, 'Select stage…'))}
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 2: Problem & Product ── */}
      {step === 1 && card(<>
        {sectionHead('Problem & Product', 'What you\'re building and how far along you are.')}
        {field('CORE PROBLEM YOU SOLVE (2–3 sentences)', textarea(coreProblem, setCoreProblem, 'Describe the real-world problem your startup addresses…'))}
        {field('PRODUCT TYPE', sel(productType, setProductType, PRODUCT_TYPES, 'Select…'))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('TIME TO BUILD MVP', sel(buildTime, setBuildTime, BUILD_TIMES, 'Select…'))}
          {field('CURRENT PRODUCT STATUS', sel(productStatus, setProductStatus, PRODUCT_STATUSES, 'Select…'))}
        </div>
        <div style={{ marginBottom: 18 }}>
          {lbl('DO YOU HOLD ANY PATENTS OR IP?')}
          {boolRadio(patents, setPatents, 'Yes — filed / granted', 'No patents yet')}
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 3: Market ── */}
      {step === 2 && card(<>
        {sectionHead('Market', 'Size, structure, and competitive landscape.')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('TARGET MARKET TYPE', sel(marketType, setMarketType, MARKET_TYPES, 'Select…'))}
          {field('TOTAL ADDRESSABLE MARKET (TAM)', sel(tam, setTam, TAM_RANGES, 'Select…'))}
        </div>
        {field('TOP 3 COMPETITORS', inp(competitors, setCompetitors, 'e.g. Zepto, Blinkit, Dunzo'))}
        {field('YOUR COMPETITIVE ADVANTAGE', textarea(competitiveAdvantage, setCompetitiveAdvantage, 'What gives you an edge competitors can\'t easily replicate?'))}
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 4: Traction & Revenue ── */}
      {step === 3 && card(<>
        {sectionHead('Traction & Revenue', 'Current business performance and unit economics.')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('MONTHLY RECURRING REVENUE', sel(mrrRange, setMrrRange, MRR_RANGES, 'Select…'))}
          {field('MONTH-OVER-MONTH GROWTH', sel(growthRate, setGrowthRate, GROWTH_BANDS, 'Select…'))}
          {field('PAYING CUSTOMER COUNT', sel(customerCount, setCustomerCount, CUSTOMER_COUNTS, 'Select…'))}
          {field('MONTHLY BURN RATE', sel(burnRate, setBurnRate, BURN_RATES, 'Select…'))}
          {field('RUNWAY', sel(runway, setRunway, RUNWAYS, 'How long until next raise…'))}
          {field('UNIT ECONOMICS (LTV vs CAC)', sel(unitEconomics, setUnitEconomics, UNIT_ECONOMICS, 'Select…'))}
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 5: Financials ── */}
      {step === 4 && card(<>
        {sectionHead('Financials', 'Last fiscal year financial health and obligations.')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('FY REVENUE (LAST FULL YEAR)', sel(fyRevenue, setFyRevenue, FY_REVENUES, 'Select…'))}
          {field('GROSS MARGIN', sel(grossMargin, setGrossMargin, GROSS_MARGINS, 'Select…'))}
          {field('LTV vs CAC RATIO', sel(cacVsLtv, setCacVsLtv, UNIT_ECONOMICS, 'Select…'))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
          <div>
            {lbl('BOOKS AUDITED BY CA?')}
            {boolRadio(auditedBooks, setAuditedBooks)}
          </div>
          <div>
            {lbl('ANY EXISTING DEBT / LOANS?')}
            {boolRadio(existingDebt, setExistingDebt)}
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 6: Funding History ── */}
      {step === 5 && card(<>
        {sectionHead('Funding History', 'Previous capital raised and current cap table.')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('TOTAL CAPITAL RAISED TO DATE', inp(totalRaised, setTotalRaised, 'e.g. ₹12 Crore'))}
          {field('LAST ROUND TYPE', sel(lastRoundType, setLastRoundType, ROUND_TYPES, 'Select…'))}
          <div style={{ gridColumn: '1 / -1' }}>{field('EXISTING INVESTORS (names or firms)', inp(existingInvestors, setExistingInvestors, 'e.g. Sequoia, Blume, 3 angels'))}</div>
          {field('CURRENT VALUATION', inp(valuation, setValuation, 'e.g. ₹50 Crore'))}
        </div>
        <div style={{ marginTop: 4 }}>
          {lbl('IS YOUR CAP TABLE CLEAN AND CLEAR?')}
          {boolRadio(capTableClarity, setCapTableClarity, 'Yes — clean cap table', 'No — complex / disputes')}
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 7: This Funding Round ── */}
      {step === 6 && card(<>
        {sectionHead('This Funding Round', 'What you\'re raising, how you\'ll use it, and escrow preference.')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('FUNDING ASK (THIS ROUND)', inp(fundingAsk, setFundingAsk, 'e.g. ₹5 Crore'))}
          {field('EQUITY OFFERED (%)', inp(equityOffered, setEquityOffered, 'e.g. 8', 'number'))}
          {field('TARGET CLOSE TIMELINE', sel(fundingTimeline, setFundingTimeline, ['1 month','2 months','3 months','6 months','Open-ended'], 'Select…'))}
        </div>
        {field('USE OF FUNDS (brief breakdown)', textarea(useOfFunds, setUseOfFunds, 'e.g. 40% product, 35% hiring, 25% marketing…', 2))}
        <div style={{ marginBottom: 18 }}>
          {lbl('MILESTONE-BASED ESCROW PREFERENCE')}
          {ESCROW_OPTS.map(o => optCard(o.val, escrowAcceptance, setEscrowAcceptance, o.label, o.desc))}
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 8: Team ── */}
      {step === 7 && card(<>
        {sectionHead('Team', 'Investor trust correlates heavily with founder pedigree and team depth.')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('NUMBER OF CO-FOUNDERS', inp(coFounderCount, setCoFounderCount, 'e.g. 2', 'number'))}
          {field('FULL-TIME TEAM SIZE', inp(teamSize, setTeamSize, 'e.g. 12', 'number'))}
          {field('CEO / LEAD FOUNDER EDUCATION', sel(ceoEducation, setCeoEducation, CEO_EDU_LEVELS, 'Select…'))}
          {field('PRIOR STARTUP EXITS', sel(priorExits, setPriorExits, EXIT_COUNTS, 'Select…'))}
          {field('DOMAIN EXPERTISE (years)', sel(domainExpertise, setDomainExpertise, DOMAIN_EXPERTISE, 'Select…'))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
          <div>
            {lbl('KEY ROLES STILL UNFILLED?')}
            {boolRadio(unfilledRoles, setUnfilledRoles)}
          </div>
          <div>
            {lbl('ALL FOUNDERS FULL-TIME?')}
            {boolRadio(fullTimeFounders, setFullTimeFounders)}
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 9: Legal & Compliance ── */}
      {step === 8 && card(<>
        {sectionHead('Legal & Compliance', 'Clean legal standing improves trust score significantly.')}
        <div style={{ marginBottom: 18 }}>
          {lbl('DPIIT RECOGNITION STATUS')}
          {[
            { val: 'yes',     label: 'Yes — DPIIT recognised startup', desc: 'Certificate of recognition from Dept. for Promotion of Industry.' },
            { val: 'applied', label: 'Applied — awaiting recognition', desc: 'Application submitted, pending.' },
            { val: 'no',      label: 'No — not yet applied', desc: 'Have not applied for DPIIT recognition.' },
          ].map(o => optCard(o.val, dpiit, setDpiit, o.label, o.desc))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            {lbl('ANY ONGOING LEGAL DISPUTES?')}
            {boolRadio(legalDisputes, setLegalDisputes)}
          </div>
          <div>
            {lbl('REGULATORY APPROVALS NEEDED?')}
            {boolRadio(regulatoryApprovals, setRegulatoryApprovals)}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {lbl('VESTING AGREEMENTS IN PLACE FOR FOUNDERS?')}
            {boolRadio(vestingAgreements, setVestingAgreements)}
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow()}
      </>)}

      {/* ── SECTION 10: Founder's Vision ── */}
      {step === 9 && card(<>
        {sectionHead('Founder\'s Vision', 'Investors back conviction and clarity of purpose as much as metrics.')}
        {field('WHERE DO YOU SEE THE COMPANY IN 5 YEARS?', textarea(successIn5yr, setSuccessIn5yr, 'Be specific — revenue target, markets, milestones…'))}
        <div style={{ marginBottom: 18 }}>
          {lbl('PREFERRED EXIT STRATEGY')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {EXIT_STRATEGIES.map(opt => (
              <button key={opt} onClick={() => setExitStrategy(opt)} style={{
                padding: '9px 12px', borderRadius: 9, fontSize: 12, fontWeight: exitStrategy === opt ? 700 : 400,
                border: `1px solid ${exitStrategy === opt ? ACCENT + '50' : 'rgba(255,255,255,0.08)'}`,
                background: exitStrategy === opt ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                color: exitStrategy === opt ? '#c7d2fe' : '#475569', cursor: 'pointer', transition: 'all 0.15s',
              }}>{opt}</button>
            ))}
          </div>
        </div>
        {field('WHY INTELLISTAKE? (optional)', textarea(whyIntelliStake, setWhyIntelliStake, 'Why are you choosing blockchain-governed VC funding?', 2))}
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
        {navRow(true)}
      </>)}
    </div>
  );
}
