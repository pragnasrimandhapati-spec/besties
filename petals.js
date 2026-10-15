/* Petal animation: petals drift in, gather into a heart, hold, then burst and fall. Loops forever. */
(function () {
  const canvas = document.getElementById('petals');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLORS = ['#f9b9c8', '#f7a1b6', '#fcd0da', '#f48fb1', '#ffc8d6', '#fbe0e6', '#f5d98b'];
  const COUNT = 230;
  const petals = [];

  // phases: 0 gather, 1 hold, 2 burst/fall
  let phase = 0, phaseStart = 0;
  const DUR = [4200, 5500, 4200];

  function heartPoint(t) {
    return {
      x: 16 * Math.pow(Math.sin(t), 3),
      y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    assignTargets();
  }

  function assignTargets() {
    const size = Math.min(W * 0.5, 360, H * 0.42) / 32;      // scale of the heart
    const cx = W / 2, cy = H * 0.34;
    petals.forEach(p => {
      const k = p.fill;                                       // 1 = outline, <1 = inside
      p.tx = cx + p.hx * size * k;
      p.ty = cy + p.hy * size * k;
    });
  }

  function init() {
    petals.length = 0;
    for (let i = 0; i < COUNT; i++) {
      const t = (i / COUNT) * Math.PI * 2 + Math.random() * 0.05;
      const pt = heartPoint(t);
      // ~55% on the outline, the rest fill the interior
      const fill = Math.random() < 0.55 ? 0.97 + Math.random() * 0.06 : 0.15 + Math.random() * 0.8;
      petals.push({
        hx: pt.x, hy: pt.y, fill,
        x: Math.random() * W, y: -20 - Math.random() * H * 0.6,
        sx: 0, sy: 0, tx: 0, ty: 0,
        size: 6 + Math.random() * 7,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.04,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        delay: Math.random() * 0.35,
        sway: Math.random() * Math.PI * 2,
        vx: 0, vy: 0
      });
    }
    assignTargets();
    startPhase(0, performance.now());
  }

  function startPhase(n, now) {
    phase = n; phaseStart = now;
    petals.forEach(p => {
      p.sx = p.x; p.sy = p.y;
      if (n === 0) { p.x = p.sx; }                // start gathering from wherever they are
      if (n === 2) {                               // burst outward then fall
        const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3.5;
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 1.5;
      }
    });
  }

  const ease = t => 1 - Math.pow(1 - t, 3);

  function drawPetal(p, alpha) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    const s = p.size;
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.8, s * 0.8, s * 0.6, 0, s);
    ctx.bezierCurveTo(-s * 0.8, s * 0.6, -s * 0.9, -s * 0.8, 0, -s);
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    const el = now - phaseStart;
    const pr = Math.min(el / DUR[phase], 1);

    for (const p of petals) {
      if (phase === 0) {
        const t = ease(Math.max(0, Math.min((pr - p.delay) / (1 - p.delay), 1)));
        p.x = p.sx + (p.tx - p.sx) * t + Math.sin(now / 500 + p.sway) * (1 - t) * 14;
        p.y = p.sy + (p.ty - p.sy) * t;
        p.rot += p.spin * (1 - t * 0.9);
      } else if (phase === 1) {
        const beat = 1 + Math.sin(now / 420) * 0.012;                     // gentle heartbeat
        const cx = W / 2, cy = H * 0.34;
        p.x = cx + (p.tx - cx) * beat + Math.sin(now / 700 + p.sway) * 1.6;
        p.y = cy + (p.ty - cy) * beat + Math.cos(now / 800 + p.sway) * 1.6;
        p.rot += p.spin * 0.2;
      } else {
        p.vy += 0.035;
        p.vx *= 0.995;
        p.x += p.vx + Math.sin(now / 400 + p.sway) * 0.6;
        p.y += p.vy;
        p.rot += p.spin * 2;
      }
      drawPetal(p, phase === 2 ? Math.max(0, 1 - pr * 0.6) : 1);
    }

    if (pr >= 1) {
      const next = (phase + 1) % 3;
      if (next === 0) {               // reset petals above the screen for the next gathering
        petals.forEach(p => { p.x = Math.random() * W; p.y = -20 - Math.random() * H * 0.5; });
      }
      startPhase(next, now);
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  init();

  if (reduce) {                        // static heart for reduced-motion users
    petals.forEach(p => { p.x = p.tx; p.y = p.ty; drawPetal(p, 1); });
  } else {
    requestAnimationFrame(frame);
  }
})();
