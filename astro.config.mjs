// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // Cambia esto cuando definas el dominio donde se publicará el catálogo.
  site: 'https://example.com',

  // SSR: las páginas se renderizan en el servidor (leen de la base de datos
  // en cada petición). El panel /admin necesita esto para guardar libros.
  output: 'server',
  adapter: vercel(),

  // Variables de entorno tipadas y validadas (Astro las exige al arrancar).
  // Se definen en el archivo .env (local) y en el panel de Vercel (producción).
  env: {
    schema: {
      // Conexión a Supabase (servidor, secretas)
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret' }),
      // Acceso al panel /admin
      ADMIN_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
      // Secreto para firmar la cookie de sesión del admin
      AUTH_SECRET: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
