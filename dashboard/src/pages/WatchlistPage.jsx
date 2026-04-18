import { useWatchlist } from '../hooks/useWatchlist';
import StartupCard from '../components/shared/StartupCard';

export default function WatchlistPage({ onNav }) {
  const { watchlist, toggle } = useWatchlist();

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
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#334155' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔖</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Your watchlist is empty</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>
            Hit the bookmark icon on any startup in Discover to save it here.
          </div>
          <button
            onClick={() => onNav?.('discover')}
            style={{
              padding: '10px 22px', borderRadius: 10,
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
              color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Go to Discover →
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
                onView={() => onNav?.('company')}
                onInvest={() => onNav?.('escrow')}
                matchScore={Math.max(0.4, s.trust_score || 0.7)}
              />
              <button
                onClick={() => toggle(s)}
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
