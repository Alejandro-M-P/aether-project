// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
// import tailwindcss from '@tailwindcss/vite'; // <--- ELIMINADO

// https://astro.build/config
/** @type {import('astro').AstroUserConfig} */ // <--- CORREGIDO
export default defineConfig({
  integrations: [react()],

  vite: {
    // Se elimina el uso de 'tailwindcss()' de los plugins para corregir TS2322
    plugins: [], 
    
    // Mantener el FIX original para el error de THREE.JS (Missing "./webgpu")
    ssr: {
      noExternal: ['three', 'react-globe.gl', 'three-globe']
    }
  }
});