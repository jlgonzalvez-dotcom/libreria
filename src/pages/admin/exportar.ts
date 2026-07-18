import type { APIRoute } from 'astro';
import { listarLibros } from '../../lib/libros';
import { generarCsv } from '../../lib/exportacion';

// Copia de seguridad de toda la colección en un CSV, descargada al momento.
// (La generación del CSV vive en lib/exportacion.ts, compartida con la copia
// automática semanal de /api/copia-seguridad.)
export const GET: APIRoute = async () => {
  const csv = generarCsv(await listarLibros());
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="la-libreria-de-jl-${hoy}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
