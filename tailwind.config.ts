import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        surface: '#ffffff',
        muted: '#64748b',
      },
    },
  },
  plugins: [],
};

export default config;
