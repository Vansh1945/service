const withOpacity = (variableName) => {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variableName}) calc(${opacityValue} * 100%), transparent)`;
    }
    return `var(${variableName})`;
  };
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Brand core accent definitions */
        primary: withOpacity('--color-primary'),       /* Teal - Selected states, navigation tags, action triggers */
        background: withOpacity('--color-background'), /* White - Base layout frames and page shells */
        secondary: withOpacity('--color-secondary'),   /* Dark Gray - Body headings and side navigation panels */
        accent: withOpacity('--color-accent'),         /* Orange - Urgent indicators and CTA button highlighting */
        
        /* Neutral palette scale mapping to global CSS tokens */
        neutral: {
          50: withOpacity('--color-neutral-50'),   /* Background shade for sections/tables */
          100: withOpacity('--color-neutral-100'), /* Cards borders, dividers, hover backgrounds */
          200: withOpacity('--color-neutral-200'), /* General input outlines and thin borders */
          300: withOpacity('--color-neutral-300'), /* Muted icons, disabled buttons elements */
          400: withOpacity('--color-neutral-400'), /* Secondary details and caption texts */
          500: withOpacity('--color-neutral-500'), /* Default description text color */
          600: withOpacity('--color-neutral-600'), /* Medium contrast labels and active icons */
          700: withOpacity('--color-neutral-700'), /* High contrast text, titles, sidebar items */
          800: withOpacity('--color-neutral-800'), /* Primary page titles and header blocks */
          900: withOpacity('--color-neutral-900'), /* Dense black for bold callouts */
        },
        gray: {
          50: withOpacity('--color-neutral-50'),
          100: withOpacity('--color-neutral-100'),
          200: withOpacity('--color-neutral-200'),
          300: withOpacity('--color-neutral-300'),
          400: withOpacity('--color-neutral-400'),
          500: withOpacity('--color-neutral-500'),
          600: withOpacity('--color-neutral-600'),
          700: withOpacity('--color-neutral-700'),
          800: withOpacity('--color-neutral-800'),
          900: withOpacity('--color-neutral-900'),
        },
        slate: {
          50: withOpacity('--color-neutral-50'),
          100: withOpacity('--color-neutral-100'),
          200: withOpacity('--color-neutral-200'),
          300: withOpacity('--color-neutral-300'),
          400: withOpacity('--color-neutral-400'),
          500: withOpacity('--color-neutral-500'),
          600: withOpacity('--color-neutral-600'),
          700: withOpacity('--color-neutral-700'),
          800: withOpacity('--color-neutral-800'),
          900: withOpacity('--color-neutral-900'),
        },
        
        /* Standard system notification/alert status values */
        danger: {
          DEFAULT: withOpacity('--color-danger'),      /* Red - Warning flags, delete actions, errors */
          light: withOpacity('--color-danger-light'),  /* Soft Red - Badge background fills */
        },
        success: {
          DEFAULT: withOpacity('--color-success'),      /* Green - Done triggers, successful balances */
          light: withOpacity('--color-success-light'),  /* Soft Green - Complete badges fills */
        },
        warning: {
          DEFAULT: withOpacity('--color-warning'),      /* Amber - Pending tasks alert, feedback stars */
          light: withOpacity('--color-warning-light'),  /* Soft Amber - Pending statuses badge background */
        },
        info: {
          DEFAULT: withOpacity('--color-info'),         /* Blue - Tips, instruction headers, info notes */
          light: withOpacity('--color-info-light'),     /* Soft Blue - Announcement panels background */
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
