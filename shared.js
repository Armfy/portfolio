/* Portfolio Rahim Tamhaev — interactions partagées
   montagnes animées · curseur custom · reveals au scroll */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- fond animé : montagnes éclairées par le curseur ---------- */
  /* Montagnes éclairées par le curseur — rendu GLSL (un seul quad plein écran).
     L'éclairage est calculé par pixel : pas de scintillement, pas de strokes. */
  function initWaves(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, t = Math.random() * 100, raf = null, visible = true;
    var cx = -9999, cy = -9999, gx = -9999, gy = -9999, glowA = 0, overCanvas = false;

    document.addEventListener('mousemove', function (e) { cx = e.clientX; cy = e.clientY; });

    var gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false })
          || canvas.getContext('experimental-webgl', { antialias: true });

    /* repli : aucun WebGL → dégradé statique */
    if (!gl) {
      var c2 = canvas.getContext('2d');
      var draw2d = function () {
        w = canvas.offsetWidth; h = canvas.offsetHeight;
        canvas.width = w * dpr; canvas.height = h * dpr;
        c2.setTransform(dpr, 0, 0, dpr, 0, 0);
        var g = c2.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0c0917'); g.addColorStop(1, '#16112b');
        c2.fillStyle = g; c2.fillRect(0, 0, w, h);
      };
      draw2d(); window.addEventListener('resize', draw2d);
      return;
    }

    var FS = [
      'precision highp float;',
      'uniform vec2 u_res;',
      'uniform float u_dpr;',
      'uniform float u_time;',
      'uniform vec2 u_light;',
      'uniform float u_glow;',
      'const int LAYERS = 7;',
      'float ridge(float u){',
      '  float v = sin(u)*0.52 + sin(u*2.27+1.7)*0.29 + sin(u*5.13+4.2)*0.13 + sin(u*11.7+8.9)*0.06;',
      '  return 1.0 - abs(v);',
      '}',
      'float topY(int i, float x, float H){',
      '  float p = float(i)/float(LAYERS-1);',
      '  float baseY = H*(0.46+0.50*p);',
      '  float amp = H*(0.30-0.10*p);',
      '  float drift = u_time*(0.18+0.75*p);',
      '  float u = x*0.0042 + float(i)*9.31 + drift;',
      '  return H - (baseY - ridge(u)*amp);',
      '}',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
      'void main(){',
      '  float W = u_res.x/u_dpr;',
      '  float H = u_res.y/u_dpr;',
      '  vec2 P = gl_FragCoord.xy/u_dpr;',
      '  float ty = P.y / H;',
      '  vec3 col = mix(vec3(0.050,0.038,0.082), vec3(0.090,0.062,0.150), smoothstep(0.15,1.0,ty));',
      '  float R = 0.42*min(W,H);',
      '  float dist = distance(P, u_light);',
      '  float fall = u_glow * smoothstep(R, 0.0, dist);',
      '  col += vec3(0.30,0.16,0.42) * smoothstep(0.62,0.42,ty) * smoothstep(0.20,0.45,ty) * (0.06 + 0.10*fall);',
      '  if (ty > 0.42) {',
      '    vec2 g = floor(P/3.0);',
      '    float hs = hash(g);',
      '    if (hs > 0.987) {',
      '      float tw = 0.5 + 0.5*sin(u_time*6.0*(0.6+hash(g+7.0)) + hash(g)*6.2832);',
      '      float near = max(0.0, 1.0 - dist/(R*1.3));',
      '      float a = (0.18 + 0.5*tw)*(0.55 + 0.45*u_glow) + 0.5*near*u_glow;',
      '      col += mix(vec3(0.78,0.80,0.92), vec3(0.85,0.55,0.98), near) * a;',
      '    }',
      '  }',
      '  for (int i=0;i<LAYERS;i++){',
      '    float p = float(i)/float(LAYERS-1);',
      '    float T = topY(i, P.x, H);',
      '    if (P.y < T) {',
      '      vec3 base = mix(vec3(0.030,0.024,0.050), vec3(0.075,0.050,0.110), p);',
      '      float dx = 1.5;',
      '      float slope = (topY(i, P.x+dx, H) - topY(i, P.x-dx, H))/(2.0*dx);',
      '      vec2 n = normalize(vec2(-slope, 1.0));',
      '      vec2 ld = normalize(u_light - P);',
      '      float lam = max(0.0, dot(n, ld));',
      '      float surf = fall*(0.20 + 0.34*p);',
      '      base += vec3(0.62,0.30,0.86) * surf * (0.55 + 0.45*lam);',
      '      float d = T - P.y;',
      '      float rim = smoothstep(1.6,0.0,d) + 0.45*smoothstep(9.0,0.0,d);',
      '      base += vec3(0.85,0.60,1.0) * rim * (0.12 + 0.88*fall) * (0.40 + 0.60*lam);',
      '      col = base;',
      '    }',
      '  }',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    var VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.clearColor(0.055, 0.043, 0.094, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aLoc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'u_res');
    var uDpr = gl.getUniformLocation(prog, 'u_dpr');
    var uTime = gl.getUniformLocation(prog, 'u_time');
    var uLight = gl.getUniformLocation(prog, 'u_light');
    var uGlow = gl.getUniformLocation(prog, 'u_glow');

    function resize() {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    function frame() {
      t += 0.0032;

      /* lumière : suit le curseur au survol, sinon dérive en autonomie */
      var rect = canvas.getBoundingClientRect();
      var mx = cx - rect.left, my = cy - rect.top;
      overCanvas = cx > -9000 && mx >= 0 && mx <= rect.width && my >= -80 && my <= rect.height + 80;
      var autoX = w * (0.5 + 0.32 * Math.sin(t * 0.40));
      var autoY = h * (0.28 + 0.09 * Math.sin(t * 0.63 + 1.1));
      var tx = overCanvas ? mx : autoX;
      var ty = overCanvas ? my : autoY;
      if (gx < -999) { gx = tx; gy = ty; }
      var ease = overCanvas ? 0.10 : 0.022;
      gx += (tx - gx) * ease;
      gy += (ty - gy) * ease;
      glowA += ((overCanvas ? 1 : 0.55) - glowA) * 0.05;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uLight, gx, h - gy); /* repère y vers le haut, comme gl_FragCoord */
      gl.uniform1f(uGlow, glowA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    if (reduceMotion) {
      /* une seule frame statique, déjà éclairée */
      t = 4.2; glowA = 0.6; gx = w * 0.62; gy = h * 0.3; frame(); stop();
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

  /* ---------- filet de s\u00e9curit\u00e9 : masque les logos d'outils introuvables ---------- */
  document.querySelectorAll('.tool img').forEach(function (img) {
    img.addEventListener('error', function () { img.style.display = 'none'; });
    if (img.complete && img.naturalWidth === 0) img.style.display = 'none';
  });

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
