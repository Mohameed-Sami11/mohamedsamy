(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Shared mouse position, from -1 to 1 (0 = center). Used by the
     photo and the work card for the 3D parallax. */
  const cam = { x: 0, y: 0 };

  /* ---------- Mouse parallax on the hero ---------- */
  const hero = document.getElementById('top');
  if (hero && fineHover && !reduce) {
    let tx = 0, ty = 0, raf = 0;
    const step = () => {
      cam.x += (tx - cam.x) * 0.07;
      cam.y += (ty - cam.y) * 0.07;
      hero.style.setProperty('--mx', cam.x.toFixed(3));
      hero.style.setProperty('--my', cam.y.toFixed(3));
      const moving = Math.abs(tx - cam.x) > 0.002 || Math.abs(ty - cam.y) > 0.002;
      raf = moving ? requestAnimationFrame(step) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      kick();
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }

  /* ---------- Live background: timeline ----------
     A timecode ruler on top, a video track and an audio track. Everything
     slides left past a fixed playhead, and a clip lights up while it is
     under the playhead. Tune with the numbers marked "TUNE". */
  const tl = document.getElementById('timeline');
  if (tl) {
    const small = window.innerWidth < 700;
    const TICK = 16;                       // px between ruler ticks (5 ticks = 1 label)
    const PAD = 300;                       // space off-screen, so nothing runs out
    const V_SPEED = 18;                    // TUNE: px per second, video track and ruler
    const A_SPEED = 13;                    // TUNE: px per second, audio track
    const MIN_W = small ? 50 : 70;
    const MAX_W = small ? 140 : 230;
    const GAP_MIN = 10;
    const GAP_MAX = small ? 36 : 56;
    const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
    const pad2 = (n) => String(n).padStart(2, '0');
    const place = (el, x) => { el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)'; };
    const wrap = (x0, off, span) => ((x0 - off) % span + span) % span - PAD;
    const playhead = tl.querySelector('.playhead');
    let ruler = [];
    let rulerSpan = 1;
    let tracks = [];
    let viewW = 0;
    let phX = 0;

    const build = () => {
      tl.querySelectorAll('.tl-ruler, .tl-track').forEach((n) => n.remove());
      viewW = window.innerWidth;
      phX = playhead.getBoundingClientRect().left + 1;

      const rul = document.createElement('div');
      rul.className = 'tl-ruler';
      tl.insertBefore(rul, playhead);
      const N = Math.ceil((viewW + 2 * PAD) / TICK) + 2;
      rulerSpan = N * TICK;
      ruler = Array.from({ length: N }, (_, i) => {
        const el = document.createElement('div');
        const major = i % 5 === 0;
        el.className = 'tl-tick' + (major ? ' major' : '');
        if (major) {
          const lab = document.createElement('span');
          lab.className = 'tl-label';
          lab.textContent = '00:' + pad2(Math.floor(i / 5) % 60);
          el.appendChild(lab);
        }
        rul.appendChild(el);
        return { el, x0: i * TICK };
      });

      const makeTrack = (cls, types, speed) => {
        const row = document.createElement('div');
        row.className = 'tl-track ' + cls;
        tl.insertBefore(row, playhead);
        const clips = [];
        const end = viewW + 2 * PAD;
        let x = rnd(0, MAX_W);
        let k = 0;
        while (x < end) {
          const w = rnd(MIN_W, MAX_W);
          const type = types[k % types.length];
          k += 1;
          const el = document.createElement('div');
          el.className = 'clip ' + type;
          el.style.width = w.toFixed(0) + 'px';
          if (type !== 'a') {
            // temporary thumbnail from assets (replace with real frames later)
            el.classList.add('thumb');
            el.style.backgroundImage = 'url("assets/work-' + (1 + Math.floor(Math.random() * 5)) + '.jpg")';
          }
          row.appendChild(el);
          clips.push({ el, x0: x, w, on: false });
          x += w + rnd(GAP_MIN, GAP_MAX);
        }
        return { clips, speed, span: x };
      };

      tracks = [
        makeTrack('v', ['v', 'v', 'ai'], V_SPEED),
        makeTrack('a', ['a'], A_SPEED),
      ];
    };

    const frame = (t) => {
      for (const r of ruler) place(r.el, wrap(r.x0, t * V_SPEED, rulerSpan));
      for (const tr of tracks) {
        const off = t * tr.speed;
        for (const c of tr.clips) {
          const p = wrap(c.x0, off, tr.span);
          place(c.el, p);
          const on = p <= phX && p + c.w >= phX;
          if (on !== c.on) { c.on = on; c.el.classList.toggle('on', on); }
        }
      }
    };

    build();
    frame(0);
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { build(); frame(performance.now() / 1000); }, 150);
    });
    // ambient: always animates, even if the OS asks for reduced motion
    const loop = (now) => { frame(now / 1000); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /* ---------- Live background: floating light dust ----------
     Soft glowing specks drift upward and twinkle, like dust in a projector beam. */
  const dust = document.getElementById('dust');
  if (dust && dust.getContext) {
    const ctx = dust.getContext('2d');
    const COUNT = window.innerWidth < 700 ? 22 : 46;   // TUNE: how many specks
    const GLOW = 1;                                    // TUNE: 0.5 = fainter, 1.5 = brighter
    const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
    let w = 0;
    let h = 0;

    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    (() => {
      const g = sprite.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(198,163,255,0.8)');
      grad.addColorStop(1, 'rgba(139,77,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    })();

    let specks = [];
    const spawn = (anywhere) => ({
      x: rnd(0, w),
      y: anywhere ? rnd(0, h) : h + 20,
      r: rnd(3, 11),
      vy: rnd(6, 22),
      vx: rnd(-5, 5),
      a: rnd(0.25, 0.6),
      tw: rnd(0.5, 1.6),
      ph: rnd(0, 6.28)
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      dust.width = Math.round(w * dpr);
      dust.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      specks = Array.from({ length: COUNT }, () => spawn(true));
    };

    const draw = (t, dt) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const s of specks) {
        s.y -= s.vy * dt;
        s.x += s.vx * dt;
        if (s.y < -20 || s.x < -20 || s.x > w + 20) Object.assign(s, spawn(false));
        ctx.globalAlpha = Math.min(1, s.a * GLOW * (0.6 + 0.4 * Math.sin(t * s.tw + s.ph)));
        ctx.drawImage(sprite, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    window.addEventListener('resize', resize);
    resize();
    draw(0, 0);
    // ambient: always animates, even if the OS asks for reduced motion
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(now / 1000, dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- Live timecode in the hero ---------- */
  const tc = document.getElementById('tc');
  if (tc && !reduce) {
    const FPS = 25;
    const t0 = performance.now();
    const pad = (n) => String(n).padStart(2, '0');
    const tick = (now) => {
      const frames = Math.floor(((now - t0) / 1000) * FPS);
      const s = Math.floor(frames / FPS);
      tc.textContent =
        pad(Math.floor(s / 3600)) + ':' +
        pad(Math.floor(s / 60) % 60) + ':' +
        pad(s % 60) + ':' +
        pad(frames % FPS);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- "A Part Of My Work" slideshow ----------
     Each image stays for --slide-time (5s, set in style.css).
     The progress bar under the image is a CSS animation; when it
     ends, we move to the next image. Hover pauses it on desktop.
     Click the left half of the image for previous, right half for next. */
  const frame = document.getElementById('workFrame');
  const slides = frame ? Array.from(frame.querySelectorAll('.work-slide')) : [];
  const segs = Array.from(document.querySelectorAll('#workSegs .seg'));
  const wcTitle = document.getElementById('wcTitle');
  const wcTag = document.getElementById('wcTag');
  const wcCount = document.getElementById('wcCount');
  let current = 0;

  const show = (n) => {
    if (!slides.length) return;
    current = (n + slides.length) % slides.length;

    slides.forEach((s, k) => s.classList.toggle('is-active', k === current));

    segs.forEach((g, k) => {
      g.classList.remove('run');
      g.classList.toggle('done', k < current);
      g.classList.toggle('current', k === current);
      if (k === current && !reduce) {
        void g.offsetWidth; // restart the CSS animation
        g.classList.add('run');
      }
    });

    const active = slides[current];
    if (wcTitle) wcTitle.textContent = active.dataset.title || '';
    if (wcTag) wcTag.textContent = active.dataset.tag || '';
    if (wcCount) {
      wcCount.textContent =
        String(current + 1).padStart(2, '0') + '/' + String(slides.length).padStart(2, '0');
    }
  };

  if (slides.length) {
    // A plain timer moves to the next picture every 5 seconds. It does not
    // depend on the progress bar's animation events, so it always runs.
    // The timer pauses while the mouse is over the card (desktop only).
    const card = document.querySelector('.work-card');
    const SLIDE_MS = 5000;
    let hovering = false;
    let timer = 0;
    const startTimer = () => {
      clearInterval(timer);
      timer = setInterval(() => { if (!hovering) show(current + 1); }, SLIDE_MS);
    };
    if (card && fineHover) {
      card.addEventListener('mouseenter', () => { hovering = true; });
      card.addEventListener('mouseleave', () => { hovering = false; });
    }
    segs.forEach((g, k) => {
      g.addEventListener('click', () => { show(k); startTimer(); });
    });
    frame.addEventListener('click', (e) => {
      const r = frame.getBoundingClientRect();
      show(e.clientX - r.left < r.width / 2 ? current - 1 : current + 1);
      startTimer();
    });
    show(0);
    startTimer();
  }

  /* ---------- Copy the WhatsApp number ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = document.getElementById(btn.dataset.copy);
      if (!target) return;
      const text = target.textContent.trim();
      let label = 'Copied';
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        label = 'Selected';
      }
      btn.textContent = label;
      setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
    });
  });
})();