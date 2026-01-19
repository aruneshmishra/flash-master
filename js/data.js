export default function initData(state) {
    const loadBtn = document.getElementById('load-btn');
    const sheetUrlInput = document.getElementById('sheet-url');
    const dashboardView = document.getElementById('dashboard-view');
    const appView = document.getElementById('app-view');

    loadBtn.addEventListener('click', async () => {
        const url = sheetUrlInput.value.trim();
        if (!url) {
            alert("Please enter a Google Sheet URL");
            return;
        }

        try {
            loadBtn.textContent = 'Loading...';
            loadBtn.disabled = true;

            const csvUrl = convertToExportUrl(url);
            const data = await fetchAndParseCsv(csvUrl);

            if (data.length === 0) {
                throw new Error("No data found or invalid format.");
            }

            state.deck = data;
            console.log("Deck loaded:", state.deck);

            // Dispatch event or call UI update directly
            // For now, let's just switch view
            dashboardView.classList.add('hidden');
            dashboardView.classList.remove('active');
            appView.classList.remove('hidden');
            appView.classList.add('active');

            // Trigger mode initialization (we'll do this better in UI module)
            document.dispatchEvent(new CustomEvent('deckLoaded', { detail: state.deck }));

        } catch (error) {
            console.error(error);
            alert("Failed to load deck: " + error.message);
        } finally {
            loadBtn.textContent = 'Load Deck';
            loadBtn.disabled = false;
        }
    });

    function convertToExportUrl(url) {
        // Simple regex to find /edit and replace with /export?format=csv
        // Supports .../edit#gid=123 preserving gid
        // Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0

        let match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) throw new Error("Invalid Google Sheet URL");

        const id = match[1];
        let gid = '0'; // Default gid

        const gidMatch = url.match(/gid=([0-9]+)/);
        if (gidMatch) {
            gid = gidMatch[1];
        }

        return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }

    async function fetchAndParseCsv(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");

        const text = await response.text();
        return parseCSV(text);
    }

    function parseCSV(text) {
        // Very basic CSV parser. 
        // Assumes header row: Question, Answer (case insensitive)
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

        const questionIdx = headers.indexOf('question');
        const answerIdx = headers.indexOf('answer');

        if (questionIdx === -1 || answerIdx === -1) {
            throw new Error("Sheet must have 'Question' and 'Answer' columns.");
        }

        const result = [];
        // Start from index 1 to skip header
        for (let i = 1; i < lines.length; i++) {
            // Handle basic comma splitting (doesn't handle commas inside quotes perfectly without complex regex, 
            // but usually sufficient for simple flashcards. For robustness, we'd use a regex or library)
            // Let's use a slightly better regex for CSV parsing
            const row = parseCSVRow(lines[i]);

            if (row.length > Math.max(questionIdx, answerIdx)) {
                result.push({
                    question: row[questionIdx],
                    answer: row[answerIdx],
                    id: i // unique ID for matching game
                });
            }
        }
        return result;
    }

    function parseCSVRow(row) {
        const result = [];
        let cell = '';
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
            const char = row[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(cell.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
                cell = '';
            } else {
                cell += char;
            }
        }
        result.push(cell.trim().replace(/^"|"$/g, ''));
        return result;
    }
}
