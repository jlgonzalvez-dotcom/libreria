// Dominios cuyas portadas puede optimizar Vercel (redimensionar a WebP/AVIF).
//
// La lista tiene que coincidir con `imagesConfig.remotePatterns` de
// astro.config.mjs: si a `<Image>` le llega una URL de un dominio que no está
// autorizado, revienta el renderizado de esa tarjeta. Como las portadas pueden
// venir de fuera (Google Books, Open Library) al autocompletar por ISBN, aquí
// se comprueba antes: lo que no se pueda optimizar se sirve tal cual con un
// <img> normal. Peor rendimiento en esas pocas, pero nunca una imagen rota.
// Solo el almacén propio. Se probó a incluir covers.openlibrary.org y
// books.google.com y no vale la pena: responden con redirecciones y con
// imágenes de relleno que el optimizador no sabe procesar, y la portada se
// quedaba rota (10 de 234 en la prueba). Como son minoría —206 de 234 están en
// nuestro bucket— se sirven tal cual, igual que antes de todo esto.
const DOMINIOS_OPTIMIZABLES = ['tetezdhsxshxhneknxnp.supabase.co'];

/** ¿Se puede pasar esta portada por el optimizador de imágenes? */
export function portadaOptimizable(url?: string | null): boolean {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && DOMINIOS_OPTIMIZABLES.includes(hostname);
  } catch {
    return false; // URL relativa o mal formada: se sirve tal cual
  }
}
