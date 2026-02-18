/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          faint: 'rgb(var(--color-text-faint) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          hover: 'rgb(var(--color-brand-hover) / <alpha-value>)',
          soft: 'rgb(var(--color-brand-soft) / <alpha-value>)',
          contrast: 'rgb(var(--color-brand-contrast) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          hover: 'rgb(var(--color-success-hover) / <alpha-value>)',
          soft: 'rgb(var(--color-success-soft) / <alpha-value>)',
          contrast: 'rgb(var(--color-success-contrast) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
          hover: 'rgb(var(--color-warning-hover) / <alpha-value>)',
          soft: 'rgb(var(--color-warning-soft) / <alpha-value>)',
          contrast: 'rgb(var(--color-warning-contrast) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          hover: 'rgb(var(--color-danger-hover) / <alpha-value>)',
          soft: 'rgb(var(--color-danger-soft) / <alpha-value>)',
          contrast: 'rgb(var(--color-danger-contrast) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--color-info) / <alpha-value>)',
          hover: 'rgb(var(--color-info-hover) / <alpha-value>)',
          soft: 'rgb(var(--color-info-soft) / <alpha-value>)',
          contrast: 'rgb(var(--color-info-contrast) / <alpha-value>)',
        },
      },
      borderRadius: {
        panel: 'var(--radius-panel)',
        control: 'var(--radius-control)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        float: 'var(--shadow-float)',
        focus: 'var(--shadow-focus)',
      },
      fontFamily: {
        sans: [
          '"Source Sans 3"',
          '"Noto Sans"',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Noto Sans CJK SC"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
