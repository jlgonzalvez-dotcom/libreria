import type { APIRoute } from 'astro';
import { listarLibros } from '../lib/libros';

// Mapa del sitio para los buscadores: la portada + todas las fichas de libro.
// Se genera al vuelo desde la base de datos (SSR), así siempre está al día.
export const GET: APIRoute = async ({ site }) => {
  const base = site?.href ?? 'https://lalibreriadejl.vercel.app/';
  const libros = await listarLibros();

  const urls = [
    `<url><loc>${base}</loc></url>`,
    ...libros.map((l) => {
      const lastmod = l.updated_at ? `<lastmod>${l.updated_at.slice(0, 10)}</lastmod>` : '';
      return `<url><loc>${base}libros/${l.slug}/</loc>${lastmod}</url>`;
    }),
  ].join('\n  ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>
`;

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
