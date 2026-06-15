/* Portfolio Rahim Tamhaev — interactions partagées
   montagnes animées · curseur custom · reveals au scroll */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- fond animé : montagnes éclairées par le curseur ---------- */
  function initWaves(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, t = Math.random() * 100, raf = null, visible = true;
    /* lumière : position viewport brute, lissée en coordonnées canvas */
    var cx = -9999, cy = -9999;
    var gx = -9999, gy = -9999, glowA = 0, overCanvas = false;

    document.addEventListener('mousemove', function (e) {
      cx = e.clientX; cy = e.clientY;
    });

    var STEP = 8, LAYERS = 7, NB = 5;
    var npts = 0, ys = [], horizonGrad = null;
    var hasPath2D = typeof Path2D === 'function';

    /* couleurs précalculées par plan */
    var baseFill = [], baseStroke = [];
    for (var li = 0; li < LAYERS; li++) {
      var lp = li / (LAYERS - 1);
      baseFill.push('hsla(266, 30%, ' + (11 - 6.5 * lp).toFixed(1) + '%, 0.94)');
      baseStroke.push('hsla(' + (272 + 26 * lp).toFixed(0) + ', 62%, 68%, ' + (0.10 + 0.20 * lp).toFixed(3) + ')');
    }

    function resize() {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      npts = Math.ceil(w / STEP) + 2;
      for (var i = 0; i < LAYERS; i++) ys[i] = new Float32Array(npts);
      /* gradient d'horizon mis en cache (recréé uniquement au resize) */
      horizonGrad = ctx.createLinearGradient(0, h * 0.16, 0, h * 0.62);
      horizonGrad.addColorStop(0, 'hsla(285, 60%, 60%, 0)');
      horizonGrad.addColorStop(0.55, 'hsla(285, 55%, 58%, 0.055)');
      horizonGrad.addColorStop(1, 'hsla(285, 55%, 58%, 0)');
    }
    resize();
    window.addEventListener('resize', resize);

    /* crête montagneuse : bruit « ridged » (pics nets) */
    function ridgeY(u) {
      var v = Math.sin(u) * 0.52
            + Math.sin(u * 2.27 + 1.7) * 0.29
            + Math.sin(u * 5.13 + 4.2) * 0.13
            + Math.sin(u * 11.7 + 8.9) * 0.06;
      return 1 - Math.abs(v); /* 0..1, pics aigus */
    }

    /* calcule les hauteurs de la crête i UNE fois par frame (réutilisé partout) */
    function computeLayer(i) {
      var p = i / (LAYERS - 1); /* 0 = lointain, 1 = proche */
      var baseY = h * (0.46 + 0.50 * p);
      var amp = h * (0.30 - 0.10 * p);
      var drift = t * (0.18 + 0.75 * p); /* parallaxe : devant plus rapide */
      var arr = ys[i];
      for (var k = 0; k < npts; k++) {
        var u = k * STEP * 0.0042 + i * 9.31 + drift;
        arr[k] = baseY - ridgeY(u) * amp;
      }
    }

    function frame() {
      t += 0.004;

      /* lumière : conversion viewport -> canvas une seule fois par frame */
      var rect = canvas.getBoundingClientRect();
      var mx = cx - rect.left, my = cy - rect.top;
      overCanvas = cx > -9000 && mx >= 0 && mx <= rect.width && my >= -80 && my <= rect.height + 80;
      if (overCanvas && gx < -999) { gx = mx; gy = my; }
      gx += (mx - gx) * 0.09;
      gy += (my - gy) * 0.09;
      glowA += ((overCanvas ? 1 : 0) - glowA) * 0.07;
      var lit = glowA > 0.02 && gx > -999;
      var R = Math.max(260, Math.min(w, h) * 0.38);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, 0, w, h);

      /* assombrissement global du côté opposé à la lumière (partagé par tous les plans) */
      var shadeGrad = null;
      if (lit) {
        var lx = Math.min(Math.max(gx / w, 0), 1);
        var dk = 0.22 * glowA;
        shadeGrad = ctx.createLinearGradient(0, 0, w, 0);
        shadeGrad.addColorStop(0, 'rgba(2, 2, 6, ' + (dk * lx).toFixed(3) + ')');
        shadeGrad.addColorStop(lx, 'rgba(2, 2, 6, 0)');
        shadeGrad.addColorStop(1, 'rgba(2, 2, 6, ' + (dk * (1 - lx)).toFixed(3) + ')');
      }

      for (var i = 0; i < LAYERS; i++) {
        computeLayer(i);
        var arr = ys[i];
        var k, x, y;

        /* ombre portée : la crête projetée à l'opposé de la lumière,
           visible sur les plans plus lointains */
        if (lit) {
          ctx.beginPath();
          ctx.moveTo(0, arr[0]);
          for (k = 1; k < npts; k++) ctx.lineTo(k * STEP, arr[k]);
          for (k = npts - 1; k >= 0; k--) {
            x = k * STEP; y = arr[k];
            var sdx = x - gx, sdy = y - gy;
            var sd = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
            var sl = (110 * Math.max(0, 1 - sd / R) + 2) * glowA;
            ctx.lineTo(x + (sdx / sd) * sl, y + (sdy / sd) * sl);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(4, 3, 8, ' + (0.32 * glowA).toFixed(3) + ')';
          ctx.fill();
        }

        /* silhouette */
        ctx.beginPath();
        ctx.moveTo(-6, h + 6);
        for (k = 0; k < npts; k++) ctx.lineTo(k * STEP, arr[k]);
        ctx.lineTo(w + 6, h + 6);
        ctx.closePath();
        ctx.fillStyle = baseFill[i];
        ctx.fill();
        /* versant à l'ombre : le même chemin re-rempli avec le gradient */
        if (lit) { ctx.fillStyle = shadeGrad; ctx.fill(); }

        /* crête éclairée : Lambert par segment (pente face à la lumière = brillante),
           segments groupés en 5 niveaux pour limiter les strokes */
        if (lit && hasPath2D) {
          var basePath = new Path2D();
          var buckets = [null, null, null, null, null];
          for (k = 1; k < npts; k++) {
            var x0 = (k - 1) * STEP, y0 = arr[k - 1];
            x = k * STEP; y = arr[k];
            var dx = gx - (x0 + STEP / 2), dy = gy - (y0 + y) / 2;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            var fall = 1 - dist / R;
            var b = 0;
            if (fall > 0) {
              var slope = (y - y0) / STEP;
              /* normale (slope, -1) · direction de la lumière */
              var lam = (slope * dx / dist - dy / dist) / Math.sqrt(slope * slope + 1);
              b = fall * (0.25 + 0.75 * Math.max(0, lam)) * glowA;
            }
            var bi = Math.min(NB, Math.floor(b * (NB + 1)));
            if (bi <= 0) { basePath.moveTo(x0, y0); basePath.lineTo(x, y); }
            else {
              if (!buckets[bi - 1]) buckets[bi - 1] = new Path2D();
              buckets[bi - 1].moveTo(x0, y0); buckets[bi - 1].lineTo(x, y);
            }
          }
          ctx.lineWidth = 1;
          ctx.strokeStyle = baseStroke[i];
          ctx.stroke(basePath);
          for (var q = 0; q < NB; q++) {
            if (!buckets[q]) continue;
            var f = (q + 1) / NB;
            ctx.lineWidth = 1 + f * 0.8;
            ctx.strokeStyle = 'hsla(' + (290 - 8 * f).toFixed(0) + ', 95%, ' + (68 + 14 * f).toFixed(0) + '%, ' + (0.25 + 0.65 * f).toFixed(3) + ')';
            ctx.stroke(buckets[q]);
          }
          ctx.lineWidth = 1;
        } else {
          ctx.beginPath();
          ctx.moveTo(0, arr[0]);
          for (k = 1; k < npts; k++) ctx.lineTo(k * STEP, arr[k]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = baseStroke[i];
          ctx.stroke();
        }
      }

      /* halo ambiant autour de la lumière */
      if (lit) {
        var halo = ctx.createRadialGradient(gx, gy, 0, gx, gy, R);
        halo.addColorStop(0, 'hsla(290, 80%, 68%, ' + (0.08 * glowA).toFixed(3) + ')');
        halo.addColorStop(1, 'hsla(290, 80%, 68%, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(gx - R, gy - R, R * 2, R * 2);
      }

      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    if (reduceMotion) {
      /* une seule frame statique */
      t = 4.2; frame(); stop();
      return;
    }

    /* ne dessine que quand le canvas est visible */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0 }).observe(canvas);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (visible) start();
    });
  }

  document.querySelectorAll('canvas.hero-canvas').forEach(initWaves);

  /* ---------- curseur custom ---------- */
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    document.body.classList.add('has-cursor');
    var dot = document.createElement('div');
    var ring = document.createElement('div');
    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var mx = -100, my = -100, rx = -100, ry = -100;

    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + (mx - 3) + 'px,' + (my - 3) + 'px)';
    });

    (function ringLoop() {
      rx += (mx - rx) * 0.14;
      ry += (my - ry) * 0.14;
      ring.style.transform = 'translate(' + (rx - ring.offsetWidth / 2) + 'px,' + (ry - ring.offsetHeight / 2) + 'px)';
      requestAnimationFrame(ringLoop);
    })();

    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('a, button, image-slot, .hover-target')) ring.classList.add('is-hover');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a, button, image-slot, .hover-target')) ring.classList.remove('is-hover');
    });
  }

  /* ---------- nav scrolled ---------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- révélation mot à mot ---------- */
  if (!reduceMotion) {
    var wordTargets = document.querySelectorAll('.about-text p, .footer-big, .section-head h2, .pp-title, .case-section h3');
    wordTargets.forEach(function (el) {
      var count = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            var parts = child.textContent.split(/(\s+)/);
            var frag = document.createDocumentFragment();
            parts.forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var w = document.createElement('span'); w.className = 'w';
              var wi = document.createElement('span'); wi.className = 'wi';
              wi.textContent = part;
              wi.style.transitionDelay = Math.min(count * 0.045, 0.7).toFixed(3) + 's';
              count++;
              w.appendChild(wi);
              frag.appendChild(w);
            });
            node.replaceChild(frag, child);
          } else if (child.nodeType === 1 && child.tagName !== 'BR') {
            walk(child);
          }
        });
      })(el);
      el.classList.add('words');
      if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
    });
  }

  /* ---------- stagger automatique des listes ---------- */
  document.querySelectorAll('.proj-list, .other-grid, .comp-list').forEach(function (list) {
    Array.prototype.slice.call(list.children).forEach(function (el, i) {
      if (el.hasAttribute && el.hasAttribute('data-reveal')) {
        el.style.setProperty('--d', Math.min(i * 0.08, 0.45).toFixed(2) + 's');
      }
    });
  });

  /* ---------- reveals au scroll ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- effets liés au scroll ---------- */
  if (!reduceMotion) {
    var progress = document.createElement('div');
    progress.className = 'scroll-progress';
    document.body.appendChild(progress);

    var heroInner = document.querySelector('.hero-inner');
    var ppTitleWrap = document.querySelector('.pp-hero');
    var pxEls = Array.prototype.slice.call(document.querySelectorAll('.pp-media image-slot, .about-side image-slot'));
    var fxTicking = false;

    function scrollFx() {
      fxTicking = false;
      var sc = window.scrollY;
      var vh = window.innerHeight;
      var max = document.documentElement.scrollHeight - vh;
      progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(sc / max, 1) : 0).toFixed(4) + ')';

      /* parallaxe + fondu du hero */
      if (heroInner && sc < vh * 1.2) {
        heroInner.style.transform = 'translateY(' + (sc * 0.22).toFixed(1) + 'px)';
        heroInner.style.opacity = Math.max(0, 1 - sc / (vh * 0.85)).toFixed(3);
      }
      if (ppTitleWrap && sc < vh) {
        ppTitleWrap.style.setProperty('opacity', Math.max(0, 1 - sc / (vh * 0.9)).toFixed(3));
      }

      /* parallaxe douce des médias */
      for (var i = 0; i < pxEls.length; i++) {
        var r = pxEls[i].getBoundingClientRect();
        if (r.bottom < -120 || r.top > vh + 120) continue;
        var off = (r.top + r.height / 2 - vh / 2) * -0.07;
        pxEls[i].style.transform = 'translateY(' + off.toFixed(1) + 'px)';
      }
    }
    window.addEventListener('scroll', function () {
      if (!fxTicking) { fxTicking = true; requestAnimationFrame(scrollFx); }
    }, { passive: true });
    window.addEventListener('resize', scrollFx);
    scrollFx();
  }

  /* ---------- déclenche l'anim d'entrée ---------- */
  window.addEventListener('load', function () {
    requestAnimationFrame(function () {
      document.body.classList.add('loaded');
    });
  });
  /* fallback si load a déjà eu lieu */
  if (document.readyState === 'complete') document.body.classList.add('loaded');
})();
