import TopBar from '../components/WarRoom/TopBar'
import TrustRadar from '../components/WarRoom/TrustRadar'
import CommandCenter from '../components/WarRoom/CommandCenter'
import OracleFeed from '../components/WarRoom/OracleFeed'
import BottomNav from '../components/WarRoom/BottomNav'
import DetailDrawer from '../components/WarRoom/DetailDrawer'
import CriticalAlert from '../components/alerts/CriticalAlert'
import ModuleOverlay from '../components/overlays/ModuleOverlay'
import NetworkGraph from '../components/overlays/NetworkGraph'
import GlobeView from '../components/overlays/GlobeView'
import { useApp } from '../context/AppContext'

export default function WarRoom() {
  const { activeOverlay, selectedStartup } = useApp()

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: '48px 1fr 56px',
      height: '100vh',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
      gap: '1px',
    }}>
      <TopBar />
      <div style={{
        display: 'grid',
        gridTemplateColumns: '25% 1fr 25%',
        overflow: 'hidden',
        gap: '1px',
        background: 'var(--border-primary)',
      }}>
        <TrustRadar />
        <CommandCenter />
        <OracleFeed />
      </div>
      <BottomNav />

      {selectedStartup && <DetailDrawer />}
      {activeOverlay === 'network' && <NetworkGraph />}
      {activeOverlay === 'globe' && <GlobeView />}
      {activeOverlay && !['network','globe'].includes(activeOverlay) && <ModuleOverlay />}
      <CriticalAlert />
    </div>
  )
}
