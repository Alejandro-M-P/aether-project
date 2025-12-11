// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
// import tailwindcss from '@tailwindcss/vite'; <-- ELIMINADO para evitar el TS2322

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    // La clave 'plugins' eliminada para evitar el error TS2322.
    // Astro generará Tailwind automáticamente porque está en package.json
  }
});