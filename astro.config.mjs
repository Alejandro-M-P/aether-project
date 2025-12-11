// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // FIX para el error "Missing "./webgpu" specifier in "three" package"
    // Forzamos a Vite a no externalizar estas dependencias durante el SSR.
    ssr: {
      noExternal: ['three', 'react-globe.gl', 'three-globe']
    }
    // Se elimina la configuración "resolve.alias" para "three"
    // para que Vite/Node pueda usar la resolución estándar de módulos.
  }
});