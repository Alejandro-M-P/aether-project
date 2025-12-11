// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
// import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
/** @type {import('astro').AstroUserConfig} */
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [], 
    
    // Mantenemos la lista mínima de noExternal, pero la degradación de three.js
    // es lo que realmente resolverá el problema de "./webgpu".
    ssr: {
      noExternal: ['three', 'react-globe.gl', 'three-globe']
    }
  }
});