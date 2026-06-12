// tailwind.config.js
function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variableName}) / ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Brand core accent definitions */
        primary: withOpacity('--color-primary-rgb'),       /* Teal - Selected states, navigation tags, action triggers */
        background: withOpacity('--color-background-rgb'), /* White - Base layout frames and page shells */
        secondary: withOpacity('--color-secondary-rgb'),   /* Dark Gray - Body headings and side navigation panels */
        accent: withOpacity('--color-accent-rgb'),         /* Orange - Urgent indicators and CTA button highlighting */
        
        /* Neutral palette scale mapping to global CSS tokens */
        neutral: {
          50: withOpacity('--color-neutral-50-rgb'),   /* Background shade for sections/tables */
          100: withOpacity('--color-neutral-100-rgb'), /* Cards borders, dividers, hover backgrounds */
          200: withOpacity('--color-neutral-200-rgb'), /* General input outlines and thin borders */
          300: withOpacity('--color-neutral-300-rgb'), /* Muted icons, disabled buttons elements */
          400: withOpacity('--color-neutral-400-rgb'), /* Secondary details and caption texts */
          500: withOpacity('--color-neutral-50-rgb'), /* Default description text color */
          600: withOpacity('--color-neutral-600-rgb'), /* Medium contrast labels and active icons */
          700: withOpacity('--color-neutral-700-rgb'), /* High contrast text, titles, sidebar items */
          800: withOpacity('--color-neutral-800-rgb'), /* Primary page titles and header blocks */
          900: withOpacity('--color-neutral-900-rgb'), /* Dense black for bold callouts */
        },
        gray: {
          50: withOpacity('--color-neutral-50-rgb'),
          100: withOpacity('--color-neutral-100-rgb'),
          200: withOpacity('--color-neutral-200-rgb'),
          300: withOpacity('--color-neutral-300-rgb'),
          400: withOpacity('--color-neutral-400-rgb'),
          500: withOpacity('--color-neutral-50-rgb'),
          600: withOpacity('--color-neutral-600-rgb'),
          700: withOpacity('--color-neutral-700-rgb'),
          800: withOpacity('--color-neutral-800-rgb'),
          900: withOpacity('--color-neutral-900-rgb'),
        },
        slate: {
          50: withOpacity('--color-neutral-50-rgb'),
          100: withOpacity('--color-neutral-100-rgb'),
          200: withOpacity('--color-neutral-200-rgb'),
          300: withOpacity('--color-neutral-300-rgb'),
          400: withOpacity('--color-neutral-400-rgb'),
          500: withOpacity('--color-neutral-50-rgb'),
          600: withOpacity('--color-neutral-600-rgb'),
          700: withOpacity('--color-neutral-700-rgb'),
          800: withOpacity('--color-neutral-800-rgb'),
          900: withOpacity('--color-neutral-900-rgb'),
        },
        
        /* Standard system notification/alert status values */
        danger: {
          DEFAULT: withOpacity('--color-danger-rgb'),      /* Red - Warning flags, delete actions, errors */
          light: withOpacity('--color-danger-light-rgb'),  /* Soft Red - Badge background fills */
        },
        success: {
          DEFAULT: withOpacity('--color-success-rgb'),      /* Green - Done triggers, successful balances */
          light: withOpacity('--color-success-light-rgb'),  /* Soft Green - Complete badges fills */
        },
        warning: {
          DEFAULT: withOpacity('--color-warning-rgb'),      /* Amber - Pending tasks alert, feedback stars */
          light: withOpacity('--color-warning-light-rgb'),  /* Soft Amber - Pending statuses badge background */
        },
        info: {
          DEFAULT: withOpacity('--color-info-rgb'),         /* Blue - Tips, instruction headers, info notes */
          light: withOpacity('--color-info-light-rgb'),     /* Soft Blue - Announcement panels background */
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
