import { h, icon, toast, modal, timeAgo } from '../lib/dom.js';
import { importFromSheet, importFromCSVText, openSample, combineDecks, SAMPLES } from '../lib/deck-service.js';
import { toCSV } from '../lib/csv.js';
import * as store from '../lib/store.js';
import { summarize } from '../lib/learn-engine.js';
import { masteryBar } from './shell.js';

const TEMPLATE = [
  ['Term', 'Definition', 'Image'],
  ['Photosynthesis', 'How plants turn sunlight, water and CO2 into food', ''],
  ['Mitochondria', 'The powerhouse of the cell', ''],
  ['Osmosis', 'Water moving across a membrane toward more solute', ''],
];

export function renderHome({ root, navigate }) {
  const status = h('p', { class: 'form-status', role: 'alert', 'aria-live': 'assertive' });
  const input = h('input', {
    id: 'sheet-url', type: 'url', class: 'input input-lg', autocomplete: 'off', spellcheck: false,
    placeholder: 'Paste your Google Sheet link…', 'aria-label': 'Google Sheet link',
  });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-lg', id: 'load-btn' }, 'Start studying', icon('right', { size: 18 }));

  async function load(e) {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';
    submit.disabled = true;
    submit.classList.add('loading');
    submit.firstChild.textContent = 'Loading…';
    try {
      const deck = await importFromSheet(input.value);
      if (deck.warnings.length) toast(deck.warnings[0], { type: 'warn' });
      navigate(`#/deck/${encodeURIComponent(deck.id)}`);
    } catch (err) {
      status.textContent = err.message || 'Something went wrong loading that sheet.';
      status.className = 'form-status error';
      input.focus();
    } finally {
      submit.disabled = false;
      submit.classList.remove('loading');
      submit.firstChild.textContent = 'Start studying';
    }
  }

  const fileInput = h('input', {
    type: 'file', accept: '.csv,.tsv,.txt,text/csv', class: 'visually-hidden', id: 'csv-file',
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const deck = importFromCSVText(await file.text(), file.name);
        navigate(`#/deck/${encodeURIComponent(deck.id)}`);
      } catch (err) { status.textContent = err.message; status.className = 'form-status error'; }
      e.target.value = '';
    },
  });

  const hero = h('section', { class: 'hero' },
    h('div', { class: 'hero-badge' }, icon('sparkle', { size: 16 }), 'Free · No sign-up · Works with Google Sheets'),
    h('h1', { class: 'hero-title' }, 'Turn any Google Sheet into ', h('span', { class: 'grad' }, 'flashcards'), '.'),
    h('p', { class: 'hero-sub' }, 'Put terms in column A and definitions in column B. Paste the link, then study with Flashcards, Learn, Test and Match.'),
    h('form', { class: 'load-form', onsubmit: load, novalidate: true }, input, submit),
    status,
    h('div', { class: 'hero-alt' },
      h('label', { for: 'csv-file', class: 'link-btn' }, icon('upload', { size: 16 }), 'Open a CSV file'), fileInput,
      h('span', { class: 'sep', 'aria-hidden': 'true' }, '·'),
      h('button', { type: 'button', class: 'link-btn', onclick: () => howTo() }, icon('info', { size: 16 }), 'How do I set up my sheet?')));

  const samples = h('section', { class: 'section' },
    h('div', { class: 'section-head' }, h('h2', null, 'Try a sample deck'), h('p', { class: 'muted' }, 'No sheet yet? Jump straight in.')),
    h('div', { class: 'sample-grid' }, SAMPLES.map((s) => h('button', {
      type: 'button', class: 'sample-card', 'data-sample': s.id,
      onclick: () => { const d = openSample(s.id); navigate(`#/deck/${encodeURIComponent(d.id)}`); },
    }, h('span', { class: 'sample-emoji', 'aria-hidden': 'true' }, s.emoji),
      h('span', { class: 'sample-title' }, s.title),
      h('span', { class: 'sample-count' }, `${s.cards.length} terms`)))));

  const recent = store.recentDecks();
  // "Study together": pick two or more decks and study them as one.
  const selected = new Set();
  const combinable = recent.filter((d) => d.source?.kind !== 'combo');
  const togetherBar = h('div', { class: 'together-bar', id: 'together-bar', hidden: true },
    h('span', { id: 'together-count' }, 'Pick 2 or more decks'),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => setSelecting(false) }, 'Cancel'),
    h('button', { class: 'btn btn-primary btn-sm', type: 'button', id: 'together-go', disabled: true, onclick: () => {
      const d = combineDecks([...selected]);
      navigate(`#/deck/${encodeURIComponent(d.id)}`);
    } }, 'Study together'));
  const togetherBtn = combinable.length >= 2 ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'together-btn', onclick: () => setSelecting(true) }, icon('cards', { size: 16 }), 'Study together') : null;
  function setSelecting(on) {
    selected.clear();
    document.querySelectorAll('.deck-card').forEach((c) => { c.classList.toggle('selecting', on); c.classList.remove('picked'); const cb = c.querySelector('.pick'); if (cb) cb.checked = false; });
    togetherBar.hidden = !on;
    if (togetherBtn) togetherBtn.hidden = on;
    paintBar();
  }
  function paintBar() {
    const n = selected.size;
    togetherBar.querySelector('#together-count').textContent = n < 2 ? `Pick 2 or more decks (${n} picked)` : `${n} decks picked`;
    togetherBar.querySelector('#together-go').disabled = n < 2;
  }

  const recentSection = recent.length ? h('section', { class: 'section' },
    h('div', { class: 'section-head' }, h('h2', null, 'Jump back in'), togetherBtn),
    togetherBar,
    h('div', { class: 'deck-grid' }, recent.map((d) => {
      const prog = store.loadProgress(d.id);
      const counts = summarize(d.cards, prog.learn);
      const pick = d.source?.kind !== 'combo' ? h('label', { class: 'pick-wrap', title: 'Pick this deck' },
        h('input', { type: 'checkbox', class: 'pick', 'aria-label': `Pick ${d.title}`, onchange: (e) => {
          if (e.target.checked) selected.add(d.id); else selected.delete(d.id);
          card.classList.toggle('picked', e.target.checked);
          paintBar();
        } })) : null;
      const card = h('div', { class: 'deck-card', 'data-deck': d.id }, pick,
        h('a', { class: 'deck-card-link', href: `#/deck/${encodeURIComponent(d.id)}` },
          h('span', { class: 'deck-card-title' }, d.title),
          h('span', { class: 'deck-card-meta' }, `${d.cards.length} terms · ${timeAgo(prog.lastStudied)}`),
          masteryBar(counts)),
        h('button', {
          class: 'icon-btn deck-card-remove', 'aria-label': `Remove ${d.title} from this list`, title: 'Remove',
          onclick: async () => {
            const ok = await modal({
              title: 'Remove this deck?',
              body: h('p', null, `"${d.title}" and your progress on it will be removed from this device. Your Google Sheet is not touched.`),
              buttons: [{ label: 'Cancel', value: false }, { label: 'Remove', value: true, variant: 'danger' }],
            });
            if (ok) { store.removeDeck(d.id); card.remove(); toast('Deck removed'); }
          },
        }, icon('x', { size: 16 })));
      return card;
    }))) : null;

  const steps = h('section', { class: 'section how' },
    h('div', { class: 'section-head' }, h('h2', null, 'Make your own deck in 3 steps')),
    h('ol', { class: 'steps' },
      h('li', null, h('span', { class: 'step-num' }, '1'), h('div', null, h('h3', null, 'Fill in a sheet'),
        h('p', null, 'Column A is the term, column B is the definition. An optional column C can hold an image link.'),
        sheetPreview())),
      h('li', null, h('span', { class: 'step-num' }, '2'), h('div', null, h('h3', null, 'Share it'),
        h('p', null, 'Click ', h('b', null, 'Share'), ', set General access to ', h('b', null, 'Anyone with the link'), ', then ', h('b', null, 'Copy link'), '.'))),
      h('li', null, h('span', { class: 'step-num' }, '3'), h('div', null, h('h3', null, 'Paste and study'),
        h('p', null, 'Paste the link above. Edit your sheet any time and FlashMaster picks up the changes.')))),
    h('div', { class: 'how-actions' },
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: downloadTemplate }, icon('download', { size: 18 }), 'Download template'),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => howTo() }, icon('info', { size: 18 }), 'Coming from Quizlet?')));

  root.append(h('div', { class: 'page home' }, hero, recentSection, samples, steps));
  if (!recent.length) setTimeout(() => input.focus(), 0);
}

function sheetPreview() {
  const rows = TEMPLATE.slice(0, 3);
  return h('div', { class: 'sheet-preview', 'aria-label': 'Example sheet layout' },
    h('table', null,
      h('thead', null, h('tr', null, h('th', null, ''), ['A', 'B', 'C'].map((c) => h('th', null, c)))),
      h('tbody', null, rows.map((r, i) => h('tr', { class: i === 0 ? 'hdr' : '' }, h('th', null, String(i + 1)), r.map((c) => h('td', null, c || (i === 0 ? '' : '—'))))))));
}

function downloadTemplate() {
  const blob = new Blob([toCSV(TEMPLATE)], { type: 'text/csv' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'flashmaster-template.csv' });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Template downloaded. In Google Sheets choose File › Import to open it.');
}

function howTo() {
  modal({
    title: 'Setting up your sheet',
    body: h('div', { class: 'prose' },
      h('h3', null, 'Columns'),
      h('ul', null,
        h('li', null, h('b', null, 'A · Term'), ': the word, question or front of the card.'),
        h('li', null, h('b', null, 'B · Definition'), ': the meaning, answer or back of the card.'),
        h('li', null, h('b', null, 'C · Image'), ' (optional): a link to a picture starting with https://'),
        h('li', null, h('b', null, 'D · Hint'), ' (optional): a clue shown when a student taps Show hint.')),
      h('p', null, 'Image and Hint need a header row (Term, Definition, Image, Hint) so they can be found.'),
      h('p', null, 'A header row like "Term, Definition" is optional. "Question, Answer" or "Front, Back" work too.'),
      h('h3', null, 'Sharing'),
      h('p', null, 'In Google Sheets click Share → General access → Anyone with the link → Viewer. "File › Share › Publish to web" links work as well.'),
      h('p', null, 'Using several tabs? Open the tab you want, then copy the link. Each tab becomes its own deck.'),
      h('h3', null, 'Moving from Quizlet'),
      h('ol', null,
        h('li', null, 'In Quizlet open your set, choose ⋯ › Export and copy the text.'),
        h('li', null, 'Paste it into cell A1 of a new Google Sheet.'),
        h('li', null, 'If everything lands in column A, use Data › Split text to columns.'),
        h('li', null, 'Share the sheet and paste the link here. You can also save the export as a .txt file and open it directly.'))),
    buttons: [{ label: 'Got it', value: true, variant: 'primary' }],
  });
}
