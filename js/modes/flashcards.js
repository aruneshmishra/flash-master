export default function initFlashcards(state, container) {
    let currentIndex = 0;

    // Create DOM structure
    const wrapper = document.createElement('div');
    wrapper.className = 'flashcard-mode';

    wrapper.innerHTML = `
        <div class="card-scene">
            <div class="card">
                <div class="card-face card-front">
                    <div class="card-content" id="fc-question"></div>
                    <div class="hint-text">Tap to flip</div>
                </div>
                <div class="card-face card-back">
                    <div class="card-content" id="fc-answer"></div>
                </div>
            </div>
        </div>
        <div class="controls">
            <button id="prev-btn" class="control-btn">Previous</button>
            <span id="counter" class="counter">1 / ${state.deck.length}</span>
            <button id="next-btn" class="control-btn">Next</button>
        </div>
    `;

    container.appendChild(wrapper);

    // Elements
    const card = wrapper.querySelector('.card');
    const questionEl = document.getElementById('fc-question');
    const answerEl = document.getElementById('fc-answer');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const counter = document.getElementById('counter');

    // State functions
    function renderCard() {
        if (state.deck.length === 0) return;

        const item = state.deck[currentIndex];
        questionEl.textContent = item.question;
        answerEl.textContent = item.answer;
        counter.textContent = `${currentIndex + 1} / ${state.deck.length}`;

        // Reset flip
        card.classList.remove('is-flipped');
    }

    // Event Listeners
    card.addEventListener('click', () => {
        card.classList.toggle('is-flipped');
    });

    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card flip if overlapping
        if (currentIndex > 0) {
            currentIndex--;
            renderCard();
        }
    });

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex < state.deck.length - 1) {
            currentIndex++;
            renderCard();
        }
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (state.currentMode !== 'flashcards') return;

        if (e.key === 'ArrowLeft') prevBtn.click();
        if (e.key === 'ArrowRight') nextBtn.click();
        if (e.key === ' ' || e.key === 'Enter') card.click();
    });

    // Initial Render
    renderCard();
}
