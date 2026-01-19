import initAuth from './auth.js';
import initData from './data.js';
import initUI from './ui.js';

// Application State
const state = {
    user: null,
    deck: [],
    currentMode: 'flashcards',
};

// Initialize Modules
document.addEventListener('DOMContentLoaded', () => {
    initAuth(state);
    initData(state);
    initUI(state);
});

// Export state for debugging if needed
window.appState = state;
