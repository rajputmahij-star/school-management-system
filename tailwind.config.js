/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary — Orange (school name color)
        primary: {
          50:  '#fff4e6',
          100: '#ffe4bc',
          200: '#ffc980',
          300: '#ffad42',
          400: '#ff9414',
          500: '#E86E07',
          600: '#d06006',
          700: '#b05005',
          800: '#8a3e04',
          900: '#6b3003',
          950: '#3d1a01',
        },
        // Navy — sidebar, dark backgrounds
        navy: {
          50:  '#eef1fb',
          100: '#d5dcf4',
          200: '#adb9ea',
          300: '#7d93da',
          400: '#4e6eca',
          500: '#16377A',
          600: '#132f69',
          700: '#0f2557',
          800: '#0b1b40',
          900: '#07112a',
          950: '#040a18',
        },
        // Forest green — success states
        forest: {
          50:  '#e6f4ec',
          100: '#c0e4ce',
          200: '#85c9a0',
          300: '#4aae72',
          400: '#1e9450',
          500: '#095D30',
          600: '#074f29',
          700: '#054020',
          800: '#033118',
          900: '#02210f',
        },
        // Lime — secondary accent
        lime: {
          50:  '#f5fadf',
          100: '#e8f4b0',
          200: '#d3ec73',
          300: '#bde236',
          400: '#a8d60f',
          500: '#95BD0B',
          600: '#7ea009',
          700: '#668207',
          800: '#4e6405',
          900: '#374603',
        },
        // Pink — highlight
        blush: {
          50:  '#fff0f5',
          100: '#ffd6e5',
          200: '#ffaecb',
          300: '#ff85b1',
          400: '#fe7ba9',
          500: '#fd5e93',
          600: '#e0437a',
          700: '#c22b62',
          800: '#9e184c',
          900: '#7a0d39',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #16377A 0%, #095D30 100%)',
        'brand-gradient-h': 'linear-gradient(90deg, #16377A 0%, #095D30 100%)',
        'orange-gradient': 'linear-gradient(135deg, #E86E07 0%, #ff9414 100%)',
      },
    },
  },
  plugins: [],
}
