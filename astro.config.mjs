// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite'; // <-- Re-importado

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    // ESTO VUELVE A ACTIVAR TAILWIND CSS
    plugins: [tailwindcss()], 
    
    // Eliminamos el ssr.noExternal porque ya degradamos three.js en package.json
  }
});