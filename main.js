// ==========================================
// CÓDIGO PARTILHADO POR TODAS AS PÁGINAS
// ==========================================
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ==========================================
// 1. ANO NO RODAPÉ
// ==========================================
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

// ==========================================
// 2. REVEAL AO FAZER SCROLL (IntersectionObserver)
// ==========================================
(function initReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('active'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -60px 0px' });
  reveals.forEach(el => observer.observe(el));
})();

// ==========================================
// 3. FUNDO HALFTONE INTERATIVO
// O padrão de pontos é desenhado em CSS (no body). Aqui só desenhamos a
// zona à volta do cursor, e só quando o rato se mexe. Desligado em ecrãs
// táteis e com prefers-reduced-motion.
// ==========================================
(function initHalftoneBackground() {
  const canvas = document.getElementById('halftone-canvas');
  if (!canvas || !hasFinePointer || prefersReducedMotion) return;

  const ctx = canvas.getContext('2d');
  const SPACING = 16;
  const OFFSET = 8; // Os pontos do CSS estão no centro de cada célula de 16px
  const RADIUS = 150;
  const PAD = SPACING * 2;
  const BG = '#f9f9f9';

  let dpr = 1;
  let mouse = null;
  let lastBox = null;
  let pending = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastBox = null;
  }

  function draw() {
    pending = false;
    if (lastBox) ctx.clearRect(lastBox.x, lastBox.y, lastBox.w, lastBox.h);
    lastBox = null;
    if (!mouse) return;

    const box = {
      x: mouse.x - RADIUS - PAD,
      y: mouse.y - RADIUS - PAD,
      w: (RADIUS + PAD) * 2,
      h: (RADIUS + PAD) * 2
    };

    // Tapa os pontos do CSS dentro de um círculo e redesenha-os com o efeito
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, RADIUS + SPACING, 0, Math.PI * 2);
    ctx.fillStyle = BG;
    ctx.fill();

    const startX = Math.floor((box.x - OFFSET) / SPACING) * SPACING + OFFSET;
    const startY = Math.floor((box.y - OFFSET) / SPACING) * SPACING + OFFSET;

    for (let x = startX; x <= box.x + box.w; x += SPACING) {
      for (let y = startY; y <= box.y + box.h; y += SPACING) {
        const dx = mouse.x - x;
        const dy = mouse.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > RADIUS + SPACING * 1.5) continue;

        let radius = 1;
        let blend = 0;
        if (distance < RADIUS) {
          const force = 1 - (distance / RADIUS);
          radius = 1 + (5 * force);
          blend = force;
        }

        if (blend > 0.1) {
          const offset = 2 * blend;
          const alpha = blend * 0.8;
          ctx.beginPath(); ctx.arc(x - 2 * offset, y - 2 * offset, radius * 0.8, 0, Math.PI * 2); ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`; ctx.fill();
          ctx.beginPath(); ctx.arc(x + 2 * offset, y - 2 * offset, radius * 0.8, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`; ctx.fill();
          ctx.beginPath(); ctx.arc(x, y + 2 * offset, radius * 0.8, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 230, 0, ${alpha})`; ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(5, 5, 5, ${1 - (blend * 0.99)})`; ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = '#050505'; ctx.fill();
        }
      }
    }
    lastBox = box;
  }

  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(draw);
    }
  }

  window.addEventListener('resize', () => { resize(); schedule(); }, { passive: true });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse = { x: e.clientX, y: e.clientY };
    schedule();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { mouse = null; schedule(); });
  window.addEventListener('blur', () => { mouse = null; schedule(); });

  resize();
})();
