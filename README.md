# FlashMaster

**Turn any Google Sheet into flashcards, an adaptive Learn mode, practice tests and a Match game.**
Free, no sign-up, nothing to install. Dark mode by default.

👉 **[Open FlashMaster](https://aruneshmishra.github.io/flash-master/)**

---

## Make a deck in 3 steps

1. **Fill in a Google Sheet.** Put the term in column A and the definition in column B.

   | Term | Definition | Image *(optional)* | Hint *(optional)* |
   |------|------------|--------------------|-------------------|
   | Photosynthesis | How plants turn sunlight into food | | Think about leaves |
   | Mitochondria | The powerhouse of the cell | https://… | |

   Image and Hint columns need a header row so FlashMaster can find them.

   The header row is optional. `Term / Definition`, `Question / Answer` and `Front / Back` are all recognised, in any column order.
2. **Share it.** Click **Share**, set General access to **Anyone with the link**, then **Copy link**. *File › Share › Publish to web* links work too.
3. **Paste the link** on the FlashMaster home page and press **Start studying**.

Edit your sheet any time. FlashMaster picks up the changes automatically, or press **Refresh** on the deck page.

**Several tabs?** Open the tab you want, then copy the link. Each tab becomes its own deck.

**No sheet yet?** Try one of the built-in sample decks, or open a `.csv` file from your computer.

### Coming from Quizlet?

1. In Quizlet, open your set and choose **⋯ › Export**, then copy the text.
2. Paste it into cell A1 of a new Google Sheet. If everything lands in column A, use **Data › Split text to columns**.
3. Share the sheet and paste the link into FlashMaster.

You can also save Quizlet's export as a `.txt` file and open it directly with **Open a CSV file**.

---

## Study modes

### 🃏 Flashcards
* Tap the card or press **Space** to flip. Swipe or use **← →** to move.
* **Track progress** sorts cards into *Know* and *Still learning*. At the end you can review only the cards you're still learning.
* ★ Star tricky cards, then study only starred cards from Options.
* Shuffle, auto-play, choose which side shows first, and read cards aloud.

### 🧠 Learn
An adaptive mode that keeps going until you know everything.
* Every term moves from **not studied**, to **familiar**, to **mastered**.
* New terms start as multiple choice. Once you get one right, you type the answer from memory.
* Long answers become a "reveal and self-check" card, because typing a paragraph is no fun.
* Short rounds of 7 terms. A missed term comes back later in the same round.
* Typing is forgiving. Capital letters, accents, punctuation, "the / a / to" and small typos are all fine. You can also press **Override: I was right**.
* Progress is saved, so you can stop and continue later.

### 📝 Test
* Choose how many questions, whether to answer with the term or the definition, and the question types: **True/False**, **Multiple choice**, **Matching** and **Written**.
* You get your score, time and a full review of every answer.
* **Retake missed** builds a new test from only the questions you got wrong.

### 🎮 Games
* **Match**: pair six terms with their definitions as fast as you can. A wrong pair adds one second.
* **Meteor**: a word falls from the sky. Pick the right answer before it lands. You have 3 lives and it speeds up as you go.

### 🧠 Spaced review
Once you master a term in Learn, it joins spaced review. FlashMaster brings it back after 1 day, then 3, 7, 14, 30 and 60 days. Forget it and it starts again from 1 day. When cards are due, the deck page shows a banner like "12 cards due for review".

### 🔊 Spell
In Learn, spell questions read the answer aloud and you type what you hear. They turn on automatically when you pick a language under **Voice** on the deck page, and you can switch them on or off in Learn options.

### 💡 Hints
Add a **Hint** column to your sheet. A "Show hint" link then appears on flashcards and in Learn and Test.

### 🔥 Streak and daily goal
The flame in the top bar shows how many days in a row you have studied. Tap it to set a daily goal of 10, 20, 50 or 100 questions and cards.

### 📚 Study together
On the home page, press **Study together**, pick two or more decks and study them as one, for example chapters 1 to 3 before an exam.

---

## Sharing with a class

On a deck page, press **Share** to copy a link like this one:

```
https://aruneshmishra.github.io/flash-master/?sheet=<your sheet link>
```

Students who open it go straight to the deck. Each student's progress is stored privately in their own browser.

## Privacy

There are no accounts and no server. Your sheet is downloaded straight from Google into your browser. Progress, stars, review dates, streaks and best scores are kept in your browser's local storage on this device. They don't move between devices, and clearing your browsing data resets them.

---

## Developing

The app is plain HTML, CSS and JavaScript modules, with no build step. GitHub Pages serves the repository as-is.

```bash
npm install          # only needed for the browser tests
npm start            # http://localhost:5173
npm run test:unit    # logic tests (Node's built-in test runner)
npm run test:e2e     # browser tests (Playwright, uses your installed Chrome)
```

```
index.html
css/style.css
js/
  app.js               router, theme, shared links
  lib/                 pure logic: csv, sheet, deck, grade, learn-engine, test-builder, store …
  views/               home, deck, flashcards, learn, test, review, games, match, meteor, streak
  data/samples.js      built-in sample decks
tests/unit             node:test specs for the logic
tests/e2e              Playwright specs that mock Google Sheets
```

---
*Created by [Arunesh Mishra](https://aruneshmishra.github.io/). Licensed under MIT.*
