// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind'; 

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()], 

  vite: {
    // Mantenemos la única configuración que resuelve el problema de three.js
    ssr: {
      noExternal: ['three', 'react-globe.gl', 'three-globe']
    }
  }
});