// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Solo dejamos la integración de React.
  integrations: [react()],

  // Eliminamos completamente el bloque 'vite'. 
  // Esto resuelve el error de ERESOLVE y el de TS2322.
  // Tailwind se activará automáticamente porque está instalado 
  // y se importa en src/styles/global.css.
});