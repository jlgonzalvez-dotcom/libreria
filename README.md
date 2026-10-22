# La librería de JL

Catálogo de una biblioteca personal construido con **Astro**, **Supabase** y **Vercel**.

[Ver el catálogo](https://lalibreriadejl.vercel.app)

## Funciones

- Catálogo en español e inglés, con búsqueda y filtros por autor y categoría.
- Fichas de libros, sinopsis, portadas, valoraciones y ediciones relacionadas.
- Panel privado para catalogar libros, escanear ISBN y gestionar inventario y préstamos.
- Exportación del catálogo y copias de seguridad privadas.

Las páginas se generan en el servidor. Los datos del catálogo viven en Supabase;
las ubicaciones físicas, préstamos y notas internas quedan reservados al panel.
Las consultas públicas seleccionan únicamente los campos destinados al catálogo.

## Desarrollo local

Se necesita Node.js 22.16 o posterior; para producción se recomienda Node.js 24.

```sh
npm ci
cp .env.example .env
# Rellena .env con las credenciales de tu propio proyecto.
npm run setup:hooks
npm run dev
```

No publiques el archivo `.env` ni una clave `service_role`. El cliente de Supabase
se usa exclusivamente desde el servidor. Activa RLS y restringe los permisos
de los roles públicos en Supabase; una comprobación del código no sustituye
la revisión de los permisos de la base de datos desplegada.

## Comprobaciones

```sh
npm test
npm run check
npm run test:integration  # requiere Python 3; usa datos ficticios en localhost
npm run privacy
npm audit
npm run build
```

## Inventario privado

Los inventarios y las notas personales se guardan fuera del repositorio.
`scripts/inventario-cajas.py` mantiene el Excel y su CSV de recuperación en
`~/.local/share/libreria/`, salvo que se configuren `LIBRERIA_DATOS_PRIVADOS`
o `LIBRERIA_INVENTARIO_EXCEL`. Conserva una copia del Excel anterior antes de
regenerarlo. Los datos personales nunca deben incluirse en documentación,
mensajes de commits, capturas ni ejemplos públicos.

La contraseña del panel debe ser larga y exclusiva. En producción conviene
configurar además un límite de intentos en el firewall de Vercel. Cambiar
la contraseña invalida las sesiones firmadas previamente.

## Estructura

```text
src/components/    Catálogo, fichas y formulario de administración
src/pages/         Páginas públicas, panel privado y endpoints
src/lib/           Acceso a datos y lógica del catálogo
scripts/           Herramientas locales de inventario y copias
tests/             Pruebas de las protecciones de seguridad
```
