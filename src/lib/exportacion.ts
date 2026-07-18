import type { Libro } from './libros';

// Generación del CSV de la colección (compartido por el botón "⬇ Copia de
// seguridad" de /admin y por la copia automática semanal).
//
// Se usa el separador ";" y se antepone un BOM UTF-8: así el archivo se abre
// con las columnas bien separadas y los acentos correctos al hacer doble clic
// en Numbers (Mac), en Excel en español (que usa ";" como separador de lista)
// y en Google Sheets (que detecta el separador solo). El comma decimal español
// también obliga a ";", no a ",".
const SEP = ';';

/** Envuelve un valor en comillas si contiene el separador, comillas o saltos de
 *  línea, duplicando las comillas internas (RFC 4180). Así una sinopsis con
 *  puntos y coma o saltos de línea no rompe las columnas. */
function celda(valor: unknown): string {
  const s = valor === null || valor === undefined ? '' : String(valor);
  return /["\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const siNo = (b: boolean) => (b ? 'Sí' : 'No');
const lista = (xs: string[] | null | undefined) => (xs ?? []).join(', ');
const soloFecha = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
// Precio con coma decimal (formato español), sin tocar los enteros.
const precioEs = (n: number | null) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

// Columnas del CSV: [encabezado, cómo sacar el valor de cada libro]. El orden va
// de lo más útil (identificación y datos del libro) a lo interno (metadatos).
const COLUMNAS: [string, (l: Libro) => unknown][] = [
  ['Título', (l) => l.titulo],
  ['Autor', (l) => l.autor],
  ['Autores adicionales', (l) => lista(l.autores_extra)],
  ['Categoría', (l) => l.categoria],
  ['Subcategorías', (l) => lista(l.subcategorias)],
  ['Etiquetas', (l) => lista(l.etiquetas)],
  ['Año de publicación', (l) => l.anio_publicacion ?? ''],
  ['Año de impresión', (l) => l.anio ?? ''],
  ['Edición', (l) => l.edicion ?? ''],
  ['Editorial', (l) => l.editorial ?? ''],
  ['Idioma', (l) => l.idioma],
  ['ISBN', (l) => l.isbn ?? ''],
  ['Páginas', (l) => l.paginas ?? ''],
  ['Formato', (l) => l.formato],
  ['Estado de lectura', (l) => l.estado],
  ['Valoración (estrellas)', (l) => l.valoracion ?? ''],
  ['Ejemplares', (l) => l.ejemplares],
  ['Ubicación', (l) => l.ubicacion ?? ''],
  ['Prestado a', (l) => l.prestado_a ?? ''],
  ['Prestado el', (l) => soloFecha(l.prestado_en)],
  ['En venta', (l) => siNo(l.en_venta)],
  ['Precio (€)', (l) => precioEs(l.precio)],
  ['Estado de conservación', (l) => l.estado_conservacion ?? ''],
  ['Sinopsis', (l) => l.sinopsis ?? ''],
  ['Reseña', (l) => l.resena ?? ''],
  ['Notas', (l) => l.notas ?? ''],
  ['Destacado', (l) => siNo(l.destacado)],
  ['Portada (URL)', (l) => l.portada ?? ''],
  ['Slug', (l) => l.slug],
  ['ID', (l) => l.id],
  ['Añadido', (l) => soloFecha(l.created_at)],
  ['Actualizado', (l) => soloFecha(l.updated_at)],
];

/** El CSV completo de la colección, con BOM UTF-8 y líneas CRLF. */
export function generarCsv(libros: Libro[]): string {
  const ordenados = [...libros].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  const lineas = [
    COLUMNAS.map(([encabezado]) => celda(encabezado)).join(SEP),
    ...ordenados.map((l) => COLUMNAS.map(([, obtener]) => celda(obtener(l))).join(SEP)),
  ];
  return '﻿' + lineas.join('\r\n') + '\r\n'; // BOM UTF-8 al inicio
}
