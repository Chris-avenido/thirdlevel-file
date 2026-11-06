import { readFileSync } from 'node:fs';

// Colors come from src/theme/tailwind-colors.json, generated from the InsightED tokens.
const colors = JSON.parse(readFileSync(new URL('./src/theme/tailwind-colors.json', import.meta.url), 'utf8'));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ['var(--font-body)'],
        heading: ['var(--font-heading)'],
      }
    },
  },
  plugins: [],
}
