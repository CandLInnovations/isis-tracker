import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#fdf8f0',
        bark: {
          50:  '#fdf6ee',
          100: '#f5e8d4',
          200: '#e8cba8',
          300: '#d4a574',
          400: '#c08040',
          500: '#a86028',
          600: '#8b4513',
          700: '#6b340f',
          800: '#4a240b',
          900: '#2d1507',
        },
        moss: {
          50:  '#f0f5ec',
          100: '#d4e6cb',
          200: '#a8cc96',
          300: '#78b061',
          400: '#519437',
          500: '#3d7228',
          600: '#2d5216',
          700: '#1f3a0e',
          800: '#112208',
          900: '#071004',
        },
        amber: {
          100: '#fef3c7',
          400: '#fbbf24',
          600: '#d97706',
          700: '#b45309',
        },
        rose: {
          100: '#ffe4e6',
          500: '#f43f5e',
          700: '#be123c',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans:  ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}

export default config
