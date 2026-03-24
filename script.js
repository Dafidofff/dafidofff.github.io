/* ============================================
   DAVID WESSELS — Personal Website Scripts
   ============================================ */

// --- Cursor Glow ---
const cursorGlow = document.getElementById('cursorGlow');
let mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateCursor() {
  glowX += (mouseX - glowX) * 0.08;
  glowY += (mouseY - glowY) * 0.08;
  cursorGlow.style.left = glowX + 'px';
  cursorGlow.style.top = glowY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// --- Hero Canvas: Particle Network ---
const canvas = document.getElementById('heroCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animId;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.radius = Math.random() * 1.5 + 0.5;
    this.opacity = Math.random() * 0.5 + 0.1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(108, 99, 255, ${this.opacity})`;
    ctx.fill();
  }
}

// Create particles
const particleCount = Math.min(80, Math.floor(window.innerWidth * 0.05));
for (let i = 0; i < particleCount; i++) {
  particles.push(new Particle());
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const opacity = (1 - dist / 150) * 0.15;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(108, 99, 255, ${opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

// Mouse interaction with particles
let heroMouseX = canvas.width / 2;
let heroMouseY = canvas.height / 2;

document.getElementById('hero').addEventListener('mousemove', (e) => {
  heroMouseX = e.clientX;
  heroMouseY = e.clientY;
});

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw subtle radial gradient from mouse position
  const gradient = ctx.createRadialGradient(heroMouseX, heroMouseY, 0, heroMouseX, heroMouseY, 400);
  gradient.addColorStop(0, 'rgba(108, 99, 255, 0.03)');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    // Gentle attraction to mouse
    const dx = heroMouseX - p.x;
    const dy = heroMouseY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 300) {
      p.vx += dx * 0.00002;
      p.vy += dy * 0.00002;
    }
    // Speed dampening
    p.vx *= 0.999;
    p.vy *= 0.999;

    p.update();
    p.draw();
  });

  drawConnections();
  animId = requestAnimationFrame(animateParticles);
}
animateParticles();

// --- Navigation scroll effect ---
const nav = document.getElementById('nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  if (scrollY > 80) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
  lastScroll = scrollY;
});

// --- Scroll Reveal ---
const revealElements = document.querySelectorAll('.reveal, .reveal-slide-right');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// Trigger hero reveals immediately on page load
window.addEventListener('load', () => {
  document.querySelectorAll('.hero .reveal, .hero .reveal-slide-right').forEach(el => {
    el.classList.add('visible');
  });
});

// --- Animated stat counters ---
const statNumbers = document.querySelectorAll('.stat-number');

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.getAttribute('data-target'));
      animateCounter(el, target);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

statNumbers.forEach(el => counterObserver.observe(el));

function animateCounter(el, target) {
  let current = 0;
  const duration = 1500;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    current = Math.round(eased * target);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// --- Load papers from papers.json ---
fetch('papers.json')
  .then(res => res.json())
  .then(papers => {
    const grid = document.getElementById('papersGrid');
    papers.forEach((paper, i) => {
      const delay = Math.min(i + 1, 3);
      const links = Object.entries(paper.links || {})
        .map(([label, url]) => {
          const display = { pdf: 'PDF', arxiv: 'arXiv', code: 'Code' }[label] || label.charAt(0).toUpperCase() + label.slice(1);
          return `<a href="${url}" class="paper-link" target="_blank" rel="noopener">${display}</a>`;
        })
        .join('');

      const card = document.createElement('article');
      card.className = `paper-card reveal reveal-delay-${delay}`;
      card.innerHTML = `
        <div class="paper-card-inner">
          <span class="paper-year">${paper.year}</span>
          <h3 class="paper-title">${paper.title}</h3>
          <p class="paper-authors">${paper.authors}</p>
          <p class="paper-venue">${paper.venue}</p>
          <div class="paper-links">${links}</div>
        </div>
      `;
      grid.appendChild(card);
    });

    // Observe newly added cards for reveal animation
    grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  });

// --- Smooth anchor scroll ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// --- Konami Code Easter Egg ---
// Up Up Down Down Left Right Left Right B A
const konamiSequence = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
  if (e.keyCode === konamiSequence[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === konamiSequence.length) {
      document.getElementById('konamiOverlay').classList.add('active');
      konamiIndex = 0;
      // Confetti burst
      launchConfetti();
    }
  } else {
    konamiIndex = 0;
  }
});

// --- Mini Confetti for Konami ---
function launchConfetti() {
  const colors = ['#6c63ff', '#00d4aa', '#e040fb', '#ffcc00', '#ff6b6b'];
  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: ${Math.random() * 8 + 4}px;
      height: ${Math.random() * 8 + 4}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${50 + (Math.random() - 0.5) * 30}%;
      top: 50%;
      z-index: 10001;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      pointer-events: none;
    `;
    document.body.appendChild(confetti);

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 600 + 200;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 300;

    confetti.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${vx}px, ${vy + 800}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
    ], {
      duration: Math.random() * 1500 + 1000,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }).onfinish = () => confetti.remove();
  }
}

// --- Easter Egg: Console message ---
console.log(
  '%c Hey there, curious one! 👋 ',
  'background: linear-gradient(135deg, #6c63ff, #00d4aa); color: white; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: bold;'
);
console.log(
  '%c Try the Konami code... ↑↑↓↓←→←→BA ',
  'color: #6c63ff; font-size: 11px;'
);

// --- Easter Egg: Click the DW logo 7 times ---
let logoClicks = 0;
const logo = document.querySelector('.nav-logo');
logo.addEventListener('click', (e) => {
  e.preventDefault();
  logoClicks++;
  if (logoClicks === 7) {
    document.body.style.transition = 'filter 1s ease';
    document.body.style.filter = 'hue-rotate(180deg)';
    setTimeout(() => {
      document.body.style.filter = 'hue-rotate(0deg)';
    }, 3000);
    logoClicks = 0;
  }
});

// --- Easter Egg: Matrix rain on triple-click anywhere ---
document.addEventListener('click', (e) => {
  if (e.detail === 3) {
    triggerMatrixRain();
  }
});

function triggerMatrixRain() {
  const matrixCanvas = document.createElement('canvas');
  matrixCanvas.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:0.7;';
  matrixCanvas.width = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  document.body.appendChild(matrixCanvas);

  const mCtx = matrixCanvas.getContext('2d');
  const chars = 'DAVIDWESSELS01アカサタナハマヤラワ';
  const fontSize = 14;
  const columns = Math.floor(matrixCanvas.width / fontSize);
  const drops = Array(columns).fill(1);

  let frames = 0;
  function drawMatrix() {
    mCtx.fillStyle = 'rgba(10, 10, 11, 0.05)';
    mCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    mCtx.fillStyle = '#00d4aa';
    mCtx.font = fontSize + 'px monospace';

    for (let i = 0; i < drops.length; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      mCtx.fillText(char, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > matrixCanvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }

    frames++;
    if (frames < 200) {
      requestAnimationFrame(drawMatrix);
    } else {
      matrixCanvas.style.transition = 'opacity 1s ease';
      matrixCanvas.style.opacity = '0';
      setTimeout(() => matrixCanvas.remove(), 1000);
    }
  }
  drawMatrix();
}
