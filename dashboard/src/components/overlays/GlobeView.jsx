import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'

const CITIES = [
  { name: 'Mumbai', lat: 19.076, lng: 72.877, sector: 'Fintech', color: '#2D7EF8', startups: ['Zepto', 'Razorpay', 'CRED'] },
  { name: 'Bangalore', lat: 12.971, lng: 77.594, sector: 'Deep Tech', color: '#7C5CFC', startups: ['Swiggy', 'Meesho', 'BrowserStack'] },
  { name: 'Delhi', lat: 28.613, lng: 77.209, sector: 'Commerce', color: '#F5A623', startups: ['Zomato', 'PolicyBazaar', 'Paytm'] },
  { name: 'Hyderabad', lat: 17.385, lng: 78.486, sector: 'SaaS', color: '#00C9A7', startups: ['Freshworks', 'Darwinbox', 'Rapido'] },
  { name: 'Pune', lat: 18.520, lng: 73.856, sector: 'EdTech', color: '#1DB972', startups: ['Byju\'s', 'Unacademy', 'upGrad'] },
  { name: 'Chennai', lat: 13.083, lng: 80.270, sector: 'Manufacturing Tech', color: '#E5484D', startups: ['Ola Electric', 'Kissht', 'Lendingkart'] },
]

function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return {
    x: -(radius * Math.sin(phi) * Math.cos(theta)),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta)
  }
}

export default function GlobeView() {
  const { setActiveOverlay } = useApp()
  const mountRef = useRef(null)
  const [selectedCity, setSelectedCity] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let renderer, animId

    async function init() {
      const THREE = await import('three')
      const W = mountRef.current.offsetWidth
      const H = mountRef.current.offsetHeight

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000)
      camera.position.z = 3

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(window.devicePixelRatio)
      mountRef.current.appendChild(renderer.domElement)

      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.MeshPhongMaterial({
          color: 0x0d1b3e,
          emissive: 0x0a0a18,
          wireframe: false,
          transparent: true,
          opacity: 0.95,
          shininess: 10,
        })
      )
      scene.add(globe)

      const wireframe = new THREE.Mesh(
        new THREE.SphereGeometry(1.002, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x2D7EF8, wireframe: true, transparent: true, opacity: 0.15 })
      )
      scene.add(wireframe)

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
      scene.add(ambientLight)
      const mainLight = new THREE.PointLight(0x2D7EF8, 1.5, 10)
      mainLight.position.set(3, 3, 3)
      scene.add(mainLight)

      const cityPins = []
      const cityHalos = []
      CITIES.forEach(city => {
        const pos = latLngToVector3(city.lat, city.lng, 1.02)
        const color = new THREE.Color(city.color)

        const pin = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 16, 16),
          new THREE.MeshBasicMaterial({ color })
        )
        pin.position.set(pos.x, pos.y, pos.z)
        pin.userData = { city }
        scene.add(pin)
        cityPins.push(pin)

        const pinLight = new THREE.PointLight(city.color, 0.8, 0.5)
        pinLight.position.set(pos.x, pos.y, pos.z)
        scene.add(pinLight)

        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.04, 0.07, 32),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
        )
        halo.position.set(pos.x, pos.y, pos.z)
        halo.lookAt(0, 0, 0)
        scene.add(halo)
        cityHalos.push(halo)
      })

      let isDragging = false, prevMouse = { x: 0, y: 0 }
      renderer.domElement.addEventListener('mousedown', e => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY } })
      renderer.domElement.addEventListener('mousemove', e => {
        if (!isDragging) return
        globe.rotation.y += (e.clientX - prevMouse.x) * 0.005
        globe.rotation.x += (e.clientY - prevMouse.y) * 0.005
        wireframe.rotation.copy(globe.rotation)
        prevMouse = { x: e.clientX, y: e.clientY }
      })
      renderer.domElement.addEventListener('mouseup', () => isDragging = false)

      renderer.domElement.addEventListener('click', e => {
        const rect = renderer.domElement.getBoundingClientRect()
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        )
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(scene.children)
        const cityHit = hits.find(h => h.object.userData?.city)
        if (cityHit) setSelectedCity(cityHit.object.userData.city)
      })

      setLoading(false)

      let time = 0
      function animate() {
        animId = requestAnimationFrame(animate)
        time += 0.016
        
        cityHalos.forEach((halo, i) => {
          const pulse = 1 + Math.sin(time * 2 + i * 0.5) * 0.15
          halo.scale.set(pulse, pulse, pulse)
        })
        
        if (!isDragging) {
          globe.rotation.y += 0.001
          wireframe.rotation.y += 0.001
        }
        renderer.render(scene, camera)
      }
      animate()
    }

    init()
    return () => {
      cancelAnimationFrame(animId)
      if (renderer) renderer.dispose()
      if (mountRef.current) mountRef.current.innerHTML = ''
    }
  }, [])

  return (
    <>
      <div onClick={() => setActiveOverlay(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400 }} />
      <div style={{ position: 'fixed', inset: '24px', zIndex: 401, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-secondary)', display: 'flex', animation: 'fadeIn 0.2s ease' }}>
        <div ref={mountRef} style={{ flex: 1, background: '#050510', cursor: 'grab' }}>
          {loading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Initializing globe...</div>}
        </div>

        {selectedCity && (
          <div style={{ width: 280, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)', padding: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedCity.color }} />
              <span style={{ fontWeight: 500, fontSize: 15 }}>{selectedCity.name}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{selectedCity.sector} Hub</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>TOP STARTUPS</div>
            {selectedCity.startups.map(s => (
              <div key={s} style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 8, marginBottom: 6, fontSize: 13, border: '1px solid var(--border-primary)' }}>{s}</div>
            ))}
            <button onClick={() => setSelectedCity(null)} style={{ marginTop: 12, width: '100%', padding: '8px', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Close</button>
          </div>
        )}

        <button onClick={() => setActiveOverlay(null)} style={{ position: 'absolute', top: 12, right: selectedCity ? 296 : 12, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>

        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12 }}>
          {CITIES.map(c => (
            <div key={c.name} onClick={() => setSelectedCity(c)} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '4px 10px', background: 'rgba(0,0,0,0.6)', borderRadius: 20, border: `1px solid ${selectedCity?.name === c.name ? c.color : 'rgba(255,255,255,0.1)'}` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
              <span style={{ fontSize: 11, color: '#fff' }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
