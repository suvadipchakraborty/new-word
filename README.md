# Lexicon – Vocabulary Flashcards

Zero-build PWA: plain HTML, CSS and JS. Definitions and audio come from the [Free Dictionary API](https://dictionaryapi.dev).

## Add more words
All words live in **`words.csv`** in the repo root. Append new lines at the bottom, commit, and Cloudflare redeploys. Duplicate words are ignored automatically.
Open `words.csv` and add one word per line using the columns `word,difficulty,category` (no commas inside values):

    ubiquitous,Advanced,General

If you change shell files (`app.js`, `styles.css`, etc.), bump `V` in `sw.js` (e.g. `lexicon-v3`) so returning users get the update.

## Deploy to Cloudflare Pages
Push this folder to GitHub. In Cloudflare Pages, connect the repo, leave the build command empty and set the output directory to `/`.

## Social preview
`preview.png` is 1200×630. Replace it with your own; for best results change the `og:image` meta tags to your absolute site URL.
