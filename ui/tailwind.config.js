/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deped-blue': '#0038A8',
        'deped-red': '#CE1126',
        'insight-navy': '#08315F',
        'insight-blue': '#075985',
        'insight-gold': '#FBBF24',
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        heading: ['var(--font-heading)'],
      }
    },
  },
  plugins: [],
}
