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

    // FIX final para el error de THREE.JS (Missing "./webgpu").
    ssr: {
      noExternal: [
        'three', 
        'react-globe.gl', 
        'three-globe', 
        'globe.gl',
        '@tweenjs/tween.js', 
        'three-conic-polygon-geometry',
        'three-geojson-geometry'
      ]
    }
  }
});