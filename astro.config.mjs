// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()], 

  vite: {
    // Mantenemos la única configuración que resuelve el problema de three.js
    ssr: {
      noExternal: ['three', 'react-globe.gl', 'three-globe']
    },

    plugins: [tailwindcss()]
  }
});