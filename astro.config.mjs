// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // Se elimina la configuración "resolve.alias" para "three"
    // para que Vite/Node pueda usar la resolución estándar de módulos.
  }
});