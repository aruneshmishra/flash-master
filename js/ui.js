import initFlashcards from './modes/flashcards.js';
import initLearn from './modes/learn.js';
import initTest from './modes/test.js';
import initMatch from './modes/match.js';

export default function initUI(state) {
    const modeContainer = document.getElementById('mode-container');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const backBtn = document.getElementById('back-to-dashboard');

    // Mode Modules
    const modes = {
        flashcards: initFlashcards,
        learn: initLearn,
        test: initTest,
        match: initMatch
    };

    // Listen for Deck Data
    document.addEventListener('deckLoaded', (e) => {
        const { title } = e.detail;
        const titleEl = document.getElementById('deck-title');
        const filenameEl = document.getElementById('deck-filename');

        titleEl.textContent = 'Current Deck';

        if (title && title !== 'Current Deck') {
            filenameEl.textContent = title;
        } else {
            filenameEl.textContent = '';
        }

        // Initialize default mode
        switchMode('flashcards');
    });

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchMode(mode);
        });
    });

    backBtn.addEventListener('click', () => {
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('active');
        document.getElementById('dashboard-view').classList.remove('hidden');
        document.getElementById('dashboard-view').classList.add('active');
        state.deck = []; // Clear deck on back
    });

    function switchMode(modeName) {
        state.currentMode = modeName;

        // Update Tabs
        modeBtns.forEach(btn => {
            if (btn.dataset.mode === modeName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Clear Container (and remove listeners handled by closure if needed, but simple overwrite is okay for now)
        modeContainer.innerHTML = '';

        // Render Mode
        if (modes[modeName]) {
            modes[modeName](state, modeContainer, switchMode);
        }
    }
}
