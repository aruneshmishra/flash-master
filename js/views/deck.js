import { h, icon, toast, modal } from '../lib/dom.js';
import { refreshDeck, renameDeck, isRemote, sheetInputFor } from '../lib/deck-service.js';
import { summarize } from '../lib/learn-engine.js';
import { speak, canSpeak, LANGUAGES } from '../lib/speech.js';
import * as store from '../lib/store.js';
import { MODES, masteryBar, starButton } from './shell.js';

export function shareUrlFor(deck) {
  const base = `${location.origin}${location.pathname}`;
  const input = sheetInputFor(deck.source);
  if (input) return `${base}?sheet=${encodeURIComponent(input)}`;
  if (deck.source.kind === 'sample') return `${base}#/deck/${encodeURIComponent(deck.id)}`;
  return null;
}

export function renderDeck(ctx) {
  const { root, progress, save, navigate } = ctx;
  let deck = ctx.deck;
  const page = h('div', { class: 'page deck-page' });
  root.append(page);

  function draw() {
    page.replaceChildren();
    const counts = summarize(deck.cards, progress.learn);
    const encId = encodeURIComponent(deck.id);

    const titleEl = h('h1', { class: 'deck-title', id: 'deck-title' }, deck.title);
    const editBtn = h('button', { class: 'icon-btn', 'aria-label': 'Rename deck', title: 'Rename', onclick: rename }, icon('edit', { size: 18 }));

    const actions = h('div', { class: 'deck-actions' },
      shareUrlFor(deck) ? h('button', { class: 'btn btn-ghost btn-sm', id: 'share-btn', onclick: share }, icon('link', { size: 16 }), 'Share') : null,
      isRemote(deck) ? h('button', { class: 'btn btn-ghost btn-sm', id: 'refresh-btn', onclick: refresh }, icon('refresh', { size: 16 }), 'Refresh') : null,
      isRemote(deck) ? h('a', { class: 'btn btn-ghost btn-sm', href: sheetInputFor(deck.source), target: '_blank', rel: 'noopener' }, icon('sheet', { size: 16 }), 'Open sheet') : null,
      canSpeak() ? h('button', { class: 'btn btn-ghost btn-sm', onclick: voiceSettings }, icon('sound', { size: 16 }), 'Voice') : null);

    const head = h('header', { class: 'deck-head' },
      h('a', { class: 'btn btn-ghost btn-sm back-link', href: '#/' }, icon('back', { size: 18 }), 'All decks'),
      h('div', { class: 'deck-title-row' }, titleEl, editBtn),
      h('p', { class: 'muted deck-meta' }, `${deck.cards.length} terms`, deck.source.kind === 'sample' ? ' · Sample deck' : ''),
      actions);

    const tiles = h('div', { class: 'mode-grid' }, MODES.map((m) => h('a', { class: `mode-tile mode-${m.key}`, href: `#/deck/${encId}/${m.key}`, 'data-mode': m.key },
      h('span', { class: 'mode-tile-icon' }, icon(m.icon, { size: 26 })),
      h('span', { class: 'mode-tile-text' }, h('span', { class: 'mode-tile-title' }, m.label), h('span', { class: 'mode-tile-blurb' }, m.blurb)))));

    const pct = counts.total ? Math.round((counts.mastered / counts.total) * 100) : 0;
    const progressCard = h('section', { class: 'panel progress-panel' },
      h('div', { class: 'progress-panel-head' },
        h('h2', null, 'Your progress'),
        h('span', { class: 'big-pct' }, `${pct}%`)),
      masteryBar(counts, { large: true }),
      h('p', { class: 'muted small' }, nextStepText(counts, progress)),
      (counts.learning || counts.mastered || progress.stars.length || progress.know.length)
        ? h('button', { class: 'link-btn danger', onclick: resetProgress }, 'Reset progress') : null);

    // Term list with search and starred filter
    let filter = 'all';
    let query = '';
    const list = h('ul', { class: 'term-list', id: 'term-list' });
    const countEl = h('span', { class: 'muted small' });
    const paintList = () => {
      const q = query.toLowerCase();
      const items = deck.cards.filter((c) => (filter === 'all' || progress.stars.includes(c.id)) &&
        (!q || c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q)));
      list.replaceChildren(...items.map((c) => termRow(c)));
      if (!items.length) list.append(h('li', { class: 'term-empty muted' }, filter === 'starred' && !progress.stars.length ? 'Star cards to save them here for extra practice.' : 'No matching terms.'));
      countEl.textContent = `${items.length} shown`;
    };
    const termRow = (c) => {
      const status = progress.learn[c.id];
      const chip = !status || !status.seen ? null : status.level >= 2 ? h('span', { class: 'chip chip-mastered' }, 'Mastered') : h('span', { class: 'chip chip-learning' }, 'Learning');
      return h('li', { class: 'term-row' },
        h('div', { class: 'term-cell term' }, c.term, chip),
        h('div', { class: 'term-cell def' }, c.image ? h('img', { src: c.image, alt: '', loading: 'lazy', class: 'term-img', referrerpolicy: 'no-referrer' }) : null, h('span', null, c.definition)),
        h('div', { class: 'term-tools' },
          canSpeak() ? h('button', { class: 'icon-btn', 'aria-label': `Read ${c.term} aloud`, onclick: () => speak(c.term, deck.lang?.term) }, icon('sound', { size: 18 })) : null,
          starButton(c, progress, () => { save(); if (filter === 'starred') paintList(); })));
    };
    const filters = h('div', { class: 'list-tools' },
      h('div', { class: 'segmented small', role: 'tablist' },
        ['all', 'starred'].map((f) => h('button', {
          class: `seg${f === filter ? ' active' : ''}`, role: 'tab', 'aria-selected': String(f === filter),
          onclick: (e) => { filter = f; e.currentTarget.parentElement.querySelectorAll('.seg').forEach((b) => { b.classList.toggle('active', b === e.currentTarget); b.setAttribute('aria-selected', String(b === e.currentTarget)); }); paintList(); },
        }, f === 'all' ? 'All terms' : '★ Starred'))),
      h('label', { class: 'search' }, icon('search', { size: 16 }),
        h('input', { type: 'search', class: 'input input-sm', placeholder: 'Search terms', 'aria-label': 'Search terms', oninput: (e) => { query = e.target.value; paintList(); } })),
      countEl);

    const warnings = deck.warnings?.length ? h('div', { class: 'notice warn' }, icon('info', { size: 18 }), deck.warnings.join(' ')) : null;

    page.append(...[head, warnings, tiles].filter(Boolean),
      h('div', { class: 'deck-columns' },
        progressCard,
        h('section', { class: 'panel terms-panel' }, h('div', { class: 'section-head' }, h('h2', null, `Terms in this set (${deck.cards.length})`)), filters, list)));
    paintList();
  }

  function nextStepText(c, p) {
    if (!c.learning && !c.mastered) return 'Start with Flashcards to get familiar, then use Learn to lock it in.';
    if (c.mastered === c.total) return `Amazing, you've mastered all ${c.total} terms! Take a Test to prove it${p.best?.test != null ? ` (best so far: ${p.best.test}%)` : ''}.`;
    return `Keep going in Learn. ${c.total - c.mastered} term${c.total - c.mastered === 1 ? '' : 's'} left to master.`;
  }

  async function rename() {
    const input = h('input', { class: 'input', value: deck.title, maxlength: 80, 'aria-label': 'Deck name' });
    const name = await modal({
      title: 'Rename deck', body: input,
      buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: () => input.value, variant: 'primary' }],
      onOpen: (dlg, close) => { input.select(); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value); }); },
    });
    if (name && name.trim()) { renameDeck(deck, name); draw(); toast('Deck renamed'); }
  }

  async function share() {
    const url = shareUrlFor(deck);
    try { await navigator.clipboard.writeText(url); toast('Link copied! Anyone with it can study this deck.', { type: 'success' }); }
    catch {
      modal({ title: 'Share this deck', body: h('input', { class: 'input', value: url, readonly: true, onfocus: (e) => e.target.select() }), buttons: [{ label: 'Done', value: true, variant: 'primary' }] });
    }
  }

  async function refresh() {
    const btn = page.querySelector('#refresh-btn');
    btn.disabled = true;
    btn.classList.add('spinning');
    try {
      const r = await refreshDeck(deck);
      deck = r.deck;
      ctx.deck = deck;
      draw();
      toast(r.changed ? `Updated from your sheet: ${deck.cards.length} terms` : 'Already up to date', { type: r.changed ? 'success' : 'info' });
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 5000 });
      btn.disabled = false;
      btn.classList.remove('spinning');
    }
  }

  async function voiceSettings() {
    const sel = (side) => h('select', { class: 'input', 'aria-label': `${side} language`, onchange: (e) => { deck.lang = { ...deck.lang, [side]: e.target.value }; store.saveDeck(deck); } },
      LANGUAGES.map(([v, l]) => h('option', { value: v, selected: (deck.lang?.[side] || 'auto') === v }, l)));
    await modal({
      title: 'Read-aloud voice',
      body: h('div', { class: 'form-grid' },
        h('label', null, h('span', null, 'Terms are in'), sel('term')),
        h('label', null, h('span', null, 'Definitions are in'), sel('definition')),
        h('p', { class: 'muted small' }, 'Pick the language so words are pronounced correctly. Available voices depend on your device.')),
      buttons: [{ label: 'Done', value: true, variant: 'primary' }],
    });
  }

  async function resetProgress() {
    const ok = await modal({
      title: 'Reset progress?',
      body: h('p', null, 'This clears Learn mastery, stars, flashcard sorting and best scores for this deck.'),
      buttons: [{ label: 'Cancel', value: false }, { label: 'Reset', value: true, variant: 'danger' }],
    });
    if (!ok) return;
    Object.assign(progress, store.emptyProgress());
    save();
    draw();
    toast('Progress reset. Fresh start!');
  }

  draw();
  return { onDeckUpdated(d) { deck = d; draw(); } };
}
