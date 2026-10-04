// ==========================================
// FOTOGRAFIA INTERATIVA HALFTONE (página inicial)
// A imagem é desenhada uma vez. Ao passar o rato só se redesenha a zona
// à volta do cursor, e a animação para sozinha quando tudo volta ao normal.
// ==========================================
(function initProfile() {
  const canvas = document.getElementById('profile-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const WIDTH = 540;
  const STEP = 3;
  const EFFECT_RADIUS = 150;
  const MAX_EXPANSION = 0.2;
  const MARGIN = 8; // Folga para os deslocamentos das cores CMY

  let cols = 0;
  let rows = 0;
  let height = 0;
  let grid = []; // grid[row * cols + col] = partícula ou null
  let active = new Set();
  let mouse = null;
  let running = false;

  const img = new Image();
  img.src = canvas.dataset.src;

  img.onload = () => {
    height = Math.round(img.height * (WIDTH / img.width));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Lê os píxeis num canvas temporário à resolução de trabalho
    const sample = document.createElement('canvas');
    sample.width = WIDTH;
    sample.height = height;
    const sctx = sample.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, WIDTH, height);
    const data = sctx.getImageData(0, 0, WIDTH, height).data;

    // Canvas visível à resolução do ecrã (nitidez em ecrãs retina)
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.aspectRatio = `${WIDTH} / ${height}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.ceil(WIDTH / STEP);
    rows = Math.ceil(height / STEP);
    grid = new Array(cols * rows).fill(null);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * STEP;
        const y = r * STEP;
        const i = (y * WIDTH + x) * 4;
        if (data[i + 3] <= 200) continue;
        const brightness = Math.sqrt(0.5 * data[i] ** 2 + 0.5 * data[i + 1] ** 2 + 0.5 * data[i + 2] ** 2);
        const baseRadius = Math.max(0.1, ((255 - brightness) / 255) * (STEP / 1.2));
        grid[r * cols + c] = { x, y, baseRadius, currentRadius: baseRadius, blend: 0 };
      }
    }

    renderRegion(0, 0, WIDTH, height);
    canvas.classList.add('is-ready');

    if (!reducedMotion) {
      canvas.addEventListener('pointermove', onMove, { passive: true });
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointercancel', onLeave);
      canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') onLeave(); });
    }
  };

  img.onerror = () => {
    canvas.hidden = true;
    const fallback = document.getElementById('profile-fallback');
    if (fallback) fallback.hidden = false;
  };

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = WIDTH / rect.width;
    mouse = { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
    start();
  }

  function onLeave() {
    mouse = null;
    start();
  }

  function start() {
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  function frame() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (mouse) {
      minX = mouse.x - EFFECT_RADIUS; maxX = mouse.x + EFFECT_RADIUS;
      minY = mouse.y - EFFECT_RADIUS; maxY = mouse.y + EFFECT_RADIUS;
    }
    active.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    if (minX === Infinity) {
      running = false;
      return;
    }

    renderRegion(minX - MARGIN, minY - MARGIN, maxX + MARGIN, maxY + MARGIN, true);
    requestAnimationFrame(frame);
  }

  // Redesenha só as partículas dentro do retângulo (x0,y0)-(x1,y1)
  function renderRegion(x0, y0, x1, y1, animate = false) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(WIDTH, x1); y1 = Math.min(height, y1);
    if (x1 <= x0 || y1 <= y0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);

    // Inclui partículas vizinhas que possam invadir a zona recortada
    const c0 = Math.max(0, Math.floor((x0 - MARGIN) / STEP));
    const c1 = Math.min(cols - 1, Math.ceil((x1 + MARGIN) / STEP));
    const r0 = Math.max(0, Math.floor((y0 - MARGIN) / STEP));
    const r1 = Math.min(rows - 1, Math.ceil((y1 + MARGIN) / STEP));

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    const coloured = [];

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const p = grid[r * cols + c];
        if (!p) continue;
        if (animate) update(p);

        if (p.blend > 0.02) {
          coloured.push(p);
        } else {
          // Partículas normais num único path: muito mais rápido
          ctx.moveTo(p.x + p.currentRadius, p.y);
          ctx.arc(p.x, p.y, p.currentRadius, 0, Math.PI * 2);
        }
      }
    }
    ctx.fill();

    coloured.forEach(p => {
      const offset = 1.5 * p.blend;
      const alpha = p.blend * 0.9;
      const colorRadius = p.baseRadius * (1 + p.blend);
      ctx.beginPath(); ctx.arc(p.x - 2 * offset, p.y - 2 * offset, colorRadius, 0, Math.PI * 2); ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 2 * offset, p.y - 2 * offset, colorRadius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y + 2 * offset, colorRadius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 230, 0, ${alpha})`; ctx.fill();
      const blackAlpha = Math.max(0, 1 - (p.blend * 0.5));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.currentRadius, 0, Math.PI * 2); ctx.fillStyle = `rgba(5, 5, 5, ${blackAlpha})`; ctx.fill();
    });

    ctx.restore();
  }

  function update(p) {
    let distance = Infinity;
    if (mouse) {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      distance = Math.sqrt(dx * dx + dy * dy);
    }

    if (distance < EFFECT_RADIUS) {
      const smoothForce = Math.pow(1 - (distance / EFFECT_RADIUS), 0.85);
      p.blend = smoothForce;
      p.currentRadius = p.baseRadius * (1 + (MAX_EXPANSION * smoothForce));
    } else {
      p.blend *= 0.8;
      p.currentRadius += (p.baseRadius - p.currentRadius) * 0.1;
      if (p.blend < 0.005) p.blend = 0;
      if (Math.abs(p.currentRadius - p.baseRadius) < 0.01) p.currentRadius = p.baseRadius;
    }

    if (p.blend > 0 || p.currentRadius !== p.baseRadius) active.add(p);
    else active.delete(p);
  }
})();
