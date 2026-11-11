/* Client inquiry form: validation, loading state, duplicate protection,
   scroll reveal. Sends the request to your serverless Worker (see
   serverless/worker.js). No secrets live in this file. */
(() => {
  const ENDPOINT = 'https://portfolio-lead.mohamedsamy147227.workers.dev/lead'; // paste your Worker URL here
  const form = document.getElementById('inqForm');
  if (!form) return;

  const card = document.getElementById('inqCard');
  const btn = document.getElementById('inqBtn');
  const btnText = btn.querySelector('.inq-btn-text');
  const status = document.getElementById('inqStatus');
  const select = document.getElementById('inqService');
  const KEY = 'inqLastSent';
  const COOLDOWN_MS = 10 * 60 * 1000;
  const TIMEOUT_MS = 15000;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sending = false;
  let sent = false;

  /* Scroll reveal: the card rises in once it reaches the screen. */
  if (card && 'IntersectionObserver' in window && !reduce) {
    card.classList.add('pending');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          card.classList.add('in');
          io.disconnect();
        }
      }
    }, { threshold: 0.15 });
    io.observe(card);
  }

  const rules = {
    inqName: (v) => {
      const t = v.trim();
      if (!t) return 'Please enter your name.';
      if (t.length < 2) return 'Name is too short.';
      if (!/^[\p{L}\s.'-]+$/u.test(t)) return 'Use letters only in the name.';
      return '';
    },
    inqPhone: (v) => {
      const t = v.trim();
      if (!t) return 'Please enter your phone number.';
      if (!/^\+?[0-9\s()-]+$/.test(t)) return 'Use digits only (you can start with +).';
      const digits = t.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) return 'Enter a valid phone number (8 to 15 digits).';
      return '';
    },
    inqService: (v) => (v ? '' : 'Choose what you need.'),
    inqDesc: (v) => {
      const t = v.trim();
      if (!t) return 'Please describe your project.';
      if (t.length < 10) return 'Add a bit more detail (at least 10 characters).';
      return '';
    },
  };

  const setErr = (id, msg) => {
    const input = document.getElementById(id);
    const field = input.closest('.inq-field');
    const el = form.querySelector('[data-for="' + id + '"]');
    el.textContent = msg;
    field.classList.toggle('bad', Boolean(msg));
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  const validateAll = () => {
    let first = null;
    for (const id of Object.keys(rules)) {
      const msg = rules[id](document.getElementById(id).value);
      setErr(id, msg);
      if (msg && !first) first = id;
    }
    if (first) document.getElementById(first).focus();
    return !first;
  };

  /* Re-check a field when the visitor leaves it, and clear its error as they type. */
  for (const id of Object.keys(rules)) {
    const input = document.getElementById(id);
    input.addEventListener('blur', () => setErr(id, rules[id](input.value)));
    input.addEventListener('input', () => {
      if (input.closest('.inq-field').classList.contains('bad')) setErr(id, rules[id](input.value));
    });
  }

  const show = (msg, kind) => {
    status.textContent = msg;
    status.className = 'inq-status ' + (kind || '');
  };

  const recentlySent = () => {
    try {
      return Date.now() - Number(localStorage.getItem(KEY) || 0) < COOLDOWN_MS;
    } catch (e) {
      return false;
    }
  };

  const setLoading = (on) => {
    sending = on;
    btn.classList.toggle('is-loading', on);
    btn.disabled = on || sent;
    btnText.textContent = on ? 'Sending' : (sent ? 'Request sent' : 'Send Request');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending || sent) return;
    if (form.elements.website && form.elements.website.value) return; // honeypot: a bot filled it
    if (!validateAll()) {
      show('Please fix the highlighted fields.', 'err');
      return;
    }
    if (recentlySent()) {
      show('You already sent a request a few minutes ago. I will get back to you soon.', 'err');
      return;
    }
    if (ENDPOINT.includes('YOUR-WORKER')) {
      show('The form is not connected yet. Please use WhatsApp for now.', 'err');
      return;
    }

    const payload = {
      name: document.getElementById('inqName').value.trim(),
      phone: document.getElementById('inqPhone').value.trim(),
      service: select.options[select.selectedIndex].text,
      description: document.getElementById('inqDesc').value.trim(),
      website: '',
    };

    setLoading(true);
    show('', '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error('not ok');
      sent = true;
      try { localStorage.setItem(KEY, String(Date.now())); } catch (err) { /* private mode: ignore */ }
      form.reset();
      show('Thanks! Your request was received. I will get back to you soon.', 'ok');
    } catch (err) {
      show('Your request was not sent. Please try again, or message me on WhatsApp.', 'err');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  });
})();
