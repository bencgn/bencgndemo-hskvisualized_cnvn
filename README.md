# HSK Words Visualized

Interactive HSK 1-6 vocabulary chart based on the provided visual PDF/PNG layout.

The app displays 5,000 HSK words in the same color-block structure as the reference chart. Click any Chinese word to view pinyin, Vietnamese meaning, and English source meaning. The chart supports pan and deep zoom for exploring dense areas.

## Features

- HSK 1-6 chart with the original visual grouping:
  - HSK 1: 150 words
  - HSK 2: 150 words
  - HSK 3: 300 words
  - HSK 4: 600 words
  - HSK 5: 1,300 words
  - HSK 6: 2,500 words
- Total: 5,000 words
- Click word tiles to show:
  - Chinese
  - pinyin
  - Vietnamese meaning
  - English source meaning
- Search by Chinese, pinyin, Vietnamese, or English
- Filter by HSK level
- Pan and zoom chart interaction
- Static HTML/CSS/JS, deployable on GitHub Pages

## Run Locally

```powershell
cd C:\Users\b\Desktop\hsk-words-visualized\web
node server.js
```

Open:

```text
http://localhost:4173/
```

You can also use:

```text
http://127.0.0.1:4173/
```

## Project Files

- `index.html` - page structure
- `styles.css` - visual layout, colors, responsive UI
- `app.js` - chart rendering, search/filter, click, pan, zoom
- `hsk-vocab.json` - generated vocabulary data used by the app
- `server.js` - small local static server
- `scripts/extract-pdf-words.py` - extracts word order and HSK block layout from the PDF
- `scripts/build-data.js` - builds final JSON with pinyin and translations
- `hsk-words-visualized.pdf` - source chart PDF
- `hsk-words-visualized_page_1.png` - visual reference image

## Rebuild Data

The JSON is generated from the PDF layout, then enriched with pinyin and Vietnamese definitions.

```powershell
python scripts/extract-pdf-words.py
node scripts/build-data.js
```

This creates/updates:

```text
pdf-hsk-words.json
hsk-vocab.json
```

Expected counts:

```text
HSK1:150 HSK2:150 HSK3:300 HSK4:600 HSK5:1300 HSK6:2500
```

## Deploy To GitHub Pages

This is a static site, so GitHub Pages can host it directly.

```powershell
git init
git add .
git commit -m "Build interactive HSK words chart"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then in GitHub:

1. Open the repository settings.
2. Go to `Pages`.
3. Choose `Deploy from a branch`.
4. Select branch `main`.
5. Select folder `/root`.
6. Save.

The site will be available at:

```text
https://YOUR_USERNAME.github.io/YOUR_REPO/
```

## Data Sources

- Source layout: local `hsk-words-visualized.pdf`
- HSK/pinyin/English enrichment: `complete-hsk-vocabulary`
- Vietnamese meanings: `CVDICT`

## Notes

The PDF is treated as the source of truth for word order and HSK color block placement. External vocabulary data is used only to enrich each extracted word with pinyin, Vietnamese, and English meanings.
