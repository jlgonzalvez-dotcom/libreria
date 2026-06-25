import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ─────────────────────────────────────────────────────────────────────────────
// Colección "libros" — una ficha .md por libro en src/content/libros/
// El "schema" define cómo se clasifica y describe cada libro. Si quieres añadir
// un campo de clasificación nuevo (p. ej. "coleccion", "premio"...), se añade
// aquí y queda disponible en todas las fichas.
// ─────────────────────────────────────────────────────────────────────────────
const libros = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/libros' }),
  schema: z.object({
    // Identidad del libro
    titulo: z.string(),
    autor: z.string(),
    autores_extra: z.array(z.string()).default([]), // coautores, si los hay

    // Clasificación principal y secundaria
    categoria: z.string(),                         // categoría principal (1 sola)
    subcategorias: z.array(z.string()).default([]), // géneros/temas secundarios
    etiquetas: z.array(z.string()).default([]),     // etiquetas libres de búsqueda

    // Datos bibliográficos
    anio: z.number().optional(),                   // año de la edición
    idioma: z.string().default('Español'),
    editorial: z.string().optional(),
    isbn: z.string().optional(),
    paginas: z.number().optional(),

    // Estado en tu biblioteca personal
    estado: z.enum(['leído', 'leyendo', 'pendiente', 'consulta']).default('pendiente'),
    valoracion: z.number().min(0).max(5).optional(), // 0–5 estrellas
    ubicacion: z.string().optional(),               // estantería/sala física
    formato: z.enum(['papel', 'digital', 'audiolibro']).default('papel'),

    // Presentación
    portada: z.string().optional(),  // ruta dentro de /public (p. ej. /portadas/quijote.jpg)
    sinopsis: z.string().optional(),
    destacado: z.boolean().default(false),

    // ── Futuro uso comercial (todo opcional; vacío hasta que lo actives) ──────
    en_venta: z.boolean().default(false),                  // ¿se ofrece a la venta?
    precio: z.number().optional(),                         // precio en € si en_venta
    estado_conservacion: z
      .enum(['nuevo', 'como nuevo', 'bueno', 'aceptable'])
      .optional(),                                         // para venta de usados
    resena: z.string().optional(),                         // reseña/comentario propio destacado
  }),
});

export const collections = { libros };
