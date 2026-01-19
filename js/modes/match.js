export default function initMatch(state, container, onNavigate) {
    const wrapper = document.createElement('div');
    wrapper.className = 'match-mode';
    container.appendChild(wrapper);

    // Limit to 8 pairs (16 cards) for 4x4 grid
    const matchSize = Math.min(8, state.deck.length);
    const gameSet = [...state.deck].sort(() => 0.5 - Math.random()).slice(0, matchSize);

    // Create indivudal cards for questions and answers
    let cards = [];
    gameSet.forEach(item => {
        cards.push({
            id: item.id,
            text: item.question,
            type: 'question'
        });
        cards.push({
            id: item.id,
            text: item.answer,
            type: 'answer'
        });
    });

    // Shuffle grid
    cards.sort(() => 0.5 - Math.random());

    let selectedCards = [];
    let matchesFound = 0;
    let isProcessing = false;

    function renderGrid() {
        wrapper.innerHTML = `
            <div class="match-stats">
                <span>Pairs matched: <span id="match-count">0</span> / ${matchSize}</span>
                <span id="match-timer">00:00</span>
            </div>
            <div class="match-grid">
                ${cards.map((card, index) => `
                    <div class="match-card" data-index="${index}" data-id="${card.id}">
                        <div class="match-card-content">${card.text}</div>
                    </div>
                `).join('')}
            </div>
             <div id="match-complete" class="hidden">
                 <h3>Congratulations!</h3>
                 <p>You matched all pairs!</p>
                 <button class="primary-btn" id="reset-match">Play Again</button>
             </div>
        `;

        wrapper.querySelectorAll('.match-card').forEach(card => {
            card.addEventListener('click', onCardClick);
        });

        startTimer();
    }

    function onCardClick(e) {
        if (isProcessing) return;
        const card = e.currentTarget;

        // Ignore if already matched or selected
        if (card.classList.contains('matched') || card.classList.contains('selected')) return;

        card.classList.add('selected');
        selectedCards.push(card);

        if (selectedCards.length === 2) {
            checkMatch();
        }
    }

    function checkMatch() {
        isProcessing = true;
        const [card1, card2] = selectedCards;
        const id1 = card1.dataset.id;
        const id2 = card2.dataset.id;

        if (id1 === id2) {
            // Match!
            setTimeout(() => {
                card1.classList.add('matched');
                card2.classList.add('matched');
                card1.classList.remove('selected');
                card2.classList.remove('selected');
                matchesFound++;
                document.getElementById('match-count').textContent = matchesFound;
                checkWin();
                isProcessing = false;
            }, 500);
        } else {
            // No Match
            setTimeout(() => {
                card1.classList.add('wrong');
                card2.classList.add('wrong');
                setTimeout(() => {
                    card1.classList.remove('selected', 'wrong');
                    card2.classList.remove('selected', 'wrong');
                    isProcessing = false;
                }, 800);
            }, 500);
        }
        selectedCards = [];
    }

    let timerInterval;
    function startTimer() {
        const timerEl = document.getElementById('match-timer');
        let seconds = 0;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            if (timerEl) timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    function checkWin() {
        if (matchesFound === matchSize) {
            clearInterval(timerInterval);
            const winDiv = document.getElementById('match-complete');
            winDiv.classList.remove('hidden');
            document.getElementById('reset-match').addEventListener('click', () => {
                // Trigger global mode switch to ensure clean reset
                if (onNavigate) onNavigate('match');
            });
            // Hide grid to clean up or overlay?
            wrapper.querySelector('.match-grid').style.opacity = '0.5';
        }
    }

    renderGrid();
}
