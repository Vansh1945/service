export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Brand core accent definitions */
        primary: 'var(--color-primary)',       /* Teal - Selected states, navigation tags, action triggers */
        background: 'var(--color-background)', /* White - Base layout frames and page shells */
        secondary: 'var(--color-secondary)',   /* Dark Gray - Body headings and side navigation panels */
        accent: 'var(--color-accent)',         /* Orange - Urgent indicators and CTA button highlighting */
        
        /* Neutral palette scale mapping to global CSS tokens */
        neutral: {
          50: 'var(--color-neutral-50)',   /* Background shade for sections/tables */
          100: 'var(--color-neutral-100)', /* Cards borders, dividers, hover backgrounds */
          200: 'var(--color-neutral-200)', /* General input outlines and thin borders */
          300: 'var(--color-neutral-300)', /* Muted icons, disabled buttons elements */
          400: 'var(--color-neutral-400)', /* Secondary details and caption texts */
          500: 'var(--color-neutral-500)', /* Default description text color */
          600: 'var(--color-neutral-600)', /* Medium contrast labels and active icons */
          700: 'var(--color-neutral-700)', /* High contrast text, titles, sidebar items */
          800: 'var(--color-neutral-800)', /* Primary page titles and header blocks */
          900: 'var(--color-neutral-900)', /* Dense black for bold callouts */
        },
        gray: {
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
        slate: {
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
        
        /* Standard system notification/alert status values */
        danger: {
          DEFAULT: 'var(--color-danger)',      /* Red - Warning flags, delete actions, errors */
          light: 'var(--color-danger-light)',  /* Soft Red - Badge background fills */
        },
        success: {
          DEFAULT: 'var(--color-success)',      /* Green - Done triggers, successful balances */
          light: 'var(--color-success-light)',  /* Soft Green - Complete badges fills */
        },
        warning: {
          DEFAULT: 'var(--color-warning)',      /* Amber - Pending tasks alert, feedback stars */
          light: 'var(--color-warning-light)',  /* Soft Amber - Pending statuses badge background */
        },
        info: {
          DEFAULT: 'var(--color-info)',         /* Blue - Tips, instruction headers, info notes */
          light: 'var(--color-info-light)',     /* Soft Blue - Announcement panels background */
        },
      },
      borderRadius: {
        /* Component corner scaling system */
        sm: 'var(--radius-sm)',     /* Checkboxes, toggle switches */
        md: 'var(--radius-md)',     /* Micro labels, status tags, inline buttons */
        lg: 'var(--radius-lg)',     /* Standard buttons, input frames, card elements */
        xl: 'var(--radius-xl)',     /* Section widgets, input textareas, category panels */
        '2xl': 'var(--radius-2xl)', /* Modals, large layouts, action popup overlays */
        '3xl': 'var(--radius-3xl)', /* Accent pages, login boxes */
        full: 'var(--radius-full)', /* Circular profile frames, active notification pills */
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        roboto: ['Roboto', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-up': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'scale-up': 'scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-up': 'slide-up 0.3s ease-out forwards',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      }
    },
  },
  plugins: [],
}
