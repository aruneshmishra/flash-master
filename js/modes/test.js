export default function initTest(state, container, onNavigate) {
    const wrapper = document.createElement('div');
    wrapper.className = 'test-mode';
    container.appendChild(wrapper);

    // Randomize 10 questions or max deck length
    const testSize = Math.min(10, state.deck.length);
    const testSet = [...state.deck].sort(() => 0.5 - Math.random()).slice(0, testSize);

    // Determine input type for each (now always multiple choice)
    const questionsWithTypes = testSet.map(item => ({
        ...item,
        type: 'radio'
    }));

    function renderForm() {
        wrapper.innerHTML = `
            <div class="test-header">
                <h3>Test Mode (${testSize} questions)</h3>
            </div>
            <form id="test-form">
                ${questionsWithTypes.map((item, index) => renderQuestion(item, index)).join('')}
                <button type="submit" class="primary-btn submit-test">Submit Test</button>
            </form>
            <div id="test-results" class="hidden"></div>
        `;

        document.getElementById('test-form').addEventListener('submit', (e) => {
            e.preventDefault();
            calculateScore();
        });
    }

    function renderQuestion(item, index) {
        let inputHtml = '';

        // Generate 3 random distractors
        const distractors = getRandomDistractors(item.answer);
        const options = [item.answer, ...distractors].sort(() => 0.5 - Math.random());

        inputHtml = `
            <div class="radio-options">
                ${options.map(opt => `
                    <label class="radio-label">
                        <input type="radio" name="q${index}" value="${opt.replace(/"/g, '&quot;')}" required>
                        <span>${opt}</span>
                    </label>
                `).join('')}
            </div>
        `;

        return `
            <div class="test-item" data-index="${index}">
                <p class="test-q-text"><strong>${index + 1}.</strong> ${item.question}</p>
                ${inputHtml}
            </div>
        `;
    }

    function getRandomDistractors(correctAnswer) {
        const others = state.deck.filter(i => i.answer !== correctAnswer);
        const shuffled = others.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3).map(i => i.answer);
    }

    function calculateScore() {
        const form = document.getElementById('test-form');
        const formData = new FormData(form);
        const resultsContainer = document.getElementById('test-results');
        let score = 0;

        // Disable form
        const inputs = form.querySelectorAll('input, button');
        inputs.forEach(i => i.disabled = true);

        questionsWithTypes.forEach((item, index) => {
            const val = formData.get(`q${index}`);
            const itemDiv = wrapper.querySelector(`.test-item[data-index="${index}"]`);

            let isCorrect = false;
            if (val && val.toLowerCase().trim() === item.answer.toLowerCase().trim()) {
                isCorrect = true;
                score++;
                itemDiv.classList.add('correct-answer');
            } else {
                itemDiv.classList.add('wrong-answer');
                const feedback = document.createElement('div');
                feedback.className = 'answer-feedback';
                feedback.textContent = `Correct answer: ${item.answer}`;
                itemDiv.appendChild(feedback);
            }
        });

        const percentage = Math.round((score / testSize) * 100);
        resultsContainer.innerHTML = `
            <h3>Results</h3>
            <p class="score">You scored ${score} / ${testSize} (${percentage}%)</p>
            <button class="primary-btn" id="retry-btn">Take New Test</button>
        `;
        resultsContainer.classList.remove('hidden');

        document.getElementById('retry-btn').addEventListener('click', () => {
            // Call the navigation function directly to reset
            if (onNavigate) onNavigate('test');
        });

        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    renderForm();
}
