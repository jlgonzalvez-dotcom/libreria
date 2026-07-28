// Web bilingüe: español (raíz, idioma por defecto) e inglés (bajo /en/).
//
// Cómo funciona:
//  · El idioma se deduce de la URL: /libros/x/ → español, /en/libros/x/ → inglés.
//    No hay cookies ni detección automática; se cambia con el botón ES/EN de la
//    cabecera, y Google descubre las dos versiones por las etiquetas hreflang.
//  · Los TEXTOS de la interfaz salen de este diccionario.
//  · Los DATOS del libro (título, autor, editorial…) NO se traducen: son los del
//    ejemplar real. Sí se traducen los valores de lista (categoría, idioma,
//    formato, conservación) y la sinopsis, que se guarda traducida en la base
//    de datos (columna sinopsis_en).

export type Idioma = 'es' | 'en';

export const IDIOMA_POR_DEFECTO: Idioma = 'es';

/** Prefijo de ruta de cada idioma ('' para el español, que vive en la raíz). */
const PREFIJO: Record<Idioma, string> = { es: '', en: '/en' };

/** Idioma de la página a partir de su URL. */
export function idiomaDe(url: URL | string): Idioma {
  const ruta = typeof url === 'string' ? url : url.pathname;
  return ruta === '/en' || ruta.startsWith('/en/') ? 'en' : 'es';
}

/** Prefija una ruta interna con el idioma: ruta('en', '/libros/x/') → '/en/libros/x/'. */
export function ruta(lang: Idioma, camino: string): string {
  return `${PREFIJO[lang]}${camino}` || '/';
}

/** La misma ruta sin el prefijo de idioma ('/en/libros/x/' → '/libros/x/'). */
export function rutaSinIdioma(url: URL | string): string {
  const camino = typeof url === 'string' ? url : url.pathname;
  if (camino === '/en') return '/';
  return camino.startsWith('/en/') ? camino.slice(3) : camino;
}

/** La página actual en el idioma pedido (para el botón ES/EN y los hreflang). */
export function rutaEnIdioma(url: URL | string, destino: Idioma): string {
  return ruta(destino, rutaSinIdioma(url));
}

/** Etiqueta del código de idioma para el atributo lang y og:locale. */
export const LOCALE: Record<Idioma, string> = { es: 'es_ES', en: 'en_US' };

// ─── Textos de la interfaz ───────────────────────────────────────────────────
// Las plantillas llevan huecos {así}, que rellena la función fmt() de abajo.

const ES = {
  // Cabecera, pie y navegación
  nav_catalogo: 'Catálogo',
  nav_tema_aria: 'Cambiar entre modo día y noche',
  nav_tema_title: 'Modo día / noche',
  nav_idioma_aria: 'Idioma',
  nav_idioma_title: 'Ver esta página en inglés',
  pie: 'Catálogo personal · generado con Astro',

  // Portada: hero
  titulo_inicio: 'La librería de JL — Catálogo',
  descripcion_inicio: 'Catálogo de mi colección de libros, clasificado por categorías.',
  hero_h1_1: 'Una colección',
  hero_h1_2: 'cuidada, libro a libro.',
  hero_lead: 'Busca por título o autor, o explora la colección por categoría.',
  stat_libros: 'Libros',
  stat_categorias: 'Categorías',
  stat_autores: 'Autores',
  stat_libros_title: 'Bajar al catálogo',
  stat_categorias_title: 'Ver reparto por categoría',
  stat_autores_title: 'Ver autores más frecuentes',
  hero_cinco_estrellas: 'Cinco estrellas',
  destacado: 'Destacado',
  portada_de: 'Portada de {titulo}',

  // Portada: catálogo
  catalogo_h2: 'El catálogo',
  contador_uno: '{n} libro',
  contador_varios: '{n} libros',
  buscador_placeholder: 'Buscar por título, autor o etiqueta…',
  filtro_autor_todos: 'Todos los autores',
  filtro_autor_aria: 'Filtrar por autor',
  chip_todas: 'Todas',
  vista_aria: 'Modo de vista',
  vista_rejilla: 'Ver en rejilla',
  vista_rejilla_title: 'Rejilla',
  vista_lista: 'Ver en lista',
  vista_lista_title: 'Lista',
  catalogo_vacio: 'Aún no hay libros en el catálogo.',

  // Portada: gráficos
  modal_aria: 'Estadísticas de la colección',
  cerrar: 'Cerrar',
  grafico_categorias_titulo: 'Reparto por categoría',
  grafico_categorias_pista: 'Pulsa una categoría para ver sus libros en el catálogo.',
  grafico_categorias_aria: 'Distribución de libros por categoría',
  grafico_autores_titulo: 'Autores con más libros',
  grafico_autores_pista: 'Pulsa un autor para ver sus libros en el catálogo.',
  tarta_libros: 'LIBROS',
  ver_libros_categoria: 'Ver los libros de {nombre}',
  ver_libros_autor: 'Ver los libros de {nombre}',

  // Ficha de libro
  volver: '← Volver al catálogo',
  ficha_anio_publicacion: 'Año de publicación',
  ficha_anio: 'Año de impresión',
  ficha_editorial: 'Editorial',
  ficha_edicion: 'Edición',
  ficha_paginas: 'Páginas',
  ficha_idioma: 'Idioma',
  ficha_formato: 'Formato',
  ficha_valoracion: 'Valoración',
  ficha_isbn: 'ISBN',
  ficha_generos: 'Géneros',
  ficha_etiquetas: 'Etiquetas',
  ficha_en_venta: 'En venta',
  si: 'Sí',
  relacionados_autor: 'Más de {autor}',
  relacionados_categoria: 'Más en {categoria}',
  ficha_descripcion: '«{titulo}», de {autores} ({categoria}). En el catálogo de La librería de JL.',
  sinopsis_sin_traducir: '',

  // Páginas de error
  titulo_404: 'Página no encontrada — La librería de JL',
  descripcion_404: 'Esta página no está en el catálogo.',
  h1_404: 'Esta página no está en el catálogo',
  texto_404: 'Puede que el libro ya no esté, que haya cambiado de dirección o que el enlace venga mal escrito.',
  boton_404: 'Volver al catálogo',
  titulo_500: 'La librería está cerrada un momento — La librería de JL',
  descripcion_500: 'Ha ocurrido un error temporal. Vuelve a intentarlo en un momento.',
  h1_500: 'La librería está cerrada un momento',
  texto_500: 'Algo ha fallado al preparar la página. Suele ser cosa de un instante: vuelve a intentarlo recargando, o pasa de nuevo dentro de un rato.',
  boton_500: 'Volver a intentarlo',
} as const;

export type ClaveTexto = keyof typeof ES;

const EN: Record<ClaveTexto, string> = {
  nav_catalogo: 'Catalog',
  nav_tema_aria: 'Switch between light and dark mode',
  nav_tema_title: 'Light / dark mode',
  nav_idioma_aria: 'Language',
  nav_idioma_title: 'Ver esta página en español',
  pie: 'A personal book catalog · built with Astro',

  titulo_inicio: 'La librería de JL — Catalog',
  descripcion_inicio: 'The catalog of my book collection, sorted by category.',
  hero_h1_1: 'A collection built',
  hero_h1_2: 'with care, book by book.',
  hero_lead: 'Search by title or author, or browse the collection by category.',
  stat_libros: 'Books',
  stat_categorias: 'Categories',
  stat_autores: 'Authors',
  stat_libros_title: 'Jump to the catalog',
  stat_categorias_title: 'See the breakdown by category',
  stat_autores_title: 'See the most frequent authors',
  hero_cinco_estrellas: 'Five stars',
  destacado: 'Featured',
  portada_de: 'Cover of {titulo}',

  catalogo_h2: 'The catalog',
  contador_uno: '{n} book',
  contador_varios: '{n} books',
  buscador_placeholder: 'Search by title, author or tag…',
  filtro_autor_todos: 'All authors',
  filtro_autor_aria: 'Filter by author',
  chip_todas: 'All',
  vista_aria: 'View mode',
  vista_rejilla: 'Grid view',
  vista_rejilla_title: 'Grid',
  vista_lista: 'List view',
  vista_lista_title: 'List',
  catalogo_vacio: 'There are no books in the catalog yet.',

  modal_aria: 'Collection statistics',
  cerrar: 'Close',
  grafico_categorias_titulo: 'Books by category',
  grafico_categorias_pista: 'Tap a category to see its books in the catalog.',
  grafico_categorias_aria: 'Distribution of books by category',
  grafico_autores_titulo: 'Authors with the most books',
  grafico_autores_pista: 'Tap an author to see their books in the catalog.',
  tarta_libros: 'BOOKS',
  ver_libros_categoria: 'See the books in {nombre}',
  ver_libros_autor: 'See the books by {nombre}',

  volver: '← Back to the catalog',
  ficha_anio_publicacion: 'Publication year',
  ficha_anio: 'Printing year',
  ficha_editorial: 'Publisher',
  ficha_edicion: 'Edition',
  ficha_paginas: 'Pages',
  ficha_idioma: 'Language',
  ficha_formato: 'Format',
  ficha_valoracion: 'Rating',
  ficha_isbn: 'ISBN',
  ficha_generos: 'Genres',
  ficha_etiquetas: 'Tags',
  ficha_en_venta: 'For sale',
  si: 'Yes',
  relacionados_autor: 'More by {autor}',
  relacionados_categoria: 'More in {categoria}',
  ficha_descripcion: '“{titulo}” by {autores} ({categoria}). In the catalog of La librería de JL.',
  sinopsis_sin_traducir: 'Synopsis in Spanish — the English version is on its way.',

  titulo_404: 'Page not found — La librería de JL',
  descripcion_404: 'This page is not in the catalog.',
  h1_404: 'This page is not in the catalog',
  texto_404: 'The book may be gone, the address may have changed, or the link may be misspelled.',
  boton_404: 'Back to the catalog',
  titulo_500: 'The library is closed for a moment — La librería de JL',
  descripcion_500: 'A temporary error occurred. Please try again in a moment.',
  h1_500: 'The library is closed for a moment',
  texto_500: 'Something went wrong while preparing the page. It is usually a matter of seconds: try reloading, or come back in a little while.',
  boton_500: 'Try again',
};

const TEXTOS: Record<Idioma, Record<ClaveTexto, string>> = { es: ES, en: EN };

/** Rellena los huecos {clave} de una plantilla. */
function fmt(plantilla: string, valores?: Record<string, string | number>): string {
  if (!valores) return plantilla;
  return plantilla.replace(/\{(\w+)\}/g, (hueco, clave) =>
    clave in valores ? String(valores[clave]) : hueco,
  );
}

/** Devuelve la función de traducción de un idioma: `const t = textos('en')`. */
export function textos(lang: Idioma) {
  const diccionario = TEXTOS[lang];
  return (clave: ClaveTexto, valores?: Record<string, string | number>) =>
    fmt(diccionario[clave], valores);
}

/** "3 libros" / "3 books", con singular correcto. */
export function contarLibros(lang: Idioma, n: number): string {
  const t = textos(lang);
  return t(n === 1 ? 'contador_uno' : 'contador_varios', { n });
}

// ─── Traducción de los valores de lista guardados en la base de datos ────────
// Son textos españoles escritos en el panel; en la web inglesa se muestran
// traducidos. Si aparece un valor que no está en la tabla (categoría nueva
// escrita a mano), se muestra tal cual: mejor en español que en blanco.

const CATEGORIAS_EN: Record<string, string> = {
  'Ajedrez': 'Chess',
  'Arte': 'Art',
  'Autoayuda': 'Self-help',
  'Biografía': 'Biography',
  'Ciencia': 'Science',
  'Clásicos': 'Classics',
  'Cómic': 'Comics',
  'Derecho': 'Law',
  'Diccionario': 'Dictionary',
  'Economía': 'Economics',
  'Ensayo': 'Essays',
  'Filosofía': 'Philosophy',
  'Historia': 'History',
  'Infantil-juvenil': "Children's & young adult",
  'Medicina': 'Medicine',
  'Narrativa': 'Fiction',
  'Novela biográfica': 'Biographical fiction',
  'Novela histórica': 'Historical fiction',
  'Poesía': 'Poetry',
  'Religión': 'Religion',
  'Teatro': 'Drama',
  'Tecnología': 'Technology',
};

const IDIOMAS_EN: Record<string, string> = {
  'Español': 'Spanish',
  'Inglés': 'English',
  'Francés': 'French',
  'Italiano': 'Italian',
  'Alemán': 'German',
  'Portugués': 'Portuguese',
  'Catalán': 'Catalan',
  'Gallego': 'Galician',
  'Euskera': 'Basque',
  'Latín': 'Latin',
};

const FORMATOS_EN: Record<string, string> = {
  'papel': 'paper',
  'digital': 'digital',
  'audiolibro': 'audiobook',
};

const CONSERVACION_EN: Record<string, string> = {
  'nuevo': 'new',
  'como nuevo': 'like new',
  'bueno': 'good',
  'aceptable': 'acceptable',
};

function traducirValor(tabla: Record<string, string>, valor: string, lang: Idioma): string {
  return lang === 'es' ? valor : (tabla[valor] ?? valor);
}

export const categoriaEn = (v: string, lang: Idioma) => traducirValor(CATEGORIAS_EN, v, lang);
export const idiomaLibroEn = (v: string, lang: Idioma) => traducirValor(IDIOMAS_EN, v, lang);
export const formatoEn = (v: string, lang: Idioma) => traducirValor(FORMATOS_EN, v, lang);
export const conservacionEn = (v: string, lang: Idioma) => traducirValor(CONSERVACION_EN, v, lang);

/** Ordinal de la edición: "3ª" en español, "3rd" en inglés. */
export function ordinalEdicion(n: number, lang: Idioma): string {
  if (lang === 'es') return `${n}ª`;
  const decena = n % 100;
  if (decena >= 11 && decena <= 13) return `${n}th`;
  const sufijo = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${sufijo}`;
}

/** Idioma para ordenar alfabéticamente (localeCompare). */
export const LOCALE_ORDEN: Record<Idioma, string> = { es: 'es', en: 'en' };
