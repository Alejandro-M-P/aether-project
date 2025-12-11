// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // FIX: Resuelve problemas de importación profunda de THREE.js 
    // forzando el uso del módulo principal para evitar errores como "./webgpu"
    resolve: {
      alias: {
        'three': 'three/build/three.module.js',
      },
    },
  }
});