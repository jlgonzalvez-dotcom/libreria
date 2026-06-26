// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // Dominio donde se publica el catálogo (para URLs canónicas, sitemap, etc.).
  site: 'https://lalibreriadejl.vercel.app',

  // SSR: las páginas se renderizan en el servidor (leen de la base de datos
  // en cada petición). El panel /admin necesita esto para guardar libros.
  output: 'server',
  adapter: vercel(),

  // Astro activa por defecto una comprobación anti-CSRF por Origin que, tras el
  // proxy de Vercel, rechaza todos los POST de formularios (403). La desactivamos:
  // la protección CSRF ya la dan las cookies de sesión con SameSite=Lax.
  security: { checkOrigin: false },

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
