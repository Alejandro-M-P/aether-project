// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()], 

  vite: {
    // Mantenemos la única configuración que resuelve el problema original de three.js
    ssr: {
      noExternal: ['three', 'react-globe.gl', 'three-globe']
    }
  }
});