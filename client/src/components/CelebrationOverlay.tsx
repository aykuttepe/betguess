import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle' | 'star';
  gravity: number;
  opacity: number;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#fbbf24', '#34d399'];
const SHAPES: Particle['shape'][] = ['rect', 'circle', 'star'];
const PARTICLE_COUNT = 200;
const DURATION = 6000;

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function getGradeMessage(hitCount: number): { title: string; subtitle: string; stars: number } {
  if (hitCount >= 15) return { title: 'MUKEMMEL!', subtitle: '15/15 tam isabet!', stars: 5 };
  if (hitCount >= 14) return { title: 'HARIKA!', subtitle: `${hitCount}/15 isabet`, stars: 4 };
  if (hitCount >= 13) return { title: 'SUPER!', subtitle: `${hitCount}/15 isabet`, stars: 3 };
  return { title: 'TEBRIKLER!', subtitle: `${hitCount}/15 isabet`, stars: 2 };
}

interface Props {
  isVisible: boolean;
  hitCount: number;
  onClose: () => void;
}

export default function CelebrationOverlay({ isVisible, hitCount, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef(0);

  const createParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: rand(0, width),
        y: rand(-height * 1.5, -10),
        vx: rand(-4, 4),
        vy: rand(2, 8),
        rotation: rand(0, 360),
        rotationSpeed: rand(-12, 12),
        size: rand(4, 14),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        gravity: rand(0.05, 0.15),
        opacity: 1,
      });
    }
    return particles;
  }, []);

  const drawStar = useCallback((ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.4;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }, []);

  useEffect(() => {
    if (!isVisible) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    particlesRef.current = createParticles(canvas.width, canvas.height);
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let anyVisible = false;

      for (const p of particlesRef.current) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Slight air resistance
        p.vx *= 0.999;

        // Fade out particles that have fallen past canvas
        if (p.y > canvas.height + 20) {
          p.opacity -= 0.03;
        }

        // Stop spawning new momentum after duration
        if (elapsed > DURATION && p.y > canvas.height) {
          p.opacity -= 0.05;
        }

        if (p.opacity <= 0) continue;
        anyVisible = true;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, 0, 0, p.size / 2);
        }

        ctx.restore();
      }

      // Respawn particles from top during first DURATION ms
      if (elapsed < DURATION) {
        for (const p of particlesRef.current) {
          if (p.y > canvas.height + 50 && p.opacity > 0) {
            p.x = rand(0, canvas.width);
            p.y = rand(-50, -10);
            p.vy = rand(2, 8);
            p.vx = rand(-4, 4);
            p.opacity = 1;
          }
        }
      }

      if (anyVisible || elapsed < DURATION) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isVisible, createParticles, drawStar]);

  if (!isVisible) return null;

  const { title, subtitle, stars } = getGradeMessage(hitCount);

  return (
    <div className="celebration-overlay" onClick={onClose}>
      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="celebration-confetti-canvas" />

      {/* Center card */}
      <div className="celebration-card" onClick={e => e.stopPropagation()}>
        {/* 3D Trophy */}
        <div className="celebration-trophy-container">
          <div className="celebration-trophy">
            <div className="celebration-trophy-glow" />
            <span className="celebration-trophy-emoji">🏆</span>
          </div>
        </div>

        {/* Stars */}
        <div className="celebration-stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`celebration-star ${i < stars ? 'celebration-star-filled' : 'celebration-star-empty'}`}
              style={{ animationDelay: `${0.3 + i * 0.1}s` }}
            >
              ★
            </span>
          ))}
        </div>

        {/* Text */}
        <h1 className="celebration-title">🎉 {title} 🎉</h1>
        <p className="celebration-subtitle">{subtitle}</p>
        <p className="celebration-message">KAZANDINIZ!</p>

        {/* Close button */}
        <button className="celebration-close-btn" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  );
}
