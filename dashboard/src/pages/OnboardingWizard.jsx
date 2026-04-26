/**
 * OnboardingWizard.jsx — Full 15-question investor onboarding (6 sections)
 * Matches the IntelliStake Investor Questionnaire PDF exactly.
 * Saves complete investor DNA to Supabase (investor_profiles) + sessionStorage.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveInvestorDNA } from '../utils/supabase';


// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = ['FinTech','SaaS','D2C','Deeptech','HealthTech','EdTech','Climate','Mobility','AgriTech','SpaceTech','E-commerce','Gaming','BioTech','Logistics','PropTech'];

const INVEST_AMOUNTS = [
  { val: 'under_10k',   label: '₹10,000 – ₹50,000',  desc: 'Micro angel · Entry level' },
  { val: '50k_2l',      label: '₹50,000 – ₹2 Lakh',  desc: 'Small angel · Experimenting' },
  { val: '2l_10l',      label: '₹2L – ₹10L',          desc: 'Retail angel · Building conviction' },
  { val: '10l_50l',     label: '₹10L – ₹50L',         desc: 'Accredited angel · Active investor' },
  { val: '50l_plus',    label: '₹50L+',               desc: 'HNWI / Institutional' },
];

const INVEST_STYLES = [
  { val: 'lump_sum',     label: 'Lump Sum',             desc: 'Single upfront capital deployment' },
  { val: 'monthly',      label: 'Monthly SIP',          desc: 'Systematic monthly investment' },
  { val: 'opportunistic',label: 'Opportunistic',        desc: 'Deploy when strong deals appear' },
  { val: 'mix',          label: 'Mix of the above',     desc: 'Flexible based on opportunity' },
];

const TIME_HORIZONS = [
  { val: 'under_1yr', label: 'Under 1 year',    desc: 'Short-term, quick exits preferred' },
  { val: '1_3yr',     label: '1–3 years',        desc: 'Growth stage, medium horizon' },
  { val: '3_7yr',     label: '3–7 years',        desc: 'Full startup maturity cycle' },
  { val: '7yr_plus',  label: '7+ years',         desc: 'Long-term, VC-style patience' },
];

const DROP_RESPONSES = [
  { val: 'sell_all',  label: 'Sell everything', desc: 'Capital preservation is critical' },
  { val: 'sell_some', label: 'Sell some positions', desc: 'Partial exit to reduce exposure' },
  { val: 'hold',      label: 'Hold and wait', desc: 'Trust the fundamentals, stay invested' },
  { val: 'buy_more',  label: 'Buy more', desc: 'Great discount — double down' },
];

const ANGEL_EXPERIENCE = [
  { val: 'none',    label: 'No prior experience', desc: 'First time investing in startups' },
  { val: 'some',    label: '1–3 investments',     desc: 'Exploring the asset class' },
  { val: 'active',  label: '4–10 investments',    desc: 'Active angel investor' },
  { val: 'veteran', label: '10+ investments',     desc: 'Seasoned angel / VC background' },
];

const RISK_CONCERNS = [
  'Loss of principal',
  'Illiquidity / no easy exit',
  'Founder execution risk',
  'Market timing risk',
  'Regulatory changes',
  'Valuation inflation',
  'Scam / fraud risk',
];

const GEO_DIVERSIFICATION = [
  { val: 'india_only', label: 'India only',           desc: 'Focus on domestic startups' },
  { val: 'india_se_asia', label: 'India + SE Asia',   desc: 'Regional diversification' },
  { val: 'global',     label: 'Global',               desc: 'US, Europe, Emerging Markets' },
  { val: 'india_first', label: 'India first, open to global', desc: 'India base, opportunistic global' },
];

const DASHBOARD_METRICS = [
  'Portfolio IRR',
  'Trust Score trend',
  'Sector exposure',
  'Top gainers',
  'Upcoming milestones',
  'Risk heatmap',
  'New deal alerts',
  'Benchmark vs index',
];

const NOTIF_FREQS = [
  { val: 'realtime', label: 'Real-time', desc: 'Every significant event immediately' },
  { val: 'daily',    label: 'Daily digest', desc: 'Once a day summary' },
  { val: 'weekly',   label: 'Weekly roundup', desc: 'Weekly portfolio & market recap' },
  { val: 'monthly',  label: 'Monthly report', desc: 'Monthly performance report only' },
];

const MOTIVATIONS = [
  { val: 'returns',    label: 'Maximise financial returns', desc: 'IRR, multiples, beating benchmarks' },
  { val: 'impact',     label: 'Support innovation & impact', desc: 'Back ideas that change the world' },
  { val: 'network',    label: 'Build founder network',      desc: 'Access to ecosystem and deal flow' },
  { val: 'diversify',  label: 'Diversify overall portfolio', desc: 'Reduce correlation with public markets' },
];

const HANDS_ON_LEVELS = [
  { val: 'passive',    label: 'Passive (autopilot)',       desc: 'Let the AI manage — just show results' },
  { val: 'light',      label: 'Light-touch',              desc: 'Monthly check-ins, key alerts only' },
  { val: 'moderate',   label: 'Moderately involved',      desc: 'Weekly reviews, add manual filters' },
  { val: 'active',     label: 'Hands-on',                 desc: 'Deep involvement in every decision' },
];

const FIN_BACKGROUNDS = [
  { val: 'beginner',   label: 'Beginner',            desc: 'New to investing, need plain English' },
  { val: 'retail',     label: 'Retail investor',     desc: 'Mutual funds / stocks experience' },
  { val: 'professional',label: 'Finance professional', desc: 'CFA, CA, banking or corporate finance' },
  { val: 'founder',    label: 'Founder / Operator',  desc: 'Built or running a startup yourself' },
];

const STEPS = [
  { id: 'welcome',    label: 'Welcome',     icon: '👋' },
  { id: 'capital',    label: 'Capital',     icon: '💰' },
  { id: 'risk',       label: 'Risk',        icon: '⚠️' },
  { id: 'sectors',    label: 'Sectors',     icon: '🗂️' },
  { id: 'hedging',    label: 'Hedging',     icon: '🛡️' },
  { id: 'prefs',      label: 'Preferences', icon: '⚙️' },
  { id: 'persona',    label: 'Personality', icon: '🧠' },
  { id: 'done',       label: 'Done',        icon: '🚀' },
];

const ACCENT = '#6366f1';

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  // Section 1: Capital & Commitment
  const [investAmount,   setInvestAmount]   = useState('');
  const [investStyle,    setInvestStyle]    = useState('');
  const [timeHorizon,    setTimeHorizon]    = useState('');

  // Section 2: Risk & Psychology
  const [dropResponse,   setDropResponse]   = useState('');
  const [angelExp,       setAngelExp]       = useState('');
  const [angelNetworks,  setAngelNetworks]  = useState('');

  // Section 3: Sector Interests
  const [sectors,        setSectors]        = useState([]);
  const [sectorsToAvoid, setSectorsToAvoid] = useState([]);

  // Section 4: Hedging & Concerns
  const [riskConcerns,   setRiskConcerns]   = useState([]);
  const [geoDiversity,   setGeoDiversity]   = useState('');

  // Section 5: Portfolio Preferences
  const [dashMetrics,    setDashMetrics]    = useState([]);
  const [notifFreq,      setNotifFreq]      = useState('');

  // Section 6: Investor Personality
  const [motivation,     setMotivation]     = useState('');
  const [handsOnLevel,   setHandsOnLevel]   = useState('');
  const [finBackground,  setFinBackground]  = useState('');

  const toggleArr = (set, val, current, max = 99) => {
    set(prev => prev.includes(val) ? prev.filter(x => x !== val) : current.length < max ? [...prev, val] : prev);
  };

  const finish = () => {
    const dna = {
      // Capital
      investAmount, investStyle, timeHorizon,
      // Risk
      dropResponse, angelExp, angelNetworks,
      riskAppetite: dropResponse === 'buy_more' ? 'aggressive' : dropResponse === 'hold' ? 'balanced' : 'conservative',
      capital: investAmount,
      lockup: timeHorizon,
      // Sectors
      sectors, sectorsToAvoid,
      stage: timeHorizon === 'under_1yr' ? 'late' : timeHorizon === '7yr_plus' ? 'early' : 'growth',
      // Hedging
      riskConcerns, geoDiversity,
      // Preferences
      dashMetrics, notifFreq,
      // Personality
      motivation, handsOnLevel, finBackground,
      // Derived lens metadata
      uiComplexity: finBackground === 'beginner' ? 'simple' : finBackground === 'professional' ? 'advanced' : 'standard',
      autopilot: handsOnLevel === 'passive',
      createdAt: Date.now(),
    };

    // 1. Persist to Supabase (keyed by email)
    if (user?.email) saveInvestorDNA(user.email, dna);

    // 2. Also POST to backend for any server-side use
    fetch('http://localhost:5500/api/user/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('is_session') || ''}`,
      },
      body: JSON.stringify(dna),
    }).catch(() => {});

    // 3. Cache in sessionStorage for instant access
    sessionStorage.setItem('is_investor_dna', JSON.stringify(dna));
    sessionStorage.setItem('is_onboarded', '1');
    navigate('/dashboard');
  };


  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  // ── Shared UI helpers ──────────────────────────────────────────────────────

  const wrap = (content) => (
    <div style={{
      background: '#0a0a0f', borderRadius: 24,
      border: '1px solid rgba(99,102,241,0.2)',
      padding: '40px 44px', maxWidth: 580, width: '100%',
      boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
    }}>
      {content}
    </div>
  );

  const sectionHead = (title, sub) => (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 5 }}>{title}</h2>
      <p style={{ fontSize: 13, color: '#475569', marginBottom: 28 }}>{sub}</p>
    </>
  );

  const questionLabel = (n, text) => (
    <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10 }}>
      Q{n}. {text.toUpperCase()}
    </div>
  );

  const optionGrid = (options, current, set, cols = 1) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 24 }}>
      {options.map(o => (
        <div
          key={o.val}
          onClick={() => set(o.val)}
          style={{
            padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
            background: current === o.val ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${current === o.val ? ACCENT + '50' : 'rgba(255,255,255,0.06)'}`,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${current === o.val ? ACCENT : 'rgba(255,255,255,0.2)'}`,
              background: current === o.val ? ACCENT : 'transparent',
            }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: current === o.val ? '#c7d2fe' : '#94a3b8' }}>{o.label}</div>
              {o.desc && <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{o.desc}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const multiPill = (items, selected, onToggle, max = 99, colorSel = ACCENT) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
      {items.map(item => {
        const isSelected = selected.includes(item);
        const atMax = !isSelected && selected.length >= max;
        return (
          <button
            key={item}
            onClick={() => !atMax && onToggle(item)}
            style={{
              padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: isSelected ? 700 : 400,
              border: `1px solid ${isSelected ? colorSel : 'rgba(255,255,255,0.08)'}`,
              background: isSelected ? `${colorSel}18` : 'rgba(255,255,255,0.02)',
              color: isSelected ? colorSel : atMax ? '#1e293b' : '#94a3b8',
              cursor: atMax ? 'default' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {isSelected ? '✓ ' : ''}{item}
          </button>
        );
      })}
    </div>
  );

  const navRow = (canNext, lastStep = false) => (
    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
      {step > 0 && (
        <button onClick={back} style={{ padding: '12px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Back
        </button>
      )}
      <button
        onClick={lastStep ? finish : next}
        disabled={!canNext}
        style={{
          flex: 1, padding: '13px', borderRadius: 12, border: 'none',
          background: canNext ? 'linear-gradient(135deg,#6366f1,#818cf8)' : 'rgba(99,102,241,0.2)',
          color: canNext ? '#fff' : '#334155', fontSize: 14, fontWeight: 800,
          cursor: canNext ? 'pointer' : 'default', transition: 'all 0.2s',
          fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
          boxShadow: canNext ? '0 6px 24px rgba(99,102,241,0.35)' : 'none',
        }}
      >
        {lastStep ? 'Enter IntelliStake →' : 'Continue →'}
      </button>
    </div>
  );

  // ── Progress indicator ─────────────────────────────────────────────────────

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base, #060610)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      backgroundImage: 'radial-gradient(ellipse at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 60%)',
    }}>

      {/* Top progress bar */}
      <div style={{ width: '100%', maxWidth: 580, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#334155', fontWeight: 700, letterSpacing: '0.06em' }}>
            {STEPS[step].icon} {STEPS[step].label.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: '#334155', fontFamily: 'DM Mono, monospace' }}>
            {step}/{STEPS.length - 1}
          </div>
        </div>
        <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#6366f1,#818cf8)', width: `${progressPct}%`, transition: 'width 0.35s ease' }} />
        </div>
      </div>

      {/* ── STEP 0: Welcome ───────────────────────────────────────────────── */}
      {step === 0 && wrap(
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔭</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
            Welcome to IntelliStake, {user?.name?.split(' ')[0] || 'Investor'}.
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, marginBottom: 28 }}>
            We'll ask you 15 quick questions across 6 sections. Your answers power the AI — your portfolio weights, startup feed, risk scoring, and how we talk to you.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {[
              { icon: '💰', t: 'Capital & Commitment', d: '3 questions — amounts, style, horizon' },
              { icon: '⚠️', t: 'Risk & Psychology', d: '3 questions — behavioral profile' },
              { icon: '🗂️', t: 'Sector Interests', d: '2 questions — what you want (and don\'t)' },
              { icon: '🛡️', t: 'Hedging & Concerns', d: '2 questions — risks you care about' },
              { icon: '⚙️', t: 'Portfolio Preferences', d: '2 questions — how your dashboard looks' },
              { icon: '🧠', t: 'Investor Personality', d: '3 questions — your mindset & expertise' },
            ].map(f => (
              <div key={f.t} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{f.t}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>
          {navRow(true)}
        </>
      )}

      {/* ── STEP 1: Capital & Commitment ──────────────────────────────────── */}
      {step === 1 && wrap(
        <>
          {sectionHead('Capital & Commitment', 'This calibrates your Black-Litterman portfolio weights and deal sizing.')}

          {questionLabel(1, 'How much do you plan to invest in startups per year?')}
          {optionGrid(INVEST_AMOUNTS, investAmount, setInvestAmount)}

          {questionLabel(2, 'What is your preferred investment style?')}
          {optionGrid(INVEST_STYLES, investStyle, setInvestStyle, 2)}

          {questionLabel(3, 'What is your investment time horizon?')}
          {optionGrid(TIME_HORIZONS, timeHorizon, setTimeHorizon, 2)}

          {navRow(!!investAmount && !!investStyle && !!timeHorizon)}
        </>
      )}

      {/* ── STEP 2: Risk & Psychology ─────────────────────────────────────── */}
      {step === 2 && wrap(
        <>
          {sectionHead('Risk & Psychology', 'Your behavioral profile adjusts XGBoost risk weights in your scoring model.')}

          {questionLabel(4, 'If your portfolio dropped 30% in one month, you would...')}
          {optionGrid(DROP_RESPONSES, dropResponse, setDropResponse)}

          {questionLabel(5, 'What is your prior experience with angel investing?')}
          {optionGrid(ANGEL_EXPERIENCE, angelExp, setAngelExp, 2)}

          {questionLabel(6, 'Are you part of any angel networks or syndicates?')}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {['Yes — actively', 'Yes — passively', 'No, investing solo'].map(opt => (
              <button
                key={opt}
                onClick={() => setAngelNetworks(opt)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: 12, fontWeight: angelNetworks === opt ? 700 : 400,
                  border: `1px solid ${angelNetworks === opt ? ACCENT + '50' : 'rgba(255,255,255,0.08)'}`,
                  background: angelNetworks === opt ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                  color: angelNetworks === opt ? '#c7d2fe' : '#475569', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt}
              </button>
            ))}
          </div>

          {navRow(!!dropResponse && !!angelExp && !!angelNetworks)}
        </>
      )}

      {/* ── STEP 3: Sector Interests ──────────────────────────────────────── */}
      {step === 3 && wrap(
        <>
          {sectionHead('Sector Interests', 'Hard filters for your discovery feed. Sectors to avoid are excluded entirely.')}

          {questionLabel(7, 'Which sectors excite you most? (pick any)')}
          {multiPill(SECTORS, sectors, (s) => toggleArr(setSectors, s, sectors))}

          {questionLabel(8, 'Any sectors you want to avoid? (pick any)')}
          {multiPill(
            SECTORS.filter(s => !sectors.includes(s)),
            sectorsToAvoid,
            (s) => toggleArr(setSectorsToAvoid, s, sectorsToAvoid),
            99,
            '#ef4444',
          )}

          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 700 }}>
              {sectors.length > 0 ? `${sectors.length} sector${sectors.length > 1 ? 's' : ''} selected` : 'No sectors selected — all sectors will show'}
              {sectorsToAvoid.length > 0 ? ` · ${sectorsToAvoid.length} excluded` : ''}
            </div>
          </div>

          {navRow(true)}
        </>
      )}

      {/* ── STEP 4: Hedging & Concerns ────────────────────────────────────── */}
      {step === 4 && wrap(
        <>
          {sectionHead('Hedging & Concerns', 'Your concerns shape portfolio construction and risk alerts.')}

          {questionLabel(9, 'What are your top 2 concerns about startup investing?')}
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
            Select up to 2 — {riskConcerns.length}/2 selected
          </div>
          {multiPill(RISK_CONCERNS, riskConcerns, (c) => toggleArr(setRiskConcerns, c, riskConcerns, 2))}

          {questionLabel(10, 'Geographic diversification preference')}
          {optionGrid(GEO_DIVERSIFICATION, geoDiversity, setGeoDiversity, 2)}

          {navRow(riskConcerns.length > 0 && !!geoDiversity)}
        </>
      )}

      {/* ── STEP 5: Portfolio Dashboard Preferences ───────────────────────── */}
      {step === 5 && wrap(
        <>
          {sectionHead('Portfolio Preferences', 'Customise which KPIs appear on your dashboard and how often we notify you.')}

          {questionLabel(11, 'Which metrics matter most to you? (pick up to 4)')}
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
            {dashMetrics.length}/4 selected
          </div>
          {multiPill(DASHBOARD_METRICS, dashMetrics, (m) => toggleArr(setDashMetrics, m, dashMetrics, 4))}

          {questionLabel(12, 'Preferred notification frequency')}
          {optionGrid(NOTIF_FREQS, notifFreq, setNotifFreq, 2)}

          {navRow(dashMetrics.length > 0 && !!notifFreq)}
        </>
      )}

      {/* ── STEP 6: Investor Personality ─────────────────────────────────── */}
      {step === 6 && wrap(
        <>
          {sectionHead('Investor Personality', 'Determines your UI complexity, language level, and AI suggestions mode.')}

          {questionLabel(13, 'What is your primary motivation for investing in startups?')}
          {optionGrid(MOTIVATIONS, motivation, setMotivation)}

          {questionLabel(14, 'How hands-on do you want to be with your portfolio?')}
          {optionGrid(HANDS_ON_LEVELS, handsOnLevel, setHandsOnLevel, 2)}

          {questionLabel(15, 'What best describes your financial background?')}
          {optionGrid(FIN_BACKGROUNDS, finBackground, setFinBackground, 2)}

          {navRow(!!motivation && !!handsOnLevel && !!finBackground)}
        </>
      )}

      {/* ── STEP 7: Done ─────────────────────────────────────────────────── */}
      {step === 7 && wrap(
        <>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🚀</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>Your IntelliStake is ready.</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 28 }}>
              Your investor DNA is locked in. The portfolio engine, scoring weights, and feed are now personalized.
            </p>

            <div style={{ padding: '20px', borderRadius: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'left', marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 14, fontFamily: 'DM Mono, monospace' }}>YOUR INVESTOR DNA SNAPSHOT</div>
              {[
                ['Investment / Year', INVEST_AMOUNTS.find(a => a.val === investAmount)?.label || investAmount],
                ['Style', INVEST_STYLES.find(s => s.val === investStyle)?.label || investStyle],
                ['Horizon', TIME_HORIZONS.find(t => t.val === timeHorizon)?.label || timeHorizon],
                ['Drop Behaviour', DROP_RESPONSES.find(d => d.val === dropResponse)?.label || dropResponse],
                ['Sectors', sectors.length > 0 ? sectors.slice(0,3).join(', ') + (sectors.length > 3 ? ` +${sectors.length-3}` : '') : 'All'],
                ['Exclude', sectorsToAvoid.length > 0 ? sectorsToAvoid.join(', ') : 'None'],
                ['Mode', HANDS_ON_LEVELS.find(h => h.val === handsOnLevel)?.label || handsOnLevel],
                ['Background', FIN_BACKGROUNDS.find(f => f.val === finBackground)?.label || finBackground],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#334155', fontFamily: 'DM Mono, monospace' }}>{k}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, maxWidth: 220, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>

            {navRow(true, true)}
          </div>
        </>
      )}
    </div>
  );
}
