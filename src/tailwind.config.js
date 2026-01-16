// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // important pour Angular
  ],
  theme: {
    extend: {
      colors: {
        'pharma-blue': '#1e40af',
        'pharma-blue-dark': '#1e3a8a',
        'pharma-teal': '#14b8a6',
      }
    }
  },
  plugins: [],
}
