/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.5s ease-in-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      colors: {
        // Material 3 Color Scheme
        primary: {
          DEFAULT: '#6750A4',
          50: '#F5F1FF',
          100: '#EBE3FF',
          200: '#D7C7FF',
          300: '#C3ABFF',
          400: '#AF8FFF',
          500: '#9B73FF',
          600: '#6750A4',
          700: '#4F378B',
          800: '#371E73',
          900: '#1F115A',
        },
        secondary: {
          DEFAULT: '#625B71',
          50: '#F5F2FA',
          100: '#EBE5F5',
          200: '#D7CBEB',
          300: '#C3B1E1',
          400: '#AF97D7',
          500: '#9B7DCD',
          600: '#625B71',
          700: '#4A4458',
          800: '#322D40',
          900: '#1A1627',
        },
        tertiary: {
          DEFAULT: '#7D5260',
          50: '#FFF8F9',
          100: '#FFF0F2',
          200: '#FFD9E0',
          300: '#FFC2CE',
          400: '#FFABBC',
          500: '#FF94AA',
          600: '#7D5260',
          700: '#5E3E4A',
          800: '#3F2933',
          900: '#20151D',
        },
        error: {
          DEFAULT: '#B3261E',
          50: '#FCEEEE',
          100: '#F9DEDC',
          200: '#F2B8B5',
          300: '#EC928E',
          400: '#E56C67',
          500: '#DF4640',
          600: '#B3261E',
          700: '#8C1D17',
          800: '#65140F',
          900: '#3E0A08',
        },
        surface: {
          DEFAULT: '#FFFBFE',
          variant: '#E7E0EC',
          dim: '#DED8E1',
          bright: '#FEF7FF',
        },
        outline: {
          DEFAULT: '#79747E',
          variant: '#CAC4D0',
        },
      },
    },
  },
  plugins: [],
}
