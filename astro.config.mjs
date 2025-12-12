// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind'; // <-- Importar la integración oficial

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()], // <-- Añadir tailwind() aquí

  // Si no tienes otros plugins, elimina la sección vite:
  // vite: {} 
});