import initData from './data.js';
import initUI from './ui.js';

// Application State
const state = {
    deck: [],
    currentMode: 'flashcards',
};

// Initialize Modules
document.addEventListener('DOMContentLoaded', () => {
    initData(state);
    initUI(state);
});

// Export state for debugging if needed
window.appState = state;
