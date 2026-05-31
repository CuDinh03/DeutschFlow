/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0D0D0D',
          card: '#1A1A1A',
          border: '#2A2A2A',
          yellow: '#F5C842',
          red: '#E63946',
          blue: '#3A86FF',
          green: '#2DC653',
          muted: '#64748B',
          white: '#FFFFFF',
          'white-60': 'rgba(255,255,255,0.6)',
          'white-30': 'rgba(255,255,255,0.3)',
          'white-10': 'rgba(255,255,255,0.1)',
        },
        // CEFR gender colors (mirror web)
        der: '#3A86FF',
        die: '#E63946',
        das: '#2DC653',
      },
      fontFamily: {
        sans: ['Inter-Regular'],
        'sans-medium': ['Inter-Medium'],
        'sans-semibold': ['Inter-SemiBold'],
        'sans-bold': ['Inter-Bold'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
    },
  },
  plugins: [],
}
