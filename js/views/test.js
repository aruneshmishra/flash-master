import { h, icon, modal, formatTime, isTyping } from '../lib/dom.js';
import { buildTest, gradeTest, missedCards, TYPE_LABEL, TYPE_ORDER } from '../lib/test-builder.js';
import { confetti } from '../lib/confetti.js';
import { studyHeader, segmented, toggle, activeCards } from './shell.js';
import { hintLink } from './review.js';
import { logStudy } from './streak.js';

const LETTERS = 'ABCDEFGH';

export function renderTest(ctx) {
  const { root, deck, progress, save, signal } = ctx;
  progress.prefs = progress.prefs || {};
  const prefs = (progress.prefs.test = { count: Math.min(20, deck.cards.length), answerWith: 'definition', types: ['tf', 'mc', 'match', 'written'], starredOnly: false, ...progress.prefs.test });
  prefs.count = Math.max(1, Math.min(prefs.count, deck.cards.length));

  const page = h('div', { class: 'page study-page test-page' });
  const body = h('div', { class: 'test-body' });
  page.append(studyHeader(deck, 'test'), body);
  root.append(page);

  let timer = null;
  signal.addEventListener('abort', () => clearInterval(timer));

  /* ---------- setup ---------- */
  function setup() {
    clearInterval(timer);
    const pool = activeCards(deck, progress, prefs.starredOnly);
    const max = pool.length;
    prefs.count = Math.max(1, Math.min(prefs.count, max));
    const countNum = h('input', { type: 'number', class: 'input input-sm count-num', id: 'test-count', min: 1, max, value: prefs.count, 'aria-label': 'Number of questions' });
    const countRange = h('input', { type: 'range', class: 'range', min: 1, max, value: prefs.count, 'aria-label': 'Number of questions slider' });
    const syncCount = (v) => { const n = Math.max(1, Math.min(max, Number(v) || 1)); prefs.count = n; countNum.value = n; countRange.value = n; };
    countNum.addEventListener('change', (e) => syncCount(e.target.value));
    countRange.addEventListener('input', (e) => syncCount(e.target.value));

    const typeErr = h('p', { class: 'form-status error', role: 'alert' });
    const startBtn = h('button', { class: 'btn btn-primary btn-lg', id: 'start-test', onclick: () => {
      if (!prefs.types.length) { typeErr.textContent = 'Pick at least one question type.'; return; }
      save();
      begin(buildTest({ cards: pool, count: prefs.count, types: prefs.types, answerWith: prefs.answerWith }));
    } }, 'Start test', icon('right', { size: 18 }));

    body.replaceChildren(h('div', { class: 'panel test-setup', id: 'test-setup' },
      h('div', { class: 'setup-head' },
        h('div', null, h('h2', null, 'Set up your practice test'), h('p', { class: 'muted' }, 'Test yourself the way a real exam would.')),
        progress.best?.test != null ? h('div', { class: 'best-badge' }, icon('trophy', { size: 18 }), `Best: ${progress.best.test}%`) : null),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, `Questions (max ${max})`), h('div', { class: 'count-row' }, countRange, countNum)),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Answer with'),
          segmented('Answer with', [['definition', 'Definition'], ['term', 'Term'], ['both', 'Both']], prefs.answerWith, (v) => { prefs.answerWith = v; })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Question types'),
          h('div', { class: 'type-grid' }, TYPE_ORDER.map((t) => toggle(TYPE_LABEL[t], prefs.types.includes(t), (on) => {
            prefs.types = on ? [...new Set([...prefs.types, t])] : prefs.types.filter((x) => x !== t);
            typeErr.textContent = '';
          })))),
        progress.stars.length ? toggle('Starred terms only', prefs.starredOnly, (v) => { prefs.starredOnly = v; save(); setup(); }, `${progress.stars.length} starred`) : null,
        typeErr),
      h('div', { class: 'setup-actions' }, startBtn)));
  }

  /* ---------- taking the test ---------- */
  function begin(test, { retake = false } = {}) {
    const answers = new Array(test.questions.length).fill(undefined);
    const started = Date.now();
    let number = 0;
    const answeredEl = h('span', { id: 'answered-count' }, '0');
    const timeEl = h('span', { class: 'test-time' }, '0.0s');
    const bar = h('span', { class: 'test-bar-fill' });
    const total = test.total;

    const isAnswered = (q, a) => (q.kind === 'match' ? Array.isArray(a) && a.filter(Boolean).length === q.items.length : q.kind === 'written' ? !!(a && a.trim()) : a !== undefined && a !== null);
    const countAnswered = () => test.questions.reduce((s, q, i) => s + (q.kind === 'match' ? (answers[i] || []).filter(Boolean).length : isAnswered(q, answers[i]) ? 1 : 0), 0);
    const els = [];
    const refresh = () => {
      const n = countAnswered();
      answeredEl.textContent = String(n);
      bar.style.width = `${(n / total) * 100}%`;
      test.questions.forEach((q, i) => els[i]?.classList.toggle("done", isAnswered(q, answers[i])));
    };

    const goNext = (el) => {
      const all = [...body.querySelectorAll('.test-q')];
      const nextEl = all[all.indexOf(el) + 1];
      if (nextEl) setTimeout(() => nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220);
    };

    const sections = [];
    let lastKind = null;
    test.questions.forEach((q, qi) => {
      if (q.kind !== lastKind) { sections.push(h('h3', { class: 'test-section' }, TYPE_LABEL[q.kind])); lastKind = q.kind; }
      const label = q.promptSide === 'term' ? 'Term' : 'Definition';
      if (q.kind === 'tf') {
        number++;
        const el = qCard(number, total, q.kind);
        els[qi] = el;
        const btns = [true, false].map((v) => h('button', { type: 'button', class: 'choice tf', 'data-value': String(v), 'aria-pressed': 'false', onclick: (e) => {
          answers[qi] = v;
          btns.forEach((b) => { b.classList.toggle('selected', b === e.currentTarget); b.setAttribute('aria-pressed', String(b === e.currentTarget)); });
          refresh(); goNext(el);
        } }, v ? 'True' : 'False'));
        el.append(
          h('div', { class: 'tf-pair' },
            h('div', null, h('span', { class: 'face-label' }, label), h('p', { class: 'tq-text' }, q.prompt)),
            h('div', null, h('span', { class: 'face-label' }, q.answerSide === 'term' ? 'Term' : 'Definition'), h('p', { class: 'tq-text' }, q.shown))),
          h('div', { class: 'choices two' }, btns));
        sections.push(el);
      } else if (q.kind === 'mc') {
        number++;
        const el = qCard(number, total, q.kind);
        els[qi] = el;
        const btns = q.choices.map((c) => h('button', { type: 'button', class: 'choice', 'aria-pressed': 'false', onclick: (e) => {
          answers[qi] = c;
          btns.forEach((b) => { b.classList.toggle('selected', b === e.currentTarget); b.setAttribute('aria-pressed', String(b === e.currentTarget)); });
          refresh(); goNext(el);
        } }, h('span', { class: 'choice-text' }, c)));
        el.append(h('span', { class: 'face-label' }, label), h('p', { class: 'tq-text' }, q.prompt), h('div', { class: 'choices' }, btns));
        sections.push(el);
      } else if (q.kind === 'match') {
        const first = number + 1;
        number += q.items.length;
        const el = qCard(first === number ? `${first}` : `${first}–${number}`, total, q.kind);
        els[qi] = el;
        answers[qi] = new Array(q.items.length).fill(null);
        const selects = q.items.map((item, j) => h('select', { class: 'input match-select', 'aria-label': `Match for ${item.prompt}`, onchange: (e) => {
          answers[qi][j] = e.target.value || null;
          refresh();
        } }, h('option', { value: '' }, 'Choose…'), q.options.map((o, k) => h('option', { value: o }, `${LETTERS[k]}. ${truncate(o, 70)}`))));
        el.append(
          h('p', { class: 'q-instruction' }, `Match each ${q.items[0].promptSide} with its ${q.items[0].answerSide}.`),
          h('div', { class: 'match-test' },
            h('ol', { class: 'match-prompts' }, q.items.map((item, j) => h('li', null, h('p', { class: 'tq-text sm' }, item.prompt), selects[j]))),
            h('ol', { class: 'match-options', type: 'A' }, q.options.map((o, k) => h('li', null, h('b', null, `${LETTERS[k]}.`), ' ', o)))));
        sections.push(el);
      } else {
        number++;
        const el = qCard(number, total, q.kind);
        els[qi] = el;
        const input = h('input', { class: 'input written-input', type: 'text', autocomplete: 'off', spellcheck: false, placeholder: `Type the ${q.answerSide}`, 'aria-label': `Answer for ${q.prompt}`,
          oninput: (e) => { answers[qi] = e.target.value; refresh(); },
          onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); const all = [...body.querySelectorAll('.written-input')]; const nx = all[all.indexOf(e.target) + 1]; if (nx) nx.focus(); else body.querySelector('#submit-test')?.focus(); } } });
        el.append(h('span', { class: 'face-label' }, label), h('p', { class: 'tq-text' }, q.prompt), input, hintLink(q.card));
        sections.push(el);
      }
    });

    const submitBtn = h('button', { class: 'btn btn-primary btn-lg', id: 'submit-test', onclick: submit }, 'Submit test');
    body.replaceChildren(
      h('div', { class: 'test-sticky' },
        h('div', { class: 'test-sticky-row' },
          h('span', null, answeredEl, ` / ${total} answered`),
          h('span', { class: 'muted' }, retake ? 'Retake · ' : '', timeEl)),
        h('div', { class: 'test-bar' }, bar)),
      h('div', { class: 'test-sheet' }, sections),
      h('div', { class: 'submit-row' }, h('p', { class: 'muted' }, 'All done? Submit to see your score.'), submitBtn));
    window.scrollTo({ top: 0 });
    clearInterval(timer);
    timer = setInterval(() => { timeEl.textContent = formatTime(Date.now() - started); }, 100);

    async function submit() {
      const left = total - countAnswered();
      if (left > 0) {
        const ok = await modal({
          title: `You skipped ${left} question${left === 1 ? '' : 's'}`,
          body: h('p', null, 'Skipped questions are marked wrong. Submit anyway?'),
          buttons: [{ label: 'Keep working', value: false }, { label: 'Submit', value: true, variant: 'primary' }],
        });
        if (!ok) { body.querySelector('.test-q:not(.done)')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      }
      clearInterval(timer);
      results(test, answers, Date.now() - started);
    }
  }

  function qCard(num, total, kind) {
    return h('section', { class: 'panel test-q', 'data-kind': kind }, h('div', { class: 'tq-num muted small' }, `${num} of ${total}`));
  }

  /* ---------- results ---------- */
  function results(test, answers, elapsed) {
    const g = gradeTest(test, answers);
    logStudy(g.results.reduce((n, r, i) => n + (r.kind === 'match' ? r.items.filter((x) => x.given).length : (r.given !== null && r.given !== undefined && r.given !== '') ? 1 : 0), 0));
    const prevBest = progress.best?.test;
    progress.best = { ...progress.best, test: Math.max(prevBest ?? 0, g.percent) };
    save();
    if (g.percent >= 80) confetti();
    const missed = missedCards(test, g);
    const mood = g.percent === 100 ? ['🏆', 'Perfect score!'] : g.percent >= 80 ? ['🎉', "Great job! You're ready."] : g.percent >= 60 ? ['👍', "Good work. You're getting there."] : g.percent >= 40 ? ['🌱', 'Nice effort, keep practising.'] : ['💪', 'Every expert started here. Try Learn mode!'];
    const encId = encodeURIComponent(deck.id);

    const review = [];
    let n = 0;
    test.questions.forEach((q, i) => {
      const r = g.results[i];
      if (q.kind === 'match') {
        q.items.forEach((item, j) => { n++; review.push(reviewRow(n, item.prompt, r.items[j].given, item.answer, r.items[j].correct)); });
      } else if (q.kind === 'tf') {
        n++;
        review.push(reviewRow(n, `${q.prompt}  →  ${q.shown}`, r.given == null ? null : r.given ? 'True' : 'False', q.isTrue ? 'True' : `False (it's "${q.answer}")`, r.correct));
      } else {
        n++;
        review.push(reviewRow(n, q.prompt, r.given, q.answer, r.correct, r.close));
      }
    });

    body.replaceChildren(
      h('div', { class: 'panel results', id: 'test-results' },
        h('div', { class: 'results-top' },
          h('div', { class: 'score-ring', style: { '--pct': g.percent }, role: 'img', 'aria-label': `Score ${g.percent} percent` },
            h('span', { class: 'score-pct', id: 'score-pct' }, `${g.percent}%`)),
          h('div', { class: 'results-text' },
            h('div', { class: 'finish-emoji sm', 'aria-hidden': 'true' }, mood[0]),
            h('h2', null, mood[1]),
            h('p', { class: 'results-line' }, h('b', { class: 'ok' }, `${g.score} correct`), ' · ', h('b', { class: 'bad' }, `${g.total - g.score} incorrect`), ' · ', `${formatTime(elapsed)}`),
            prevBest != null && g.percent > prevBest ? h('p', { class: 'new-best' }, icon('trophy', { size: 16 }), ` New personal best! (was ${prevBest}%)`) : null)),
        h('div', { class: 'finish-actions' },
          missed.length ? h('button', { class: 'btn btn-primary', id: 'retake-missed', onclick: () => begin(buildTest({ cards: missed, count: missed.length, types: prefs.types, answerWith: prefs.answerWith }), { retake: true }) }, `Retake ${missed.length} missed`) : null,
          h('button', { class: `btn ${missed.length ? 'btn-ghost' : 'btn-primary'}`, id: 'new-test', onclick: () => begin(buildTest({ cards: activeCards(deck, progress, prefs.starredOnly), count: prefs.count, types: prefs.types, answerWith: prefs.answerWith })) }, icon('refresh', { size: 18 }), 'New test'),
          h('button', { class: 'btn btn-ghost', onclick: setup }, icon('gear', { size: 18 }), 'Change settings'),
          missed.length ? h('a', { class: 'btn btn-ghost', href: `#/deck/${encId}/learn` }, icon('learn', { size: 18 }), 'Practise in Learn') : null)),
      h('h3', { class: 'test-section' }, 'Review your answers'),
      h('ol', { class: 'review-list', id: 'review-list' }, review));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reviewRow(n, prompt, given, correct, ok, close) {
    return h('li', { class: `review-item ${ok ? 'ok' : 'bad'}` },
      h('span', { class: 'review-mark', 'aria-label': ok ? 'Correct' : 'Incorrect' }, icon(ok ? 'check' : 'x', { size: 16 })),
      h('div', { class: 'review-body' },
        h('p', { class: 'review-q' }, h('span', { class: 'muted' }, `${n}. `), prompt),
        ok ? h('p', { class: 'review-a ok' }, given ?? correct, close ? h('span', { class: 'muted' }, `  (spelled "${correct}")`) : null)
          : h('div', null,
            h('p', { class: 'review-a bad' }, h('span', { class: 'muted' }, 'Your answer: '), given == null || given === '' ? h('i', null, 'Skipped') : String(given)),
            h('p', { class: 'review-a ok' }, h('span', { class: 'muted' }, 'Correct: '), correct))));
  }

  document.addEventListener('keydown', (e) => {
    if (isTyping(e) || document.querySelector('dialog[open]')) return;
    if (e.key === 'Enter' && body.querySelector('#test-setup') && e.target === document.body) body.querySelector('#start-test')?.click();
  }, { signal });

  setup();
}

function truncate(s, n) { return s.length > n ? `${s.slice(0, n - 1)}…` : s; }
