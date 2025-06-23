/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#22577A', // A professional, slightly muted blue/teal
          light: '#5BA8A0',
          dark: '#1C3A5A',
          darker: '#162C40',
        },
        secondary: {
          DEFAULT: '#FFC107', // A subtle accent, golden yellow
          light: '#FFEB3B',
          dark: '#FF8F00',
        },
        neutral: {
          '50': '#F8FAFC',  // Lightest background for body/base
          '100': '#F1F5F9', // Slightly darker for cards/components background
          '200': '#E2E8F0', // Border/separator lines
          '300': '#CBD5E1', // More pronounced borders
          '400': '#94A3B8', // Placeholder text
          '500': '#64748B', // Default text color
          '600': '#475569', // Stronger text/icons
          '700': '#334155', // Darker text/headings
          '800': '#1E293B', // Very dark text/sidebar background
          '900': '#0F172A', // Deepest dark for elements like sidebar/footer
        },
        status: {
          'in-progress': '#FBBF24', // Yellow for in-progress
          'blocked': '#DC2626',     // Red for blocked
          'done': '#22C55E',        // Green for done
          'to-do': '#94A3B8',       // Gray for to-do/backlog
          'open': '#3B82F6',        // Blue for general open/active (e.g., in sprints)
        },
      },
    },
  },
  plugins: [],
}

