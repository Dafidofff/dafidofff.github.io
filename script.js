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

// --- Theme Toggle ---
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.theme-toggle-icon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'light' ? '◑' : '☀';
}

const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', next);
  applyTheme(next);
});

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

// Trigger above-fold reveals immediately on page load
window.addEventListener('load', () => {
  document.querySelectorAll('.about .reveal, .about .reveal-slide-right').forEach(el => {
    el.classList.add('visible');
  });
});

// --- Load papers from papers.json ---
fetch('papers.json')
  .then(res => res.json())
  .then(papers => {
    const featuredGrid = document.getElementById('featuredPapersGrid');
    const grid = document.getElementById('papersGrid');

    const labelMap = { pdf: 'PDF', arxiv: 'arXiv', code: 'Code', project: 'Project' };

    // ── Featured cards ────────────────────────────────────────────────
    const featured = papers.filter(p => p.highlight);
    featured.forEach((paper, i) => {
      const linkEntries = Object.entries(paper.links || {});
      const primaryEntry = linkEntries.find(([k]) => k === 'pdf') || linkEntries[0];
      const secondaryEntries = linkEntries.filter(([k, v]) => !primaryEntry || k !== primaryEntry[0]);

      const primaryLink = primaryEntry
        ? `<a href="${primaryEntry[1]}" class="featured-paper-link primary" target="_blank" rel="noopener">
             ${labelMap[primaryEntry[0]] || primaryEntry[0]}
           </a>`
        : '';

      const secondaryLinks = secondaryEntries
        .map(([k, v]) => `<a href="${v}" class="featured-paper-link ghost" target="_blank" rel="noopener">${labelMap[k] || k}</a>`)
        .join('');

      const descHtml = paper.description
        ? `<p class="featured-paper-description">${paper.description}</p>`
        : '';

      const card = document.createElement('article');
      card.className = `featured-paper-card reveal reveal-delay-${i + 1}`;
      card.innerHTML = `
        <div class="featured-paper-inner">
          <div class="featured-badge">
            <span class="featured-badge-dot"></span>
            Featured
          </div>
          <div class="featured-paper-year">${paper.year}</div>
          <h3 class="featured-paper-title">${paper.title}</h3>
          ${descHtml}
          <div class="featured-paper-meta">
            <span class="featured-venue-pill">${paper.venue}</span>
          </div>
          <p class="featured-paper-authors">${paper.authors}</p>
          <div class="featured-paper-links">
            ${primaryLink}
            ${secondaryLinks}
          </div>
        </div>
      `;
      featuredGrid.appendChild(card);
    });

    // ── Regular cards (non-highlighted) ──────────────────────────────
    const regular = papers.filter(p => !p.highlight);
    regular.forEach((paper, i) => {
      const delay = Math.min(i + 1, 3);
      const links = Object.entries(paper.links || {})
        .map(([label, url]) => {
          const display = labelMap[label] || label.charAt(0).toUpperCase() + label.slice(1);
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

    // Observe all newly added cards for reveal animation
    [featuredGrid, grid].forEach(container => {
      container.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    });
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

// --- Speech bubble on photo double-click ---
const aboutImage = document.querySelector('.about-image-wrapper .about-image');
const speechBubble = document.getElementById('speechBubble');
let speechTimeout;

aboutImage.addEventListener('dblclick', () => {
  clearTimeout(speechTimeout);
  speechBubble.classList.add('visible');
  speechTimeout = setTimeout(() => speechBubble.classList.remove('visible'), 2500);
});

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
