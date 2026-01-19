# FlashMaster

**FlashMaster** is a modern, single-page web application designed to help you master any subject through flashcards, interactive tests, and games. Built with vanilla JavaScript, HTML5, and CSS3, it offers a fast and responsive experience purely in the browser.

## Features

- **Google Authentication**: Securely sign in with your Google account.
- **Dynamic Data Loading**: Load flashcard decks directly from any public Google Sheet.
- **Four Study Modes**:
  - **🃏 Flashcards**: Classic study mode with 3D flip animations.
  - **🧠 Learn**: Multiple-choice questions to reinforce memory.
  - **📝 Test**: Type-in answers to test your full recall.
  - **🧩 Match**: A timed game to match questions with their answers.
- **Responsive Design**: Works on desktop, tablet, and mobile devices.

## Setup & Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/aruneshmishra/flash-master.git
   cd flash-master
   ```

2. **Configure Google Sign-In**
   - This app uses Google Identity Services. You will need a Google Cloud Project with OAuth 2.0 credentials.
   - Open `index.html`.
   - Find the line:
     ```html
     <div id="g_id_onload" data-client_id="YOUR_GOOGLE_CLIENT_ID" ...>
     ```
   - Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Google Client ID.
   - *Note: Ensure your `origin` (e.g., `http://localhost:3000` or your deployment URL) is added to your Authorized Javascript Origins in the Google Cloud Console.*

3. **Run the Application**
   - You can serve the files using any static file server.
   - **Using Python:**
     ```bash
     # Python 3
     python -m http.server 8000
     ```
   - Open your browser to `http://localhost:8000`.

## User Guide

### 1. Preparing Your Data
FlashMaster loads decks from Google Sheets.
1. Create a new Google Sheet.
2. The **first row** must be headers: `Question` and `Answer` (case-insensitive).
3. Add your content in the rows below.
4. Click **Share** -> Change to **"Anyone with the link"** -> **Viewer**.
5. Copy the URL.

### 2. Loading a Deck
1. Sign in with Google.
2. In the Dashboard view, paste your **Google Sheet URL** into the input field.
3. Click **Load Deck**.

### 3. Study Modes

#### Flashcards
- Click the card to flip it.
- Use the **Next** and **Previous** buttons to navigate through the deck.

#### Learn Mode
- You will be presented with a question and multiple choices.
- Select the correct answer. The app will visually indicate if you are right or wrong.

#### Test Mode
- Type the answer to the question in the input box.
- Submit to see if you are correct. This mode requires exact text matching (case-insensitive trims applied).

#### Match Game
- You will see a grid of Cards (Questions) and Answers.
- Click a Question card, then click its corresponding Answer card.
- If they match, they disappear. Clear the board!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
