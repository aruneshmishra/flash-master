import { h, icon, modal, toast } from '../lib/dom.js';
import { record, streak, today, GOAL_OPTIONS } from '../lib/activity.js';
import { loadActivity, saveActivity } from '../lib/store.js';
import { confetti } from '../lib/confetti.js';
import { segmented } from './shell.js';

/** Count answered questions / cards toward today's goal and the streak. */
export function logStudy(n = 1) {
  if (n <= 0) return;
  const a = loadActivity();
  const { reachedGoal } = record(a, n);
  saveActivity(a);
  paintStreak();
  if (reachedGoal) {
    confetti();
    toast(`Daily goal reached! ${streak(a)}-day streak 🔥`, { type: 'success', timeout: 4500 });
  }
}

export function paintStreak() {
  const btn = document.getElementById('streak-btn');
  if (!btn) return;
  const a = loadActivity();
  const s = streak(a);
  const done = today(a);
  const pct = Math.min(100, Math.round((done / a.goal) * 100));
  btn.replaceChildren(
    h('span', { class: 'streak-ring', style: { '--pct': pct }, 'aria-hidden': 'true' }, icon('flame', { size: 16 })),
    h('span', { class: 'streak-num', id: 'streak-num' }, String(s)));
  btn.classList.toggle('lit', done > 0);
  btn.setAttribute('aria-label', `${s}-day streak. Today ${done} of ${a.goal}. Open daily goal`);
  btn.title = `${s}-day streak · today ${done}/${a.goal}`;
}

export function showStreak() {
  const a = loadActivity();
  const s = streak(a);
  const done = today(a);
  const week = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const n = a.days[key] || 0;
    week.push(h('div', { class: `wk-day${n ? ' on' : ''}${n >= a.goal ? ' goal' : ''}`, title: `${n} answered` },
      h('span', { class: 'wk-dot' }, n >= a.goal ? icon('check', { size: 14 }) : n ? '•' : ''),
      h('span', { class: 'wk-label' }, d.toLocaleDateString(undefined, { weekday: 'narrow' }))));
    d.setDate(d.getDate() + 1);
  }
  const pct = Math.min(100, Math.round((done / a.goal) * 100));
  modal({
    title: 'Daily goal',
    body: h('div', { class: 'streak-dialog' },
      h('div', { class: 'streak-big' }, h('span', { class: 'streak-flame', 'aria-hidden': 'true' }, '🔥'),
        h('div', null, h('b', { id: 'streak-days' }, `${s} day${s === 1 ? '' : 's'}`), h('span', { class: 'muted' }, s ? 'Keep it going. Study a little every day!' : 'Answer a question to start your streak.'))),
      h('div', { class: 'goal-row' },
        h('div', { class: 'goal-bar' }, h('span', { style: { width: `${pct}%` } })),
        h('span', { class: 'muted small' }, `${done} / ${a.goal} today`)),
      h('div', { class: 'week' }, week),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Daily goal (questions and cards)'),
        segmented('Daily goal', GOAL_OPTIONS.map((g) => [g, String(g)]), a.goal, (v) => { const x = loadActivity(); x.goal = v; saveActivity(x); paintStreak(); })),
      h('p', { class: 'muted small' }, 'Every flashcard you sort, question you answer and game you finish counts. Your streak is saved on this device.')),
    buttons: [{ label: 'Done', value: true, variant: 'primary' }],
  });
}
