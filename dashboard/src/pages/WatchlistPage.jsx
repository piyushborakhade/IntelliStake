import { useNavigate } from 'react-router-dom';
import { useWatchlist } from '../hooks/useWatchlist';
import StartupCard from '../components/shared/StartupCard';
import { useToast } from '../components/alerts/ToastSystem';

export default function WatchlistPage({ onNav }) {
  const navigate = useNavigate();
  const { watchlist, toggle } = useWatchlist();
  const toast = useToast();

  const handleToggle = (startup) => {
    const exists = watchlist.some((item) => (item.startup_name || item.name) === (startup.startup_name || startup.name));
    toggle(startup);
    toast(exists ? 'Removed from watchlist' : 'Added to watchlist', exists ? 'info' : 'success');
  };

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
          Watchlist
        </h1>
        <p style={{ fontSize: 13, color: '#475569' }}>
          {watchlist.length === 0
            ? 'No startups saved yet — bookmark startups from Discover'
            : `${watchlist.length} startup${watchlist.length > 1 ? 's' : ''} saved`}
        </p>
      </div>

      {watchlist.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⭐</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Your watchlist is empty</h3>
          <p style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>Star startups you want to track</p>
          <button
            onClick={() => navigate('/discover')}
            style={{
              background: 'var(--indigo)', color: 'white', border: 'none',
              padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
            }}
          >
            Explore →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {watchlist.map((s, i) => (
            <div key={s.startup_name || i} style={{ position: 'relative' }}>
              <StartupCard
                startup={s}
                mode="user"
                variant="compact"
                onView={() => navigate(`/startup/${encodeURIComponent(s.startup_name || s.name || 'unknown')}`)}
                onInvest={() => navigate('/holdings')}
                matchScore={Math.max(0.4, s.trust_score || 0.7)}
              />
              <button
                onClick={() => handleToggle(s)}
                title="Remove from watchlist"
                style={{
                  position: 'absolute', top: 14, right: 14,
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8, padding: '4px 10px', color: '#f87171',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                ✕ Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
