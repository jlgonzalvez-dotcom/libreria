# Mi Librería — catálogo de la biblioteca personal

Web-catálogo de **todos mis libros, bien clasificados**. Construida con
[Astro](https://astro.build). Pensada para crecer: hoy es un escaparate/catálogo;
más adelante puede incorporar venta de libros usados, reseñas y comentarios
(el modelo de datos ya reserva campos para ello).

## Cómo añadir un libro

Cada libro es un archivo de texto (`.md`) dentro de `src/content/libros/`.
Copia uno existente, renómbralo (sin tildes ni espacios, usa guiones) y edita
los datos de la cabecera. Ejemplo mínimo:

```markdown
---
titulo: "El nombre del libro"
autor: "Nombre del autor"
categoria: "Narrativa"          # categoría principal (1 sola)
subcategorias: ["Novela"]        # géneros secundarios (opcional)
etiquetas: ["aventuras"]          # etiquetas de búsqueda (opcional)
anio: 2020
idioma: "Español"
editorial: "Editorial"
paginas: 320
estado: "leído"                  # leído | leyendo | pendiente | consulta
valoracion: 4                     # 0 a 5 estrellas
ubicacion: "Salón — estantería A"
formato: "papel"                 # papel | digital | audiolibro
portada: "/portadas/mi-libro.jpg" # opcional; si no, se muestra la inicial
destacado: false
---

Aquí van tus notas o reseña del libro (admite Markdown).
```

Campos para el **futuro uso comercial** (opcionales, vacíos hasta que los uses):
`en_venta`, `precio`, `estado_conservacion`, `resena`.

### Portadas
Pon las imágenes de portada en `public/portadas/` y referéncialas como
`portada: "/portadas/nombre.jpg"`. Si un libro no tiene portada, se muestra
una tarjeta con la inicial del título.

## Cómo ver la web en tu ordenador

```bash
npm install      # solo la primera vez
npm run dev      # abre http://localhost:4321
```

## Cómo publicarla en internet (cuando quieras)

```bash
npm run build    # genera la web en la carpeta dist/
```

`dist/` se puede subir gratis a Vercel o Netlify; cada cambio que guardes en el
repositorio se publica solo.

## Estructura

```
src/
├── content/libros/      ← un .md por cada libro (aquí vive tu catálogo)
├── content.config.ts    ← define los campos de clasificación de cada libro
├── layouts/Layout.astro ← cabecera, pie y estilos comunes
├── pages/
│   ├── index.astro       ← catálogo con buscador y filtros por categoría
│   └── libros/[slug].astro ← ficha de detalle de cada libro
└── styles/global.css     ← estética (paleta, tipografías)
```
