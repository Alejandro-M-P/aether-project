/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,js,jsx,ts,tsx}', 
  ],
  theme: {
    extend: {
      // 1. COLORES: Centralización de la paleta.
      colors: {
        'bg-primary': '#000000',      // Fondo principal (negro)
        'text-primary': '#ffffff',    // Texto principal (blanco)
        'scrollbar-track': '#09090b',
        'scrollbar-thumb': '#27272a',
        'scrollbar-thumb-hover': '#3f3f46',
      },
      
      // 2. TIPOGRAFÍA: Definir una fuente base.
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], 
        mono: ['Fira Code', 'monospace'],
      },
      
      // 3. BORDER-RADIUS: Escala consistente de curvatura.
      borderRadius: {
        'none': '0',
        'sm': '4px',
        'md': '8px',    // ESTÁNDAR PARA BOTONES/INPUTS DE MODAL
        'lg': '12px',   // ESTÁNDAR PARA ITEMS DE MENÚ
        'xl': '16px',   // ESTÁNDAR PARA CONTENEDORES DE MODAL
        'full': '9999px', // ESTÁNDAR PARA BOTONES FLOTANTES
      },
      
      // 4. BOX-SHADOW: Sombras unificadas.
      boxShadow: {
        'md-dark': '0 4px 6px -1px rgba(255, 255, 255, 0.05), 0 2px 4px -2px rgba(255, 255, 255, 0.05)',
        'terminal-cyan': '0 0 20px rgba(6, 182, 212, 0.4)', // Sombra para modales
        'terminal-green': '0 0 20px rgba(16, 185, 129, 0.4)', // Sombra para botones de acción
      },
    },
  },
  plugins: [],
}