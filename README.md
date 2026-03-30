## Allergy Detector (React + Firebase)

Client app built with Create React App + TypeScript. It uses:
- **Firebase** for auth + Firestore
- **Gemini API** for ingredient cleanup + clinical-style summaries
- **API Ninjas** (`imagetotext`) for OCR from label photos
- **OpenFoodFacts** for barcode → product/ingredients lookup (no key required)

## Run locally

Install and start:

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Environment variables

Create a `.env` file in the project root (do **not** commit it):

```bash
REACT_APP_GEMINI_API_KEY=YOUR_GEMINI_KEY_HERE
REACT_APP_API_NINJAS_KEY=K5j9BQ5tst4tX5LYvHj1XQ==9cihtgtz6eD4DL0s
```

After editing `.env`, **restart** `npm start` (Create React App only reads env vars on startup).

## Barcode scanning (how it works)

When you enter a barcode (UPC/EAN) in the app:

- The app calls OpenFoodFacts:
  - `https://world.openfoodfacts.org/api/v0/product/{BARCODE}.json`
- It extracts ingredients from either:
  - `product.ingredients[]` (structured) or
  - `product.ingredients_text_en` / `product.ingredients_text` (fallback)
- It also reads `product.allergens_tags` (when available).
- It sends the raw ingredient text to **Gemini** to normalize it into a clean, comma-separated ingredient list.
- It merges the cleaned ingredient list + allergen tags into the product’s `commonList`, deduped.

OpenFoodFacts is used as a **public** API here (no API key required).

## Pushing to GitHub

1) Make sure secrets are not committed:
- Keep `.env` local (add it to `.gitignore` if it isn’t already).
- Never commit API keys.

2) Initialize git (skip if already a repo):

```bash
git init
git add .
git commit -m "Initial commit"
```

3) Create a GitHub repo, then add the remote and push:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

If you already have commits, just do:

```bash
git push -u origin main
```

## Scripts

```bash
npm start
npm test
npm run build
```
# allergen-ai
