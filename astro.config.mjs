// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind'; // <-- Necesitarías instalar esta dependencia

// https://astro.build/config
export default defineConfig({
  // CAMBIO CLAVE: Usamos la integración oficial de Astro para Tailwind
  integrations: [react(), tailwind()], 

  // Mantenemos la solución para el error de three.js (degradación)
  vite: {
    ssr: {
      noExternal: ['three', 'react-globe.gl', 'three-globe']
    }
  }
});