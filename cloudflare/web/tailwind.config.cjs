/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#1a1a1a',
        'bg-tertiary': '#2a2a2a',
        'wordle-green': '#6aaa64',
        'wordle-yellow': '#c9b458',
        'accent-blue': '#1e90ff',
        'accent-purple': '#a855f7',
        'text-primary': '#fdfdfd',
        'text-secondary': '#9ca3af',
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
