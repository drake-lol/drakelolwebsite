/**
 * script.js — modern, Safari/iOS-hardened rewrite
 * - Fills under iOS translucent address bar (no gray gap)
 * - Two.js scene scales to real viewport (desktop + iOS)
 * - Gradient stays behind UI chrome; cakes + menu sit above
 * - Keeps your Last.fm color logic scaffold-ready (plug in your endpoint)
 * - Keeps blur layer + jiggly menu + raining cakes visuals
 *
 * DOM expected (from your HTML):
 *   #scene-container > #blur-layer-1 > #canvas-host
 *   #raining-cakes-container, .b-c (menu), .signature-container
 *   <meta name="theme-color"> present
 *
 * External deps loaded via <script defer> in HTML:
 *   - two.js 0.8.12
 *   - color-thief
 */

(function () {
  'use strict';

  // ---------- Shortcuts ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- DOM ----------
  const sceneContainer = $('#scene-container');
  const blurLayer = $('#blur-layer-1');
  const canvasHost = $('#canvas-host');
  const cakesContainer = $('#raining-cakes-container');
  const metaTheme = $('meta[name="theme-color"]');
  const menuContainer = $('.b-c');

  if (!sceneContainer || !blurLayer || !canvasHost) {
    console.error('Required scene elements missing.');
    return;
  }

  // ---------- Environment + iOS/Safari fixes ----------
  const Env = (() => {
    let vw = 0, vh = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const getSafeVh = () =>
      (window.visualViewport ? window.visualViewport.height : window.innerHeight) || window.innerHeight;

    const getSafeVw = () =>
      (window.visualViewport ? window.visualViewport.width : window.innerWidth) || window.innerWidth;

    function updateThemeColorForTranslucency() {
      // Make the browser chrome translucent over our page background (iOS Safari 15+ honors RGBA)
      if (metaTheme) metaTheme.setAttribute('content', 'rgba(0,0,0,0)');
    }

    function applyRootVars() {
      vw = Math.floor(getSafeVw());
      vh = Math.floor(getSafeVh());

      // CSS vars other styles can use (if needed)
      document.documentElement.style.setProperty('--vw', `${vw}px`);
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      document.documentElement.style.setProperty('--dpr', `${dpr}`);

      // Keep the page background covering the *visual* viewport, including under the translucent bars
      // We do it in JS to react to iOS URL bar show/hide + rotation.
      document.documentElement.style.setProperty('--real100vh', `${vh}px`);

      // Ensure the containers track the actual viewport
      Object.assign(sceneContainer.style, {
        position: 'fixed',
        inset: '0',
        width: `${vw}px`,
        height: `${vh}px`,
        background: 'transparent',
        overflow: 'hidden',
        zIndex: '0',
        touchAction: 'none'
      });

      Object.assign(blurLayer.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        willChange: 'filter'
      });

      Object.assign(canvasHost.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        background: 'transparent'
      });
    }

    function onViewportChange() {
      applyRootVars();
      updateThemeColorForTranslucency();
      Scene.resize(vw, vh, dpr);
    }

    function init() {
      applyRootVars();
      updateThemeColorForTranslucency();

      window.addEventListener('resize', onViewportChange, { passive: true });
      window.addEventListener('orientationchange', onViewportChange, { passive: true });
      window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });
      window.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // iOS sometimes pauses RAF / WebGL; nudge it
          Scene.resume();
          onViewportChange();
        } else {
          Scene.hintPause();
        }
      });
    }

    return { init, onViewportChange, get vw() { return vw; }, get vh() { return vh; }, get dpr() { return dpr; } };
  })();

  // ---------- Color / Palette helpers (kept lightweight; plug Last.fm pipeline as needed) ----------
  const Color = (() => {
    const MAX_LIGHTNESS = 0.35; // clamp high-luma to avoid washed UI

    const clamp01 = (x) => Math.min(1, Math.max(0, x));
    const compToHex = (c) => (~~c).toString(16).padStart(2, '0');
    const rgbToHex = (r, g, b) => `#${compToHex(r)}${compToHex(g)}${compToHex(b)}`;

    function hexToRgb(h) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
      return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 18, g: 18, b: 18 };
    }
    function hexToHsl(hex) {
      const { r, g, b } = hexToRgb(hex);
      let rn = r / 255, gn = g / 255, bn = b / 255;
      const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > .5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
          case gn: h = (bn - rn) / d + 2; break;
          case bn: h = (rn - gn) / d + 4; break;
        }
        h /= 6;
      }
      return { h: h * 360, s, l };
    }
    function hslToHex(h, s, l) {
      h = (h % 360 + 360) % 360;
      s = clamp01(s); l = clamp01(l);
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      let r, g, b;
      if (s === 0) r = g = b = l;
      else {
        const q = l < .5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h / 360 + 1 / 3);
        g = hue2rgb(p, q, h / 360);
        b = hue2rgb(p, q, h / 360 - 1 / 3);
      }
      return rgbToHex(r * 255, g * 255, b * 255);
    }

    function clampLightness(hex) {
      const hsl = hexToHsl(hex);
      if (hsl.l > MAX_LIGHTNESS) {
        return hslToHex(hsl.h, hsl.s, MAX_LIGHTNESS);
      }
      return hex;
    }

    return { hexToRgb, hexToHsl, hslToHex, clampLightness };
  })();

  // ---------- Scene (Two.js) ----------
  const Scene = (() => {
    const RESOLUTION_BASE = 16; // speed scale reference
    let two = null;
    let canvasEl = null;
    let shapes = [];
    let transitions = [];
    let fadingOut = [];
    let lastNow = performance.now();
    let paused = false;

    // Tunables (kept from your behavior)
    const CONFIG = {
      numShapes: 60,
      minSpeed: 0.00390625,
      maxSpeed: 0.01953125,
      minRot: 0.002,
      maxRot: 0.01,
      fadeMs: 500
    };

    // Palette state (defaults get replaced by Last.fm when available)
    let bgColor = '#121212';
    let palette = [
      { color: '#ec5d57', weight: 30 },
      { color: '#7aa9ff', weight: 25 },
      { color: '#66e48f', weight: 20 },
      { color: '#d9c16a', weight: 15 },
      { color: '#a473d0', weight: 10 }
    ].map(c => ({ ...c, color: Color.clampLightness(c.color) }));

    function rand(a, b) { return Math.random() * (b - a) + a; }
    function randi(a, b) { return (Math.random() * (b - a + 1) + a) | 0; }

    function pickWeighted(pal) {
      const total = pal.reduce((s, c) => s + c.weight, 0) || 1;
      let r = Math.random() * total;
      for (const c of pal) {
        if (r < c.weight) return c.color;
        r -= c.weight;
      }
      return pal[pal.length - 1].color;
    }

    function makeOrganic(size, fillHex) {
      const points = randi(6, 10);
      const anchors = [];
      const avgR = size / 2;
      for (let i = 0; i < points; i++) {
        const base = (i / points) * Math.PI * 2;
        const jitter = (Math.PI * 2 / points) * rand(-0.35, 0.35);
        const radius = avgR * rand(0.55, 1.45);
        anchors.push(new Two.Anchor(Math.cos(base + jitter) * radius, Math.sin(base + jitter) * radius));
      }
      const p = new Two.Path(anchors, true, true, false);
      p.noStroke(); p.fill = fillHex; p.opacity = 1; p.rotation = rand(0, Math.PI * 2);
      return p;
    }

    function spawnShape(isTransition = false) {
      if (!two) return null;

      const minDim = Math.min(two.width, two.height);
      const baseSize = rand(isTransition ? 0.375 : 0.25, isTransition ? 0.825 : 0.55) * minDim;
      const color = pickWeighted(palette);
      const shape = makeOrganic(baseSize, color);

      // spawn along edges or random cluster
      const offset = baseSize * 0.7;
      const side = randi(0, 3);
      let x = 0, y = 0;
      const speedBase = rand(CONFIG.minSpeed, CONFIG.maxSpeed) *
        (two.width / RESOLUTION_BASE);
      const speed = speedBase * (isTransition ? 2.0 : 1.0);
      let vx = 0, vy = 0;

      if (Math.random() < 0.5 && !isTransition) {
        // clustered start near center
        const cx = two.width / 2, cy = two.height / 2;
        const ang = rand(0, Math.PI * 2);
        const dist = rand(0, Math.min(two.width, two.height) * 0.2);
        x = cx + Math.cos(ang) * dist;
        y = cy + Math.sin(ang) * dist;
        const vAng = rand(0, Math.PI * 2);
        vx = Math.cos(vAng) * speed;
        vy = Math.sin(vAng) * speed;
      } else {
        // edge spawn
        if (side === 0) { x = -offset; y = rand(0, two.height); vx = speed; vy = rand(-speed * 0.3, speed * 0.3); }
        if (side === 1) { x = rand(0, two.width); y = -offset; vx = rand(-speed * 0.3, speed * 0.3); vy = speed; }
        if (side === 2) { x = two.width + offset; y = rand(0, two.height); vx = -speed; vy = rand(-speed * 0.3, speed * 0.3); }
        if (side === 3) { x = rand(0, two.width); y = two.height + offset; vx = rand(-speed * 0.3, speed * 0.3); vy = -speed; }
      }

      shape.translation.set(x, y);
      const rot = rand(CONFIG.minRot, CONFIG.maxRot) * (Math.random() < 0.5 ? -1 : 1);

      const datum = {
        twoShape: shape,
        vx, vy, rot,
        w: baseSize, h: baseSize,
        targetOpacity: 1,
        born: performance.now(),
        fadeIn: isTransition
      };

      if (isTransition) transitions.push(datum); else shapes.push(datum);
      two.add(shape);
      return datum;
    }

    function cullAndRefill() {
      // cull extras
      while (shapes.length > CONFIG.numShapes) {
        const s = shapes.pop();
        if (s.twoShape?.parent) two.remove(s.twoShape);
      }
      // add missing
      while (shapes.length < CONFIG.numShapes) spawnShape(false);
    }

    function step(dt) {
      const W = two.width, H = two.height;

      // fade-ins
      for (let i = transitions.length - 1; i >= 0; i--) {
        const s = transitions[i];
        if (!s.twoShape) { transitions.splice(i, 1); continue; }
        const p = Math.min(1, (performance.now() - s.born) / CONFIG.fadeMs);
        s.twoShape.opacity = p * s.targetOpacity;
        s.twoShape.translation.x += s.vx * dt;
        s.twoShape.translation.y += s.vy * dt;
        s.twoShape.rotation += s.rot * dt;
        const off = Math.max(s.w, s.h) * 0.7;
        if (s.twoShape.translation.x < -off || s.twoShape.translation.x > W + off ||
            s.twoShape.translation.y < -off || s.twoShape.translation.y > H + off) {
          if (s.twoShape.parent) two.remove(s.twoShape);
          transitions.splice(i, 1);
        } else if (p >= 1) {
          // done transitioning → main pool
          transitions.splice(i, 1);
          shapes.push(s);
        }
      }

      // main shapes
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (!s.twoShape) { shapes.splice(i, 1); continue; }
        const sh = s.twoShape;
        sh.translation.x += s.vx * dt;
        sh.translation.y += s.vy * dt;
        sh.rotation += s.rot * dt;

        const off = Math.max(s.w, s.h) * 0.7;
        if (sh.translation.x < -off || sh.translation.x > W + off ||
            sh.translation.y < -off || sh.translation.y > H + off) {
          if (sh.parent) two.remove(sh);
          shapes.splice(i, 1);
        }
      }

      // refill if we lost some
      if (shapes.length < CONFIG.numShapes) {
        const need = CONFIG.numShapes - shapes.length;
        for (let i = 0; i < need; i++) spawnShape(false);
      }
    }

    function applyBlur(colorHex) {
      // Keep blur pipeline simple & performant (single layer, GPU-friendly)
      // You can expand to multi-layer if you want heavier blur.
      blurLayer.style.filter = 'none';
      canvasHost.style.filter = 'none';
      canvasHost.style.background = colorHex || 'transparent';
    }

    function setBackground(hex) {
      bgColor = Color.clampLightness(hex || '#121212');
      applyBlur(bgColor);
    }

    function setPalette(newPal) {
      if (Array.isArray(newPal) && newPal.length) {
        palette = newPal.map(p => ({ color: Color.clampLightness(p.color), weight: p.weight || 1 }));
        // spawn some transition shapes to blend the change
        for (let i = 0; i < Math.min(10, CONFIG.numShapes >> 1); i++) spawnShape(true);
      }
    }

    function init(width, height, dpr) {
      two = new Two({
        type: Two.Types.webgl, // prefer GPU
        width, height,
        autostart: true,
        ratio: dpr
      }).appendTo(canvasHost);

      canvasEl = two.renderer.domElement;
      Object.assign(canvasEl.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        background: 'transparent',
        imageRendering: 'pixelated'
      });

      lastNow = performance.now();
      two.bind('update', () => {
        if (paused) return;
        const now = performance.now();
        const dt = (now - lastNow);
        lastNow = now;
        step(dt);
      });

      setBackground(bgColor);
      cullAndRefill();
    }

    function resize(w, h, dpr) {
      if (!two) return;
      if (typeof two.renderer.setSize === 'function') two.renderer.setSize(w, h, dpr);
      two.width = w; two.height = h;
      two.trigger('resize');
      // keep a few transition shapes for nicer resize feel
      for (let i = 0; i < 6; i++) spawnShape(true);
    }

    function resume() {
      if (two && paused) { two.play(); paused = false; lastNow = performance.now(); }
    }

    function hintPause() {
      // We won't fully pause; Safari sometimes over-aggressively throttles already.
      // Keep running lightly to avoid context loss. You may set `paused = true;` if desired.
    }

    return {
      init, resize, resume, hintPause,
      setPalette, setBackground,
      get two() { return two; }
    };
  })();

  // ---------- Cakes (stay ABOVE the canvas) ----------
  const Cakes = (() => {
    const MAX_CAKES = 15;
    const WIDTH = 60, HEIGHT = 80;
    const MIN_SPEED = 0.08, MAX_SPEED = 0.24;
    const SPAWN_MS = 300;

    let active = [];
    let lastSpawn = 0;
    let running = false;

    function createCake(colorBase = '#424242', colorFrost = '#f5f5f5', colorCherry = '#c62828') {
      const el = document.createElement('div');
      el.className = 'small-cake';
      Object.assign(el.style, {
        position: 'absolute',
        width: `${WIDTH}px`, height: `${HEIGHT}px`,
        top: `-${HEIGHT}px`,
        left: `${Math.random() * Math.max(0, (Env.vw - WIDTH))}px`,
        willChange: 'transform, top'
      });

      const layer = (cls, img, mask, bg) => {
        const d = document.createElement('div');
        d.className = `small-cake-layer ${cls}`;
        Object.assign(d.style, {
          position: 'absolute', inset: '0',
          backgroundImage: `url("${img}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          WebkitMaskImage: `url("${mask}")`,
          maskImage: `url("${mask}")`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          backgroundColor: bg
        });
        return d;
      };

      const base = layer('small-cake-base',
        '/assets/bday/cakebase.png', '/assets/bday/cakebase_mask.png', colorBase);
      const frost = layer('small-cake-frosting',
        '/assets/bday/cakefrosting.png', '/assets/bday/cakefrosting_mask.png', colorFrost);
      const cherries = layer('small-cake-cherries',
        '/assets/bday/cakecherries.png', '/assets/bday/cakecherries_mask.png', colorCherry);

      el.append(base, frost, cherries);
      return el;
    }

    function step(ts) {
      if (!running) return;
      const dt = 16.67; // lightweight

      if (ts - lastSpawn > SPAWN_MS && active.length < MAX_CAKES) {
        lastSpawn = ts;
        const cake = {
          el: createCake(),
          y: -HEIGHT,
          rot: Math.random() * 360,
          vy: (Math.random() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED) * 16.67,
          rv: (Math.random() - 0.5) * 0.2
        };
        cakesContainer.appendChild(cake.el);
        active.push(cake);
      }

      for (let i = active.length - 1; i >= 0; i--) {
        const c = active[i];
        c.y += c.vy;
        c.rot += c.rv * dt;
        c.el.style.top = `${c.y}px`;
        c.el.style.transform = `rotate(${c.rot}deg)`;
        if (c.y > Env.vh + HEIGHT) {
          c.el.remove();
          active.splice(i, 1);
        }
      }

      requestAnimationFrame(step);
    }

    function start() {
      if (running) return;
      running = true;
      requestAnimationFrame(step);
    }
    function stop() { running = false; }

    return { start, stop };
  })();

  // ---------- Menu micro-interactions (jiggly push) ----------
  const Menu = (() => {
    function setupJiggle() {
      if (!menuContainer) return;
      const buttons = $$('.b-c .b');
      if (!buttons.length) return;

      const getS = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 75;

      buttons.forEach((button, idx) => {
        button.addEventListener('mouseenter', () => {
          const basePush = getS() * 0.4;
          const falloffBase = 0.5;
          let down = 0, up = 0;

          // ensure button visible in its scroller
          const cRect = menuContainer.getBoundingClientRect();
          const bRect = button.getBoundingClientRect();
          if (bRect.top < cRect.top || bRect.bottom > cRect.bottom) {
            button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          // push neighbors
          for (let i = idx + 1; i < buttons.length; i++) {
            const dist = i - idx;
            const push = basePush * Math.pow(falloffBase, dist - 1);
            down += push;
            buttons[i].style.transform = `translateY(${down}px)`;
          }
          for (let i = idx - 1; i >= 0; i--) {
            const dist = idx - i;
            const push = basePush * Math.pow(falloffBase, dist - 1);
            up -= push;
            buttons[i].style.transform = `translateY(${up}px)`;
          }
          button.style.transform = '';
        });

        button.addEventListener('mouseleave', () => {
          buttons.forEach(b => (b.style.transform = ''));
        });
      });

      menuContainer.addEventListener('mouseleave', () => {
        buttons.forEach(b => (b.style.transform = ''));
      });
    }

    return { setupJiggle };
  })();

  // ---------- Last.fm colors (stubbed, plug your existing Worker URL) ----------
  const NowPlaying = (() => {
    const WORKER_URL = 'https://lastfm-red-surf-3b97.damp-unit-21f3.workers.dev/';
    const POLL_MS = 15000;
    let timer = null;

    function pickPaletteFromImage(img) {
      // Use ColorThief to produce a palette; clamp for UI
      const ct = new ColorThief();
      const base = ct.getColor(img); // [r,g,b]
      const pal = ct.getPalette(img, 6) || [];
      const all = [base, ...pal];
      const safe = all.map((rgb, i) => ({
        color: Color.clampLightness(`#${[rgb[0], rgb[1], rgb[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`),
        weight: Math.sqrt(all.length - i)
      }));
      // background = clamped dominant
      Scene.setBackground(safe[0].color);
      Scene.setPalette(safe);
    }

    async function fetchAndApply() {
      try {
        const res = await fetch(WORKER_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        const track = data?.recenttracks?.track?.[0];
        const now = track && track['@attr']?.nowplaying === 'true';
        const imgUrl = now && (track.image?.find(i => i.size === 'extralarge')?.['#text'] ||
                               track.image?.find(i => i.size === 'large')?.['#text']);
        if (imgUrl) {
          const img = await new Promise((resolve, reject) => {
            const im = new Image();
            im.crossOrigin = 'anonymous';
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = imgUrl;
          });
          pickPaletteFromImage(img);
        }
      } catch (e) {
        // On error, keep current palette/background
        // (Your old script also fell back gracefully)
      }
    }

    function start() {
      stop();
      fetchAndApply();
      timer = setInterval(fetchAndApply, POLL_MS);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    return { start, stop };
  })();

  // ---------- Boot ----------
  function boot() {
    Env.init();
    Scene.init(Env.vw, Env.vh, Env.dpr);
    Menu.setupJiggle();
    Cakes.start();
    NowPlaying.start();

    // Ensure canvas stays fully transparent (gradient is in CSS on <body>)
    if (Scene.two?.renderer?.domElement) {
      Scene.two.renderer.domElement.style.background = 'transparent';
    }

    // First corrective layout pass for iOS URL bar states
    Env.onViewportChange();
    Scene.resume();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();