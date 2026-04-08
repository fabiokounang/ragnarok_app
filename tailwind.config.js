/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs', './public/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        robody: ['Cormorant', 'Georgia', 'serif'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        launch: {
          sky: '#8ec5eb',
          skydeep: '#4a8ec2',
          royal: '#1a4a7a',
          deep: '#0c2847',
          ink: '#0f2138',
          parchment: '#f4ead8',
          gold: '#e8b923',
          goldbright: '#f5d547',
          field: '#3d8f5a',
          mist: '#c5ddf0',
          glass: 'rgba(12, 42, 72, 0.38)',
        },
        ro: {
          night: '#070a10',
          deep: '#0c1220',
          panel: '#121a2c',
          rise: '#1a2740',
          mist: '#8ba3c4',
          gold: '#c9a227',
          goldbright: '#e8c547',
          ink: '#040608',
          cream: '#ede4d3',
          wine: '#4a1c2c',
          arcane: '#6b8cce',
        },
      },
      boxShadow: {
        'panel': '0 4px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        'gold': '0 0 0 1px rgba(201, 162, 39, 0.35), 0 0 28px rgba(201, 162, 39, 0.08)',
        'nav': '0 -8px 32px rgba(0, 0, 0, 0.45)',
      },
      backgroundImage: {
        'ro-main':
          'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(107, 140, 206, 0.12) 0%, transparent 50%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(201, 162, 39, 0.06) 0%, transparent 45%), linear-gradient(180deg, #0a0f18 0%, #0c1220 40%, #080c14 100%)',
        'card-shine':
          'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 42%, transparent 100%)',
      },
    },
  },
  plugins: [],
};
