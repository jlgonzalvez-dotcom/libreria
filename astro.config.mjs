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
  // maxDuration: la generación de sinopsis (fuentes + IA) puede pasar de los
  // 10 s por defecto de las funciones de Vercel; les damos hasta 60 s.
  adapter: vercel({ maxDuration: 60 }),

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
      // Clave propia (gratuita) de Google Books. OPCIONAL: si está, el
      // autocompletado por ISBN/título usa tu cuota propia (~1.000/día) en vez
      // de la compartida que se agota (error 429). Si falta, funciona igual con
      // la cuota compartida. Se genera en Google Cloud (API "Books API").
      GOOGLE_BOOKS_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Clave de la API de Claude (Anthropic) para redactar sinopsis. OPCIONAL:
      // sin ella todo funciona igual, solo se desactiva el botón "Redactar con
      // IA" y la página /admin/sinopsis lo avisa. Se crea en
      // https://console.anthropic.com (requiere cargar un pequeño saldo).
      ANTHROPIC_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Secreto del cron de Vercel (copia de seguridad semanal). OPCIONAL: sin
      // él, /api/copia-seguridad responde 503 y no hay copia automática. Vercel
      // manda esta variable como cabecera Authorization en cada ejecución.
      CRON_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
