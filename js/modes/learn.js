export default function initLearn(state, container) {
    let currentItem = null;
    let choices = [];

    const wrapper = document.createElement('div');
    wrapper.className = 'learn-mode';
    container.appendChild(wrapper);

    function nextQuestion() {
        if (state.deck.length < 4) {
            wrapper.innerHTML = '<p class="error">Not enough cards for Learn Mode. Need at least 4.</p>';
            return;
        }

        // Pick random question
        const randomIndex = Math.floor(Math.random() * state.deck.length);
        currentItem = state.deck[randomIndex];

        // Pick 3 unique distractors
        const distractors = new Set();
        while (distractors.size < 3) {
            const dIndex = Math.floor(Math.random() * state.deck.length);
            if (dIndex !== randomIndex) {
                distractors.add(state.deck[dIndex].answer);
            }
        }

        // Combine and shuffle
        choices = [currentItem.answer, ...Array.from(distractors)];
        shuffleArray(choices);

        render();
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function render() {
        wrapper.innerHTML = `
            <div class="question-card">
                <h3>${currentItem.question}</h3>
            </div>
            <div class="options-grid">
                ${choices.map((choice, index) => `
                    <button class="option-btn" data-answer="${choice.replace(/"/g, '&quot;')}">${choice}</button>
                `).join('')}
            </div>
            <div class="feedback hidden" id="feedback-msg"></div>
            <button id="next-learn-btn" class="hidden primary-btn">Next Question</button>
        `;

        // Re-attach listeners
        const btns = wrapper.querySelectorAll('.option-btn');
        const feedback = wrapper.querySelector('#feedback-msg');
        const nextBtn = wrapper.querySelector('#next-learn-btn');

        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (wrapper.classList.contains('answered')) return;
                wrapper.classList.add('answered');

                const selected = btn.dataset.answer;
                const isCorrect = selected === currentItem.answer;

                if (isCorrect) {
                    btn.classList.add('correct');
                    feedback.textContent = "Correct! 🎉";
                    feedback.className = "feedback success";
                } else {
                    btn.classList.add('wrong');
                    feedback.textContent = `Wrong! The answer was: ${currentItem.answer}`;
                    feedback.className = "feedback error";

                    // Highlight correct one
                    btns.forEach(b => {
                        if (b.dataset.answer === currentItem.answer) {
                            b.classList.add('correct');
                        }
                    });
                }

                feedback.classList.remove('hidden');
                nextBtn.classList.remove('hidden');
            });
        });

        nextBtn.addEventListener('click', () => {
            wrapper.classList.remove('answered');
            nextQuestion();
        });
    }

    // Start
    nextQuestion();
}
