/* ══════════════════════════════════════════════
   LOADOUT.GG — Shared JS
   ══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Header scroll state ──────────────────────
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 16);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Mobile menu ──────────────────────────────
  const menuBtn  = document.getElementById('menuBtn');
  const mobileNav = document.getElementById('mobileNav');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', e => {
      if (!mobileNav.contains(e.target) && !menuBtn.contains(e.target)) {
        mobileNav.classList.remove('open');
      }
    });
  }

  // ── Entrance: fade-up ────────────────────────
  const fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        fadeObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

  document.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));

  // ── Hero word reveal (page load) ─────────────
  const heroWords = document.querySelectorAll('.reveal-word');
  heroWords.forEach((w, i) => {
    setTimeout(() => w.classList.add('in'), 180 + i * 72);
  });

  // ── Score counter animation ───────────────────
  function animateCount(el, target, ms = 1100) {
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / ms);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * ease).toFixed(1);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(1);
    };
    requestAnimationFrame(tick);
  }

  const scoreObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !e.target.dataset.counted) {
        e.target.dataset.counted = '1';
        const val = parseFloat(e.target.dataset.score);
        if (!isNaN(val)) animateCount(e.target, val);
        scoreObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-score]').forEach(el => scoreObserver.observe(el));

  // ── Spotlight scroll-scrub animation ─────────
  //    The spotlight-container is 280vh tall; the
  //    .spotlight is position:sticky so it stays
  //    in view while we scroll through the container.
  //    We drive 4 phase variables --p1…--p4 based
  //    on how far through the container the user is.
  const spotContainer = document.querySelector('.spotlight-container');
  const spotSection   = document.querySelector('.spotlight[data-spotlight]');

  if (spotContainer && spotSection) {
    let rafPending = false;

    function computeSpotlight() {
      rafPending = false;
      const rect = spotContainer.getBoundingClientRect();
      const total = spotContainer.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / total));

      // Remap to phases
      const p1 = clamp01((p - 0.00) / 0.30);  // eyebrow + title in
      const p2 = clamp01((p - 0.08) / 0.42);  // image expands
      const p3 = clamp01((p - 0.38) / 0.34);  // score / info in
      const p4 = clamp01((p - 0.56) / 0.30);  // CTA in + final settle

      spotSection.style.setProperty('--p1', p1.toFixed(4));
      spotSection.style.setProperty('--p2', p2.toFixed(4));
      spotSection.style.setProperty('--p3', p3.toFixed(4));
      spotSection.style.setProperty('--p4', p4.toFixed(4));
    }

    function onSpotScroll() {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(computeSpotlight);
      }
    }

    window.addEventListener('scroll', onSpotScroll, { passive: true });
    computeSpotlight();
  }

  // ── Parallax on hero bg ───────────────────────
  const heroBg = document.querySelector('.hero-parallax-bg');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      heroBg.style.transform = `translateY(${y * 0.35}px)`;
    }, { passive: true });
  }

  // ── Active nav link highlight ─────────────────
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

});

// ── Utility ──────────────────────────────────────
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
