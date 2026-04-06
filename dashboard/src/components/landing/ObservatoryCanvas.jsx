/**
 * ObservatoryCanvas.jsx — The Observatory Star Map
 * Renders a particle canvas of startup ecosystem clusters.
 * Each cluster = a sector, sized by capital. Stars = startups, colored by trust score.
 */
import { useEffect, useRef } from 'react';

const SECTORS = [
  { name: 'FinTech',   x: 0.28, y: 0.38, radius: 90,  color: '#6366f1', count: 60 },
  { name: 'SaaS',      x: 0.58, y: 0.28, radius: 75,  color: '#8b5cf6', count: 45 },
  { name: 'D2C',       x: 0.72, y: 0.55, radius: 65,  color: '#06b6d4', count: 38 },
  { name: 'Deeptech',  x: 0.42, y: 0.65, radius: 55,  color: '#10b981', count: 28 },
  { name: 'EdTech',    x: 0.22, y: 0.62, radius: 48,  color: '#f59e0b', count: 25 },
  { name: 'HealthTech',x: 0.65, y: 0.72, radius: 42,  color: '#f43f5e', count: 20 },
  { name: 'Climate',   x: 0.80, y: 0.35, radius: 38,  color: '#34d399', count: 18 },
];

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// Trust score → star color
function trustColor(trust) {
  if (trust > 0.7) return '#10b981';
  if (trust > 0.45) return '#f59e0b';
  return '#ef4444';
}

export default function ObservatoryCanvas({ riskAppetite = 'balanced', style = {} }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const starsRef = useRef([]);
  const timeRef = useRef(0);

  // Color temperature based on risk appetite
  const tint = riskAppetite === 'conservative' ? [0, 0.3, 1]
              : riskAppetite === 'aggressive' ? [1, 0.5, 0]
              : [0.39, 0.40, 0.95]; // balanced = indigo

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      buildStars();
    };

    function buildStars() {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const stars = [];

      SECTORS.forEach((sector, si) => {
        const rand = rng(si * 999 + 42);
        const cx = sector.x * w;
        const cy = sector.y * h;

        for (let i = 0; i < sector.count; i++) {
          const angle = rand() * Math.PI * 2;
          const dist  = rand() * sector.radius;
          const trust = 0.3 + rand() * 0.7;
          stars.push({
            x:        cx + Math.cos(angle) * dist,
            y:        cy + Math.sin(angle) * dist,
            r:        0.6 + rand() * 2.2,
            trust,
            color:    sector.color,
            speed:    0.0002 + rand() * 0.0004,
            phase:    rand() * Math.PI * 2,
            orbitR:   dist,
            orbitCx:  cx,
            orbitCy:  cy,
            orbitA:   angle,
            sectorColor: sector.color,
          });
        }
      });

      // Scatter background stars
      const rand = rng(12345);
      for (let i = 0; i < 120; i++) {
        const w2 = canvas.offsetWidth, h2 = canvas.offsetHeight;
        stars.push({
          x: rand() * w2, y: rand() * h2,
          r: 0.3 + rand() * 0.9,
          trust: rand(),
          color: '#ffffff',
          speed: 0,
          phase: rand() * Math.PI * 2,
          orbitR: 0, orbitCx: 0, orbitCy: 0, orbitA: 0,
          sectorColor: '#ffffff',
          bg: true,
        });
      }

      starsRef.current = stars;
    }

    function draw(t) {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      timeRef.current = t * 0.001;
      const time = timeRef.current;

      ctx.clearRect(0, 0, w, h);

      // Deep space background gradient
      const bg = ctx.createRadialGradient(w*0.5, h*0.4, 0, w*0.5, h*0.4, w*0.7);
      bg.addColorStop(0, `rgba(${Math.round(tint[0]*30)},${Math.round(tint[1]*15)},${Math.round(tint[2]*40)},0.6)`);
      bg.addColorStop(1, 'rgba(5,5,8,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Draw sector halos
      SECTORS.forEach(sector => {
        const cx = sector.x * w;
        const cy = sector.y * h;
        const breathScale = 1 + 0.04 * Math.sin(time * 0.5 + sector.x * 10);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sector.radius * 1.6 * breathScale);
        grad.addColorStop(0, sector.color + '18');
        grad.addColorStop(0.5, sector.color + '08');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, sector.radius * 1.6 * breathScale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw stars
      starsRef.current.forEach(star => {
        let x = star.x, y = star.y;
        if (star.orbitR > 0) {
          const a = star.orbitA + star.speed * time * 60;
          x = star.orbitCx + Math.cos(a) * star.orbitR;
          y = star.orbitCy + Math.sin(a) * star.orbitR;
        }

        // Twinkle
        const twinkle = (star.bg ? 0.3 : 0.7) + 0.3 * Math.sin(time * 2 + star.phase);

        // Glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, star.r * 4);
        const c = star.bg ? '#ffffff' : trustColor(star.trust);
        glow.addColorStop(0, c + Math.round(twinkle * 180).toString(16).padStart(2,'0'));
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, star.r * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = c;
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [riskAppetite]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  );
}
