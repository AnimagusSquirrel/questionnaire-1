/* Questionnaire engine: slides, navigation, answers, per-slide timing, submission. */
(function () {
  const CFG = window.SURVEY_CONFIG;
  const SLIDES = window.SURVEY_SLIDES;
  const STORE_KEY = 'survey-session';
  const params = new URLSearchParams(location.search);

  const $ = (sel, root = document) => root.querySelector(sel);
  const val = (x, a) => (typeof x === 'function' ? x(a) : x);
  const byId = (id) => SLIDES.find((s) => s.id === id);

  /* ---------- storage ---------- */
  function readStore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      return s && s.version === CFG.VERSION ? s : null;
    } catch (e) { return null; }
  }
  function writeStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode etc. */ }
  }
  function uuid() {
    return (crypto.randomUUID && crypto.randomUUID()) || 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function fresh() {
    return { version: CFG.VERSION, sessionId: uuid(), startedAt: new Date().toISOString(), answers: {}, timings: {}, order: [], currentId: SLIDES[0].id, complete: false };
  }
  if (params.has('reset')) { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }
  const state = readStore() || fresh();
  if (!byId(state.currentId)) state.currentId = SLIDES[0].id;

  /* ---------- time tracking ---------- */
  // Active time per slide: only counts while the tab is visible.
  const tracker = {
    id: null,
    since: null,
    t(id) {
      return (state.timings[id] ||= { totalMs: 0, visits: 0, firstAnswerMs: null, lastAnswerMs: null, changes: 0 });
    },
    enter(id) {
      this.id = id;
      this.since = document.hidden ? null : performance.now();
      this.t(id).visits++;
      if (!state.order.length || state.order[state.order.length - 1] !== id) state.order.push(id);
    },
    pause() {
      if (this.id && this.since != null) {
        this.t(this.id).totalMs += performance.now() - this.since;
        this.since = null;
      }
    },
    resume() {
      if (this.id && this.since == null && !document.hidden) this.since = performance.now();
    },
    leave() { this.pause(); this.id = null; },
    now(id) {
      const t = this.t(id);
      return t.totalMs + (id === this.id && this.since != null ? performance.now() - this.since : 0);
    },
    // firstAnswerMs: active time before the first answer; changes: times an already-answered field was re-answered
    noteAnswer(id, key, typing) {
      const t = this.t(id);
      const ms = Math.round(this.now(id));
      if (t.firstAnswerMs == null) t.firstAnswerMs = ms;
      t.answered ||= [];
      if (t.answered.includes(key)) { if (!typing) t.changes++; } else t.answered.push(key);
      t.lastAnswerMs = ms;
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { tracker.pause(); writeStore(); beacon(); } else tracker.resume();
  });
  window.addEventListener('pagehide', () => { tracker.pause(); writeStore(); beacon(); });

  /* ---------- submission ---------- */
  function endpoint() {
    if (CFG.ENDPOINT === null) return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? '/api/responses' : '';
    return CFG.ENDPOINT || '';
  }
  function payload() {
    const timings = {};
    Object.keys(state.timings).forEach((id) => {
      const t = state.timings[id];
      timings[id] = { ...t, totalMs: Math.round(tracker.now(id)) };
    });
    return {
      sessionId: state.sessionId,
      version: state.version,
      startedAt: state.startedAt,
      updatedAt: new Date().toISOString(),
      complete: state.complete,
      userAgent: navigator.userAgent,
      viewport: innerWidth + 'x' + innerHeight,
      answers: state.answers,
      order: state.order,
      timings,
    };
  }
  async function send() {
    const url = endpoint();
    if (!url) return 'local';
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload()), keepalive: true });
      return r.ok ? 'ok' : 'error';
    } catch (e) { return 'error'; }
  }
  function beacon() {
    const url = endpoint();
    if (!url || !state.order.length || !navigator.sendBeacon) return;
    navigator.sendBeacon(url, new Blob([JSON.stringify(payload())], { type: 'text/plain;charset=utf-8' }));
  }

  /* ---------- helpers on answers ---------- */
  function visible() { return SLIDES.filter((s) => !s.showIf || s.showIf(state.answers)); }

  function sanitize() {
    const a = state.answers;
    SLIDES.forEach((def) => {
      if (def.showIf && !def.showIf(a)) { delete a[def.id]; return; }
      (def.fields || [{ key: def.id, disabled: def.disabled, options: def.options }]).forEach((f) => {
        if (!f.disabled || a[f.key] == null) return;
        const opt = (f.options || []).find((o) => o.v === a[f.key]);
        if (opt && f.disabled(a, opt)) delete a[f.key];
      });
    });
  }

  function answered(def) {
    const a = state.answers;
    switch (def.type) {
      case 'group': return def.fields.every((f) => a[f.key] != null);
      case 'multi': return (a[def.id] || []).length > 0;
      case 'text': return true;
      case 'intro': case 'outro': return true;
      default: return a[def.id] != null;
    }
  }
  const canAdvance = (def) => def.optional || answered(def);

  /* ---------- building slides ---------- */
  const stage = $('#stage');
  const els = {};

  function optButton(key, o) {
    return `<button type="button" class="opt${o.wide ? ' opt-wide' : ''}" data-key="${key}" data-v="${o.v}" aria-pressed="false">${o.l}</button>`;
  }

  function fieldsHTML(def) {
    switch (def.type) {
      case 'group':
        return def.fields.map((f) => `<div class="field"><p class="label">${f.label}</p><div class="opts" role="group" aria-label="${f.label}">${f.options.map((o) => optButton(f.key, o)).join('')}</div></div>`).join('');
      case 'choice':
      case 'multi':
        return `<div class="field"><p class="label">${def.label}</p><div class="opts" role="group" aria-label="${def.label}">${def.options.map((o) => optButton(def.id, o)).join('')}</div></div>`;
      case 'likert': {
        const nums = Array.from({ length: def.scale }, (_, i) => optButton(def.id, { v: i + 1, l: i + 1 })).join('');
        return `<div class="field"><p class="label">${def.label}</p><div class="opts likert" role="group" aria-label="${def.label}">${nums}</div>
          <div class="likert-ends"><span>${def.ends[0]}</span><span>${def.ends[1]}</span></div></div>`;
      }
      case 'slider':
        return `<div class="field"><p class="label">${def.label}</p>
          <div class="readout"><span class="big" data-readout>${def.start}</span><span class="unit">${def.unit}</span></div>
          <input class="range" type="range" min="${def.min}" max="${def.max}" step="1" value="${def.start}" aria-label="${def.label}" data-slider />
          <div class="range-ends"><span>${def.min}</span><span>${def.max}</span></div></div>`;
      case 'text':
        return `<div class="field"><label class="label" for="t-${def.id}">${def.label}</label>
          <textarea id="t-${def.id}" class="textarea" rows="3" maxlength="${def.maxLength || 500}" placeholder="${def.placeholder || ''}" data-text></textarea></div>`;
      case 'intro':
        return `<div class="field"><button type="button" class="opt opt-cta" data-start>${def.cta || 'Start'}</button></div>`;
      case 'outro':
        return `<div class="field"><button type="button" class="opt" data-retry hidden>Try again</button> <button type="button" class="opt" data-restart>Start over</button></div>`;
      default: return '';
    }
  }

  function buildSlide(def) {
    const el = document.createElement('section');
    el.className = 'slide is-after';
    el.dataset.id = def.id;
    el.setAttribute('aria-label', def.id);
    el.innerHTML = `
      <div class="slide-inner">
        <figure class="art"><div class="art-frame"><div class="art-img"></div><figcaption class="art-tag"></figcaption></div></figure>
        <div class="body">
          <header class="qcard">
            <p class="eyebrow">${def.eyebrow || ''}</p>
            <h1 tabindex="-1">${def.title}</h1>
          </header>
          <p class="hint">${def.hint || ''}</p>
          <div class="fields">${fieldsHTML(def)}</div>
          <div class="insight" aria-live="polite"></div>
        </div>
      </div>`;
    stage.appendChild(el);
    els[def.id] = el;
    return el;
  }
  SLIDES.forEach(buildSlide);

  // "Question {n}" / "Questions {n} and {n+1}" numbered by position among the slides currently shown
  function eyebrowFor(def) {
    let n = 1;
    for (const s of visible()) {
      if (s === def) break;
      if (s.type === 'intro' || s.type === 'outro') continue;
      n += s.type === 'group' ? s.fields.length : 1;
    }
    return (def.eyebrow || '').replace('{n+1}', n + 1).replace('{n}', n);
  }

  /* ---------- refreshing a slide from state ---------- */
  const cache = {};
  function refresh(def) {
    const el = els[def.id];
    const a = state.answers;
    const c = (cache[def.id] ||= {});

    $('.eyebrow', el).textContent = eyebrowFor(def);

    // art + tag
    const art = window.Illustration.render(def, a);
    if (c.art !== art) { $('.art-img', el).innerHTML = art; c.art = art; }
    const tag = val(def.tag, a) || '';
    if (c.tag !== tag) { $('.art-tag', el).textContent = tag; $('.art-tag', el).hidden = !tag; c.tag = tag; }

    // option states
    const fields = def.fields || [{ key: def.id, disabled: def.disabled, options: def.options }];
    fields.forEach((f) => {
      el.querySelectorAll(`.opt[data-key="${f.key}"]`).forEach((b) => {
        const o = { v: b.dataset.v };
        const cur = a[f.key];
        const on = Array.isArray(cur) ? cur.includes(b.dataset.v) : cur != null && String(cur) === b.dataset.v;
        b.setAttribute('aria-pressed', on);
        b.disabled = !!(f.disabled && f.disabled(a, o));
      });
    });

    // slider / text
    const sl = $('[data-slider]', el);
    if (sl) {
      const v = a[def.id] != null ? a[def.id] : def.start;
      sl.value = v;
      $('[data-readout]', el).textContent = v;
      sl.style.setProperty('--pct', ((v - def.min) / (def.max - def.min)) * 100 + '%');
      el.classList.toggle('untouched', a[def.id] == null);
    }
    const tx = $('[data-text]', el);
    if (tx && document.activeElement !== tx) tx.value = a[def.id] || '';

    // insight
    const ins = def.insight ? def.insight(a) : null;
    const box = $('.insight', el);
    const key = ins ? ins.html + '|' + (ins.sub || '') : '';
    if (c.insight !== key) {
      c.insight = key;
      if (ins) {
        box.innerHTML = `<p>${ins.html}</p>${ins.sub ? `<p class="sub">${ins.sub}</p>` : ''}`;
        box.classList.add('show');
        box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
      } else {
        box.classList.remove('show', 'bump');
        box.innerHTML = '';
      }
    }
  }
  const refreshAll = () => SLIDES.forEach(refresh);

  /* ---------- navigation ---------- */
  const navBack = $('#nav-back');
  const navNext = $('#nav-next');
  const dots = $('#dots');
  const navMsg = $('#nav-msg');
  const count = $('#count');

  function renderNav() {
    const vis = visible();
    const i = vis.findIndex((s) => s.id === state.currentId);
    const def = byId(state.currentId);
    dots.innerHTML = vis.map((s, k) => `<span class="dot${k < i ? ' done' : ''}${k === i ? ' now' : ''}"></span>`).join('');
    count.textContent = `${i + 1} of ${vis.length}`;
    navBack.disabled = i <= 0;
    const next = vis[i + 1];
    navNext.hidden = !next;
    navNext.textContent = !next ? '' : next.type === 'outro' ? 'Finish' : def.type === 'intro' ? 'Start' : 'Next';
    navNext.classList.toggle('ready', !!next && canAdvance(def) && def.type !== 'intro' && def.type !== 'outro');
    $('.nav').classList.toggle('on-outro', def.type === 'outro');
  }

  function place(id) {
    const idx = SLIDES.findIndex((s) => s.id === id);
    SLIDES.forEach((s, i) => {
      const el = els[s.id];
      el.classList.toggle('is-active', i === idx);
      el.classList.toggle('is-before', i < idx);
      el.classList.toggle('is-after', i > idx);
      el.inert = i !== idx;
      el.setAttribute('aria-hidden', String(i !== idx));
    });
  }

  let msgTimer;
  function nudge(text) {
    navMsg.textContent = text;
    navMsg.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => navMsg.classList.remove('show'), 2200);
    const f = $('.fields', els[state.currentId]);
    f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  }

  function go(dir) {
    const vis = visible();
    const i = vis.findIndex((s) => s.id === state.currentId);
    const def = byId(state.currentId);
    const target = vis[i + dir];
    if (!target) return;
    if (dir > 0 && !canAdvance(def)) { nudge('Pick an answer to continue.'); return; }
    arrive(target.id);
  }

  function arrive(id, instant) {
    tracker.leave();
    state.currentId = id;
    tracker.enter(id);
    const def = byId(id);
    if (def.type === 'outro') { state.complete = true; finish(); }
    else if (state.complete && def.type !== 'outro') { state.complete = false; }
    sanitize();
    refreshAll();
    place(id);
    renderNav();
    writeStore();
    if (!instant) {
      const h = $('h1', els[id]);
      setTimeout(() => h && h.focus({ preventScroll: true }), 350);
      if (def.type !== 'outro') send();
    }
  }

  async function finish() {
    const el = els.outro;
    const hint = $('.hint', el);
    const retry = $('[data-retry]', el);
    retry.hidden = true;
    hint.textContent = 'Saving your answers…';
    const r = await send();
    hint.textContent = r === 'ok' ? 'Your answers have been recorded. Thank you for taking part.'
      : r === 'local' ? 'Thanks. Your answers are saved in this browser only, because no server is set up yet.'
      : 'Could not reach the server. Your answers are kept in this browser.';
    retry.hidden = r !== 'error';
  }

  /* ---------- answering ---------- */
  function setAnswer(def, key, value, typing) {
    const a = state.answers;
    const had = a[key] != null;
    if (value === undefined) delete a[key]; else a[key] = value;
    sanitize();
    tracker.noteAnswer(def.id, key, typing);
    refreshAll();
    renderNav();
    writeStore();
    return had;
  }

  stage.addEventListener('click', (e) => {
    const slideEl = e.target.closest('.slide');
    if (!slideEl) return;
    const def = byId(slideEl.dataset.id);

    if (e.target.closest('[data-start]')) { go(1); return; }
    if (e.target.closest('[data-restart]')) { try { localStorage.removeItem(STORE_KEY); } catch (err) {} location.href = location.pathname; return; }
    if (e.target.closest('[data-retry]')) { finish(); return; }

    const b = e.target.closest('.opt[data-key]');
    if (!b || b.disabled) return;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');

    const key = b.dataset.key;
    if (def.type === 'multi') {
      let cur = (state.answers[key] || []).slice();
      if (cur.includes(b.dataset.v)) cur = cur.filter((v) => v !== b.dataset.v);
      else { cur.push(b.dataset.v); if (cur.length > def.max) cur.shift(); }
      setAnswer(def, key, cur.length ? cur : undefined);
    } else {
      const v = def.type === 'likert' ? Number(b.dataset.v) : b.dataset.v;
      if (state.answers[key] === v) return;
      setAnswer(def, key, v);
    }
  });
  stage.addEventListener('animationend', (e) => { if (e.target.classList) e.target.classList.remove('pop'); });

  stage.addEventListener('input', (e) => {
    const slideEl = e.target.closest('.slide');
    if (!slideEl) return;
    const def = byId(slideEl.dataset.id);
    // sliders and text fire many events; a "change" is counted once per committed value instead
    if (e.target.matches('[data-slider]')) setAnswer(def, def.id, Number(e.target.value), true);
    if (e.target.matches('[data-text]')) setAnswer(def, def.id, e.target.value, true);
  });
  stage.addEventListener('change', (e) => {
    if (!e.target.matches('[data-slider]')) return;
    const t = tracker.t(e.target.closest('.slide').dataset.id);
    t.commits = (t.commits || 0) + 1;
    if (t.commits > 1) t.changes++;
  });
  // tapping the slider without moving still counts as an answer
  stage.addEventListener('pointerdown', (e) => {
    if (!e.target.matches('[data-slider]')) return;
    const def = byId(e.target.closest('.slide').dataset.id);
    if (state.answers[def.id] == null) setAnswer(def, def.id, Number(e.target.value), true);
  });
  // after a mouse/touch drag, hand the arrow keys back to the slideshow
  const dropFocus = (e) => { if (e.target.matches('[data-slider]')) e.target.blur(); };
  stage.addEventListener('pointerup', dropFocus);
  stage.addEventListener('pointercancel', dropFocus);

  navNext.addEventListener('click', () => go(1));
  navBack.addEventListener('click', () => go(-1));

  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    const inField = t.matches && t.matches('textarea, input[type="range"], input[type="text"]');
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
      if (inField && e.key.startsWith('Arrow')) return;
      e.preventDefault(); go(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      if (inField && e.key.startsWith('Arrow')) return;
      e.preventDefault(); go(-1);
    } else if (e.key === 'Enter' && !(t.matches && t.matches('button, textarea, a'))) {
      e.preventDefault(); go(1);
    }
  });

  /* ---------- debug overlay (?debug) ---------- */
  if (params.has('debug')) {
    const box = $('#debug');
    box.hidden = false;
    setInterval(() => {
      box.textContent = SLIDES.filter((s) => state.timings[s.id]).map((s) => {
        const t = state.timings[s.id];
        return `${s.id.padEnd(13)} ${(tracker.now(s.id) / 1000).toFixed(1).padStart(6)}s  v${t.visits}  first ${t.firstAnswerMs == null ? '-' : (t.firstAnswerMs / 1000).toFixed(1) + 's'}  chg ${t.changes}`;
      }).join('\n');
    }, 300);
  }
  window.__survey = { state, payload };

  /* ---------- start ---------- */
  stage.classList.add('no-anim');
  sanitize();
  tracker.enter(state.currentId);
  refreshAll();
  place(state.currentId);
  renderNav();
  writeStore();
  if (state.currentId === 'outro') finish();
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('no-anim')));
})();
