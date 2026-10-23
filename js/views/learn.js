import { h, icon, isTyping, announce, modal, toast } from '../lib/dom.js';
import { LearnSession, summarize } from '../lib/learn-engine.js';
import { gradeWritten } from '../lib/grade.js';
import { speak, canSpeak, stopSpeaking } from '../lib/speech.js';
import { confetti } from '../lib/confetti.js';
import { pick } from '../lib/random.js';
import { studyHeader, segmented, toggle, masteryBar, activeCards } from './shell.js';
import { sizeClass } from './flashcards.js';

const PRAISE = ['Nice!', 'Great job!', 'You got it!', 'Correct!', 'Awesome!', 'Nailed it!', 'Perfect!', 'Way to go!'];
const STREAK = { 3: 'Three in a row! 🔥', 5: 'Five in a row, on fire! 🔥', 10: 'Ten in a row! Unstoppable 🚀', 20: 'Twenty streak! Legend 🏆' };
const ENCOURAGE = ['No worries, you will see this one again.', "Not quite. You've got this next time!", 'Almost there. Mistakes help you learn!', "Keep going. That's how memory works!"];

export function renderLearn(ctx) {
  const { root, deck, progress, save, signal } = ctx;
  progress.prefs = progress.prefs || {};
  const prefs = (progress.prefs.learn = { answerWith: 'definition', mc: true, written: true, shuffle: false, starredOnly: false, ...progress.prefs.learn });

  const page = h('div', { class: 'page study-page learn-page' });
  const body = h('div', { class: 'learn-body' });
  page.append(studyHeader(deck, 'learn'), body);
  root.append(page);

  let session;
  let onKey = null; // per-screen keyboard handler
  let advanceTimer = null;

  function newSession() {
    session = new LearnSession({ cards: activeCards(deck, progress, prefs.starredOnly), progress: progress.learn, options: prefs });
  }

  function topBar() {
    const counts = summarize(session.cards, progress.learn);
    return h('div', { class: 'learn-top' },
      h('div', { class: 'learn-top-row' },
        h('span', { class: 'round-label' }, session.round ? `Round ${session.round}` : 'Learn'),
        session.streak >= 2 ? h('span', { class: 'streak', title: 'Correct in a row' }, icon('flame', { size: 16 }), String(session.streak)) : null,
        h('button', { class: 'icon-btn', id: 'learn-settings', 'aria-label': 'Learn options', title: 'Options', onclick: options }, icon('gear', { size: 20 }))),
      masteryBar(counts));
  }

  function start() {
    newSession();
    if (session.isDone()) return allDone(false);
    session.startRound();
    ask();
  }

  function screen(...children) {
    clearTimeout(advanceTimer);
    onKey = null;
    body.replaceChildren(topBar(), ...children);
  }

  function promptBlock(q) {
    const lang = deck.lang?.[q.promptSide];
    const showImg = q.card.image && q.promptSide === 'definition';
    return h('div', { class: 'q-prompt' },
      h('div', { class: 'q-prompt-top' },
        h('span', { class: 'face-label' }, q.promptSide === 'term' ? 'Term' : 'Definition'),
        canSpeak() ? h('button', { class: 'icon-btn', 'aria-label': 'Read aloud', onclick: () => speak(q.prompt, lang) }, icon('sound', { size: 20 })) : null),
      showImg ? h('img', { class: 'q-img', src: q.card.image, alt: '', referrerpolicy: 'no-referrer' }) : null,
      h('p', { class: `q-text ${sizeClass(q.prompt)}`, id: 'q-text' }, q.prompt));
  }

  function ask() {
    const q = session.next();
    if (!q) return roundDone();
    if (q.type === 'mc') return askMC(q);
    if (q.type === 'written') return askWritten(q);
    return askReveal(q);
  }

  /* ---------- multiple choice ---------- */
  function askMC(q) {
    const feedback = h('div', { class: 'q-feedback', 'aria-live': 'polite' });
    let answered = false;
    const buttons = q.choices.map((choice, i) => h('button', {
      class: 'choice', type: 'button', 'data-choice': String(i),
      onclick: () => choose(i),
    }, h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'choice-text' }, choice)));

    function choose(i) {
      if (answered) return;
      answered = true;
      const correct = q.choices[i] === q.answer;
      buttons.forEach((b, j) => {
        b.disabled = true;
        if (q.choices[j] === q.answer) b.classList.add('correct');
        else if (j === i) b.classList.add('wrong');
      });
      const r = session.answer(correct);
      save();
      afterAnswer(feedback, r, q);
    }

    screen(h('div', { class: 'q-card panel', 'data-type': 'mc' },
      promptBlock(q),
      h('p', { class: 'q-instruction' }, `Choose the matching ${q.answerSide}`),
      h('div', { class: 'choices' }, buttons),
      feedback));
    onKey = (e) => {
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= buttons.length) { e.preventDefault(); choose(n - 1); }
    };
  }

  /* ---------- typed answer ---------- */
  function askWritten(q) {
    const feedback = h('div', { class: 'q-feedback', 'aria-live': 'polite' });
    const input = h('input', {
      class: 'input input-lg answer-input', id: 'answer-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
      placeholder: `Type the ${q.answerSide}`, 'aria-label': `Type the ${q.answerSide}`,
    });
    const submitBtn = h('button', { class: 'btn btn-primary', type: 'submit', id: 'answer-submit' }, 'Answer');
    const dontKnow = h('button', { class: 'link-btn', type: 'button', id: 'dont-know', onclick: () => grade(true) }, "Don't know?");
    let answered = false;
    const form = h('form', { class: 'written-form', onsubmit: (e) => { e.preventDefault(); grade(false); } }, input, submitBtn);

    function grade(gaveUp) {
      if (answered) return;
      const g = gaveUp ? { correct: false, close: false, empty: true } : gradeWritten(input.value, q.answer);
      if (g.empty && !gaveUp) { input.focus(); input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); return; }
      answered = true;
      input.disabled = true;
      submitBtn.remove();
      dontKnow.remove();
      const r = session.answer(g.correct);
      save();
      if (!g.correct) {
        form.after(h('div', { class: 'compare' },
          !gaveUp ? h('div', { class: 'compare-row yours' }, h('span', { class: 'compare-label' }, 'You said'), h('span', { class: 'compare-val' }, input.value)) : null,
          h('div', { class: 'compare-row right' }, h('span', { class: 'compare-label' }, 'Correct answer'), h('span', { class: 'compare-val', id: 'correct-answer' }, q.answer))));
      } else if (g.close) {
        form.after(h('div', { class: 'compare' }, h('div', { class: 'compare-row right' }, h('span', { class: 'compare-label' }, 'Watch the spelling'), h('span', { class: 'compare-val' }, q.answer))));
      }
      input.classList.add(g.correct ? 'is-correct' : 'is-wrong');
      afterAnswer(feedback, r, q, { allowOverride: !g.correct && !gaveUp, close: g.close });
    }

    screen(h('div', { class: 'q-card panel', 'data-type': 'written' },
      promptBlock(q),
      h('p', { class: 'q-instruction' }, `Type the ${q.answerSide}`),
      form,
      h('div', { class: 'written-extra' }, dontKnow),
      feedback));
    setTimeout(() => input.focus(), 30);
  }

  /* ---------- self check (long answers) ---------- */
  function askReveal(q) {
    const feedback = h('div', { class: 'q-feedback', 'aria-live': 'polite' });
    const area = h('div', { class: 'reveal-area' });
    let stage = 'think';
    const reveal = () => {
      if (stage !== 'think') return;
      stage = 'judge';
      area.replaceChildren(
        h('div', { class: 'reveal-answer' }, h('span', { class: 'face-label' }, q.answerSide === 'term' ? 'Term' : 'Definition'), h('p', { id: 'revealed-answer' }, q.answer)),
        h('p', { class: 'q-instruction' }, 'Did you get it right?'),
        h('div', { class: 'judge' },
          h('button', { class: 'btn btn-ghost judge-no', id: 'judge-no', onclick: () => judge(false) }, icon('x', { size: 18 }), 'Not yet'),
          h('button', { class: 'btn btn-success judge-yes', id: 'judge-yes', onclick: () => judge(true) }, icon('check', { size: 18 }), 'I got it')));
    };
    const judge = (ok) => {
      if (stage !== 'judge') return;
      stage = 'done';
      area.querySelector('.judge').remove();
      const r = session.answer(ok);
      save();
      afterAnswer(feedback, r, q);
    };
    area.append(
      h('p', { class: 'q-instruction' }, `Say or think the ${q.answerSide}, then reveal it.`),
      h('button', { class: 'btn btn-primary', id: 'reveal-btn', onclick: reveal }, 'Reveal answer'));
    screen(h('div', { class: 'q-card panel', 'data-type': 'reveal' }, promptBlock(q), area, feedback));
    onKey = (e) => {
      if (stage === 'think' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
      else if (stage === 'judge' && (e.key === '1' || e.key === 'ArrowLeft')) judge(false);
      else if (stage === 'judge' && (e.key === '2' || e.key === 'ArrowRight')) judge(true);
    };
  }

  /* ---------- shared feedback ---------- */
  function afterAnswer(feedback, r, q, { allowOverride = false, close = false } = {}) {
    const card = feedback.closest('.q-card');
    card.classList.add(r.correct ? 'answered-right' : 'answered-wrong');
    const streakMsg = r.correct && STREAK[session.streak];
    const msg = r.correct ? (streakMsg || (close ? 'Correct! Just a small typo.' : pick(PRAISE))) : pick(ENCOURAGE);
    const levelUp = r.correct && r.after === 2 ? h('span', { class: 'chip chip-mastered' }, 'Mastered ✓') : null;
    const continueBtn = h('button', { class: 'btn btn-primary', id: 'continue-btn', onclick: () => ask() }, 'Continue', icon('right', { size: 18 }));
    const overrideBtn = allowOverride ? h('button', {
      class: 'link-btn', id: 'override-btn',
      onclick: () => {
        session.override();
        save();
        card.classList.replace('answered-wrong', 'answered-right');
        feedback.querySelector('.fb-msg').textContent = "Okay, we'll count that as correct.";
        overrideBtn.remove();
      },
    }, 'Override: I was right') : null;

    feedback.replaceChildren(
      h('div', { class: `fb ${r.correct ? 'fb-right' : 'fb-wrong'}` },
        h('span', { class: 'fb-icon', 'aria-hidden': 'true' }, icon(r.correct ? 'check' : 'x', { size: 18 })),
        h('span', { class: 'fb-msg' }, msg), levelUp),
      h('div', { class: 'fb-actions' }, overrideBtn, continueBtn));
    announce(r.correct ? msg : `Incorrect. The answer is ${q.answer}`);
    body.querySelector('.learn-top')?.replaceWith(topBar());

    // Correct multiple-choice answers move on automatically to keep the flow going.
    if (r.correct && q.type === 'mc') advanceTimer = setTimeout(() => ask(), 1000);
    else setTimeout(() => continueBtn.focus(), 30);
    onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); clearTimeout(advanceTimer); ask(); }
      else if (allowOverride && e.key.toLowerCase() === 'o' && overrideBtn?.isConnected) overrideBtn.click();
    };
  }

  /* ---------- rounds ---------- */
  function roundDone() {
    if (session.isDone()) return allDone(true);
    const rows = session.roundSummary();
    const counts = session.counts();
    const pct = Math.round((counts.mastered / counts.total) * 100);
    screen(h('div', { class: 'panel round-done', id: 'round-done' },
      h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, pct >= 75 ? '🚀' : pct >= 40 ? '⭐' : '🌱'),
      h('h2', null, `Round ${session.round} complete!`),
      h('p', { class: 'muted' }, `You've mastered ${counts.mastered} of ${counts.total} terms (${pct}%). ${pct >= 50 ? "You're more than halfway!" : 'Keep it up!'}`),
      h('ul', { class: 'round-list' }, rows.map(({ card, status, missed }) => h('li', { class: 'round-item' },
        h('span', { class: 'round-term' }, card.term),
        h('span', { class: 'round-def muted' }, card.definition),
        h('span', { class: `chip ${status === 'mastered' ? 'chip-mastered' : 'chip-learning'}` }, status === 'mastered' ? 'Mastered' : missed ? 'Missed' : 'Familiar')))),
      h('button', { class: 'btn btn-primary btn-lg', id: 'next-round-btn', onclick: () => { session.startRound(); ask(); } }, `Continue to round ${session.round + 1}`, icon('right', { size: 18 }))));
    setTimeout(() => body.querySelector('#next-round-btn')?.focus(), 30);
    onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); session.startRound(); ask(); } };
  }

  function allDone(justFinished) {
    if (justFinished) confetti();
    const encId = encodeURIComponent(deck.id);
    screen(h('div', { class: 'panel finish', id: 'learn-done' },
      h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, '🏆'),
      h('h2', null, justFinished ? 'You did it!' : 'Everything is mastered'),
      h('p', { class: 'muted' }, `You've mastered all ${session.cards.length} terms${session.bestStreak > 2 ? `, with a best streak of ${session.bestStreak}` : ''}. Time to prove it!`),
      h('div', { class: 'finish-actions' },
        h('a', { class: 'btn btn-primary', href: `#/deck/${encId}/test` }, icon('test', { size: 18 }), 'Take a practice test'),
        h('button', { class: 'btn btn-ghost', id: 'learn-again', onclick: restart }, icon('refresh', { size: 18 }), 'Learn it again'),
        h('a', { class: 'btn btn-ghost', href: `#/deck/${encId}/match` }, icon('match', { size: 18 }), 'Play Match'))));
  }

  function restart() {
    for (const c of session.cards) delete progress.learn[c.id];
    save();
    start();
  }

  async function options() {
    const before = JSON.stringify(prefs);
    await modal({
      title: 'Learn options',
      body: h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Answer with'),
          segmented('Answer with', [['definition', 'Definition'], ['term', 'Term'], ['both', 'Both']], prefs.answerWith, (v) => { prefs.answerWith = v; })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Question types'),
          toggle('Multiple choice', prefs.mc, (v) => { prefs.mc = v; }, 'Pick from 4 options'),
          toggle('Written', prefs.written, (v) => { prefs.written = v; }, 'Type the answer from memory')),
        toggle('Shuffle terms', prefs.shuffle, (v) => { prefs.shuffle = v; }),
        toggle('Study starred terms only', prefs.starredOnly, (v) => { prefs.starredOnly = v; }, progress.stars.length ? `${progress.stars.length} starred` : 'No starred terms yet'),
        h('button', {
          class: 'link-btn danger', type: 'button',
          onclick: (e) => { for (const c of deck.cards) delete progress.learn[c.id]; save(); e.target.textContent = 'Progress reset ✓'; e.target.disabled = true; prefs._reset = Date.now(); },
        }, 'Reset Learn progress')),
      buttons: [{ label: 'Done', value: true, variant: 'primary' }],
    });
    if (!prefs.mc && !prefs.written) { prefs.mc = true; toast('At least one question type is needed, so multiple choice is back on.'); }
    const changed = JSON.stringify(prefs) !== before;
    delete prefs._reset;
    save();
    if (changed) start();
  }

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e) && e.key !== 'Enter') return;
    if (isTyping(e) && e.key === 'Enter' && e.target.id === 'answer-input' && !e.target.disabled) return; // the form handles it
    // A focused button already reacts to Enter / Space natively; don't fire twice.
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a')) return;
    onKey?.(e);
  }, { signal });
  signal.addEventListener('abort', () => { clearTimeout(advanceTimer); stopSpeaking(); });

  start();
}
