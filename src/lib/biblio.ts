// Búsqueda de datos bibliográficos en fuentes gratuitas:
//  · Por ISBN: Google Books + Open Library + BNE + K10plus (en paralelo).
//  · Por título: Google Books + Open Library.
// Cada fuente cubre un hueco distinto:
//  · Google Books: lo más completo (portada + sinopsis), pero su cuota SIN clave
//    es compartida y se agota (429). Con GOOGLE_BOOKS_API_KEY usa cuota propia.
//  · BNE: casi todo lo publicado en España (incluido libro antiguo y agotado).
//  · K10plus (catálogo de bibliotecas alemanas): mucho libro internacional en
//    inglés (que ni Open Library —sin ficha— ni la BNE —solo español— traen).
//  · Open Library: portadas por ISBN (existen aunque no haya ficha de datos).
// Lo usan el autocompletado por ISBN/título y el OCR de portadas.
// Nota: NO mandar User-Agent propio — la CDN de Open Library corta la conexión
// con cabeceras de cliente personalizadas desde el servidor (fetch failed).
import { GOOGLE_BOOKS_API_KEY } from 'astro:env/server';
import { esIsbn, validarIsbn, mismoLibroIsbn } from './isbn';

export interface DatosLibro {
  encontrado: boolean;
  /** true si la consulta parecía un ISBN pero su dígito de control no cuadra. */
  isbnInvalido?: boolean;
  fuente?: string;
  titulo?: string | null;
  autor?: string | null;
  autores_extra?: string[];
  anio?: number | null;
  editorial?: string | null;
  paginas?: number | null;
  portada?: string | null;
  sinopsis?: string | null;
  isbn?: string | null;
}

// esIsbn / validarIsbn viven en ./isbn (lógica pura, también usada en el navegador).

function anioDe(fecha?: string): number | null {
  if (!fecha) return null;
  const m = /\d{4}/.exec(fecha);
  return m ? Number(m[0]) : null;
}

async function googleBooks(q: string, isbnEsperado?: string): Promise<DatosLibro | null> {
  // Si hay clave propia, se añade para usar la cuota propia (no la compartida).
  const key = GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&country=ES&maxResults=5${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json();
  const items: any[] = data.items ?? [];
  // Si buscamos por ISBN, tomamos el resultado que realmente lleva ese ISBN
  // (Google a veces devuelve coincidencias laxas que no corresponden).
  const item = isbnEsperado
    ? items.find((it) => (it.volumeInfo?.industryIdentifiers ?? []).some((x: any) => mismoLibroIsbn(isbnEsperado, x.identifier)))
    : items[0];
  const vi = item?.volumeInfo;
  if (!vi) return null;
  const autores: string[] = vi.authors ?? [];
  const ids: any[] = vi.industryIdentifiers ?? [];
  const isbn = ids.find((x) => x.type === 'ISBN_13')?.identifier
    ?? ids.find((x) => x.type === 'ISBN_10')?.identifier
    ?? null;
  let portada: string | null = vi.imageLinks?.thumbnail ?? vi.imageLinks?.smallThumbnail ?? null;
  if (portada) portada = portada.replace(/^http:/, 'https:');
  return {
    encontrado: true,
    fuente: 'Google Books',
    titulo: [vi.title, vi.subtitle].filter(Boolean).join('. ') || null,
    autor: autores[0] ?? null,
    autores_extra: autores.slice(1),
    anio: anioDe(vi.publishedDate),
    editorial: vi.publisher ?? null,
    paginas: vi.pageCount ?? null,
    portada,
    sinopsis: vi.description ?? null,
    isbn,
  };
}

async function openLibrarySearch(q: string): Promise<DatosLibro | null> {
  const campos = 'title,author_name,first_publish_year,publisher,number_of_pages_median,cover_i,isbn';
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&fields=${campos}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json();
  const doc = data.docs?.[0];
  if (!doc) return null;
  const autores: string[] = doc.author_name ?? [];
  return {
    encontrado: true,
    fuente: 'Open Library',
    titulo: doc.title ?? null,
    autor: autores[0] ?? null,
    autores_extra: autores.slice(1),
    anio: doc.first_publish_year ?? null,
    editorial: doc.publisher?.[0] ?? null,
    paginas: doc.number_of_pages_median ?? null,
    portada: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    sinopsis: null,
    isbn: doc.isbn?.[0] ?? null,
  };
}

async function openLibraryIsbn(isbn: string): Promise<DatosLibro | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json();
  const libro = data[`ISBN:${isbn}`];
  if (!libro) return null;
  const autores: string[] = (libro.authors ?? []).map((a: any) => a.name);
  return {
    encontrado: true,
    fuente: 'Open Library',
    titulo: libro.title ?? null,
    autor: autores[0] ?? null,
    autores_extra: autores.slice(1),
    anio: anioDe(libro.publish_date),
    editorial: libro.publishers?.[0]?.name ?? null,
    paginas: libro.number_of_pages ?? null,
    portada: libro.cover?.large ?? libro.cover?.medium ?? null,
    // OJO: el campo `notes` de Open Library son notas de catalogación
    // ("Translation of…", "Source title: …"), NO una sinopsis — era el origen
    // de las "sinopsis basura" que hubo que limpiar por SQL. La sinopsis de
    // verdad vive en la ficha de la OBRA (ver sinopsisObraOpenLibrary).
    sinopsis: null,
    isbn,
  };
}

// ── Biblioteca Nacional de España (SRU, Dublin Core) ────────────────────────
const BNE_SRU = 'https://catalogo.bne.es/view/sru/34BNE_INST';

function desescaparXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Texto de todas las etiquetas <dc:tag> del XML (se pide maximumRecords=1).
 *  Admite atributos en la etiqueta (p. ej. el xmlns que añade K10plus). */
function extraerDc(xml: string, tag: string): string[] {
  const re = new RegExp(`<dc:${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</dc:${tag}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const txt = desescaparXml(m[1]).replace(/\s+/g, ' ').trim();
    if (txt) out.push(txt);
  }
  return out;
}

// Roles de la BNE que NO son el autor principal (traductor, editor, ilustrador…).
const ROL_SECUNDARIO = /\s(trad|il|ed|dir|comp|coord|pr|ant|rev|col|pref|introd)\.?$/i;

/** Normaliza una persona de un catálogo Dublin Core a "Nombre Apellidos".
 *  Cubre el formato de la BNE ("Ruiz Zafón, Carlos 1964-2020 aut") y el de
 *  K10plus ("Kasparov, Garri , 1963-", con coma extra y fecha abierta). */
function limpiarPersonaBne(s: string): string {
  let t = s
    .replace(/\s*\([^)]*\)/g, ' ') // roles entre paréntesis de K10plus ("(VerfasserIn)"…)
    .replace(/\d{4}\s*-\s*\d{0,4}/g, ' ') // rangos de fechas, incl. abiertos ("1963-")
    .replace(/\b\d{4}\b/g, ' ') // año suelto
    .replace(/\s(aut|trad|il|ed|dir|comp|coord|pr|ant|rev|col|pref|introd)\.?\s*$/i, '') // rol final
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;-]+$/, '') // restos al final tras quitar la fecha (", -", etc.)
    .trim();
  const c = t.indexOf(',');
  if (c > 0) {
    const apellidos = t.slice(0, c).trim();
    const nombre = t.slice(c + 1).replace(/[\s,;-]+/g, ' ').trim(); // limpia restos internos
    t = nombre ? `${nombre} ${apellidos}` : apellidos;
  }
  return t.trim();
}

/** Quita el descriptor de soporte del título ("[Texto impreso]", etc.). */
function quitarSoporteBne(titulo: string): string {
  return titulo.replace(/\s*\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

const LUGARES_BNE = new Set([
  'madrid', 'barcelona', 'valencia', 'sevilla', 'zaragoza', 'málaga', 'bilbao',
  'pamplona', 'salamanca', 'granada', 'oviedo', 'santander', 'méxico', 'buenos aires',
  's.l.', '[s.l.]',
]);

/** De los varios dc:publisher (lugar + editoriales) elige la editorial. */
function editorialBne(publishers: string[]): string | null {
  const limpios = publishers.map((p) => p.replace(/[.,;:\s]+$/, '').trim()).filter(Boolean);
  const real = limpios.find((p) => !LUGARES_BNE.has(p.toLowerCase()));
  return real ?? limpios[0] ?? null;
}

async function bneIsbn(isbn: string): Promise<DatosLibro | null> {
  const query = encodeURIComponent(`alma.isbn=${isbn}`);
  const url = `${BNE_SRU}?operation=searchRetrieve&version=1.2&query=${query}&recordSchema=dc&maximumRecords=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const xml = await res.text();
  const titulos = extraerDc(xml, 'title');
  if (titulos.length === 0) return null;
  // La BNE a veces hace match laxo y devuelve un libro que NO lleva el ISBN
  // buscado: lo descartamos comprobando los identificadores del registro.
  if (!extraerDc(xml, 'identifier').some((id) => mismoLibroIsbn(isbn, id))) return null;
  const personas = [...extraerDc(xml, 'creator'), ...extraerDc(xml, 'contributor')];
  const autores = personas
    .filter((p) => !ROL_SECUNDARIO.test(p)) // descartar traductores/editores/…
    .map(limpiarPersonaBne)
    .filter(Boolean);
  return {
    encontrado: true,
    fuente: 'BNE',
    titulo: quitarSoporteBne(titulos[0]),
    autor: autores[0] ?? null,
    autores_extra: autores.slice(1),
    anio: anioDe(extraerDc(xml, 'date').join(' ')),
    editorial: editorialBne(extraerDc(xml, 'publisher')),
    paginas: null,
    portada: null,
    sinopsis: null,
    isbn,
  };
}

// ── K10plus (catálogo unificado de bibliotecas alemanas, SRU/Dublin Core) ───
// Sin clave ni cuota. Cataloga muchísimo libro internacional en inglés (ajedrez,
// novela…) que ni Open Library (a menudo sin ficha) ni la BNE (solo España)
// traen. Reutiliza el mismo parser Dublin Core que la BNE.
const K10PLUS_SRU = 'https://sru.k10plus.de/gvk';

async function k10plusIsbn(isbn: string): Promise<DatosLibro | null> {
  const url = `${K10PLUS_SRU}?version=1.1&operation=searchRetrieve&query=pica.isb%3D${isbn}&maximumRecords=1&recordSchema=dc`;
  // Timeout propio: es una fuente externa más lenta y no debe retrasar al resto.
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000);
  let xml: string;
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    xml = await res.text();
  } finally {
    clearTimeout(t);
  }
  const titulos = extraerDc(xml, 'title');
  if (titulos.length === 0) return null;
  // K10plus también puede devolver resultados laxos: exigimos el ISBN buscado.
  if (!extraerDc(xml, 'identifier').some((id) => mismoLibroIsbn(isbn, id))) return null;
  // Autor principal: primer creator; si no hay, primer contributor (K10plus no
  // marca el rol en el texto, así que NO importamos coautores para no colar
  // traductores). Reutiliza limpiarPersonaBne ("Apellido, Nombre 1963-").
  const personas = [...extraerDc(xml, 'creator'), ...extraerDc(xml, 'contributor')];
  const autor = personas.map(limpiarPersonaBne).find(Boolean) ?? null;
  return {
    encontrado: true,
    fuente: 'K10plus',
    titulo: quitarSoporteBne(titulos[0]),
    autor,
    autores_extra: [],
    anio: anioDe(extraerDc(xml, 'date').join(' ')),
    editorial: editorialBne(extraerDc(xml, 'publisher')),
    paginas: null,
    portada: null,
    sinopsis: null,
    isbn,
  };
}

/**
 * Descripción de la "obra" de Open Library por ISBN. La ficha de edición
 * (openLibraryIsbn) casi nunca trae descripción, pero la de la OBRA a la que
 * pertenece sí la tiene a menudo. Cuesta dos peticiones más, así que solo se
 * consulta cuando ninguna otra fuente trajo sinopsis. Suele venir en inglés:
 * sirve como material para el botón "Redactar con IA" (que la traduce y limpia).
 */
async function sinopsisObraOpenLibrary(isbn: string): Promise<string | null> {
  const conTimeout = (url: string) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    return fetch(url, { signal: ac.signal }).finally(() => clearTimeout(t));
  };
  const ed = await conTimeout(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!ed.ok) return null;
  const edicion: any = await ed.json();
  const obraKey = edicion.works?.[0]?.key;
  if (typeof obraKey !== 'string') return null;
  const w = await conTimeout(`https://openlibrary.org${obraKey}.json`);
  if (!w.ok) return null;
  const obra: any = await w.json();
  const d = obra.description;
  const texto = typeof d === 'string' ? d : typeof d?.value === 'string' ? d.value : null;
  return texto?.trim() || null;
}

/**
 * Portada de Open Library por ISBN. Existe para muchísimos libros aunque Open
 * Library no tenga su ficha de datos (p. ej. cuando solo los encuentra la BNE).
 * Con `default=false` devuelve 404 si no hay portada, así no servimos una en blanco.
 */
async function portadaOpenLibraryIsbn(isbn: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  try {
    const res = await fetch(`${url}?default=false`, { method: 'HEAD' });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

/** Toma `base` y rellena sus campos vacíos con los de `extra`. */
function fusionar(base: DatosLibro | null, extra: DatosLibro | null): DatosLibro | null {
  if (!base) return extra;
  if (!extra) return base;
  return {
    encontrado: true,
    fuente: [base.fuente, extra.fuente].filter(Boolean).join(' + '),
    titulo: base.titulo || extra.titulo,
    autor: base.autor || extra.autor,
    autores_extra: base.autores_extra?.length ? base.autores_extra : extra.autores_extra,
    anio: base.anio ?? extra.anio,
    editorial: base.editorial || extra.editorial,
    paginas: base.paginas ?? extra.paginas,
    portada: base.portada || extra.portada,
    sinopsis: base.sinopsis || extra.sinopsis,
    isbn: base.isbn || extra.isbn,
  };
}

/** Busca datos de un libro por ISBN o por título. Devuelve `{encontrado:false}` si no hay nada. */
export async function buscarDatos(consulta: string): Promise<DatosLibro> {
  const q = consulta.trim();
  if (!q) return { encontrado: false };
  // Si parece un ISBN pero el dígito de control no cuadra, avisamos sin buscar:
  // casi seguro es un error de tecleo/lectura (un número cambiado).
  if (validarIsbn(q) === 'invalido') return { encontrado: false, isbnInvalido: true };
  const isbn = esIsbn(q);
  if (isbn) {
    const [g, o, b, k] = await Promise.all([
      googleBooks(`isbn:${isbn}`, isbn).catch(() => null),
      openLibraryIsbn(isbn).catch(() => null),
      bneIsbn(isbn).catch(() => null),
      k10plusIsbn(isbn).catch(() => null),
    ]);
    // Prioridad: Google Books (suele traer portada/sinopsis) → BNE (libro español
    // fiable) → K10plus (libro internacional en inglés) → Open Library. fusionar
    // rellena los huecos del primero con los siguientes.
    const r = fusionar(fusionar(fusionar(g, b), k), o);
    // Si nadie trajo portada (caso típico de libro solo en la BNE), probamos la
    // de Open Library por ISBN, que existe aunque no haya ficha de datos.
    if (r && !r.portada) {
      const p = await portadaOpenLibraryIsbn(isbn).catch(() => null);
      if (p) r.portada = p;
    }
    // Ídem con la sinopsis: si nadie la trajo, probamos la descripción de la
    // "obra" de Open Library (a menudo existe aunque la ficha de edición no).
    if (r && !r.sinopsis) {
      const s = await sinopsisObraOpenLibrary(isbn).catch(() => null);
      if (s) r.sinopsis = s;
    }
    return r ?? { encontrado: false };
  }
  // Por título: Google Books primero; si falla o no encuentra, Open Library.
  const r =
    (await googleBooks(`intitle:${q}`).catch(() => null)) ??
    (await openLibrarySearch(q).catch(() => null));
  return r ?? { encontrado: false };
}
