import type { APIRoute } from 'astro';
import { listarLibrosPublicos } from '../lib/libros';

// Mapa del sitio para los buscadores: la portada + todas las fichas de libro,
// en los dos idiomas. Cada entrada declara sus alternativas (hreflang) para que
// Google entienda que español e inglés son la misma página en dos versiones y
// le ofrezca a cada visitante la suya.
// Se genera al vuelo desde la base de datos (SSR), así siempre está al día.
export const GET: APIRoute = async ({ site }) => {
  const base = site?.href ?? 'https://lalibreriadejl.vercel.app/';
  const libros = await listarLibrosPublicos();

  // camino: ruta sin barra inicial ('' para la portada, 'libros/x/' para fichas)
  const entrada = (camino: string, lastmod = '') => {
    const es = `${base}${camino}`;
    const en = `${base}en/${camino}`;
    const alternativas = [
      `<xhtml:link rel="alternate" hreflang="es" href="${es}"/>`,
      `<xhtml:link rel="alternate" hreflang="en" href="${en}"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${es}"/>`,
    ].join('');
    // Una entrada por idioma, ambas con la misma lista de alternativas.
    return [es, en]
      .map((loc) => `<url><loc>${loc}</loc>${lastmod}${alternativas}</url>`)
      .join('\n  ');
  };

  const urls = [
    entrada(''),
    ...libros.map((l) =>
      entrada(`libros/${l.slug}/`, l.updated_at ? `<lastmod>${l.updated_at.slice(0, 10)}</lastmod>` : ''),
    ),
  ].join('\n  ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${urls}
</urlset>
`;

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
