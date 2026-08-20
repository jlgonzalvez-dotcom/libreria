#!/usr/bin/env python3
"""Copia de seguridad de la colección en CSV, la que se hace al cerrar sesión.

Uso:  python3 scripts/copia-csv.py [ruta-del-csv]

Genera el mismo fichero que el botón «⬇ Copia de seguridad» de /admin —mismas 32
columnas, separador «;», BOM UTF-8, líneas CRLF y orden alfabético español por
título—, pero leyendo de la API REST de Supabase, sin levantar la web. La lógica
es la de `src/lib/exportacion.ts`: si allí cambian las columnas, hay que tocar
aquí también.

Por defecto escribe en `copias/la-libreria-de-jl-AAAA-MM-DD.csv`.
"""
import json
import locale
import os
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# [encabezado, cómo sacar el valor del libro] — mismo orden que exportacion.ts
lista = lambda xs: ", ".join(xs or [])
si_no = lambda b: "Sí" if b else "No"
fecha = lambda iso: (iso or "")[:10]
precio_es = lambda n: "" if n is None else str(n).replace(".", ",")
v = lambda x: "" if x is None else x

COLUMNAS = [
    ("Título", lambda l: l["titulo"]),
    ("Autor", lambda l: l["autor"]),
    ("Autores adicionales", lambda l: lista(l["autores_extra"])),
    ("Categoría", lambda l: l["categoria"]),
    ("Subcategorías", lambda l: lista(l["subcategorias"])),
    ("Etiquetas", lambda l: lista(l["etiquetas"])),
    ("Año de publicación", lambda l: v(l["anio_publicacion"])),
    ("Año de impresión", lambda l: v(l["anio"])),
    ("Edición", lambda l: v(l["edicion"])),
    ("Editorial", lambda l: v(l["editorial"])),
    ("Idioma", lambda l: l["idioma"]),
    ("ISBN", lambda l: v(l["isbn"])),
    ("Páginas", lambda l: v(l["paginas"])),
    ("Formato", lambda l: l["formato"]),
    ("Estado de lectura", lambda l: l["estado"]),
    ("Valoración (estrellas)", lambda l: v(l["valoracion"])),
    ("Ejemplares", lambda l: l["ejemplares"]),
    ("Ubicación", lambda l: v(l["ubicacion"])),
    ("Prestado a", lambda l: v(l["prestado_a"])),
    ("Prestado el", lambda l: fecha(l["prestado_en"])),
    ("En venta", lambda l: si_no(l["en_venta"])),
    ("Precio (€)", lambda l: precio_es(l["precio"])),
    ("Estado de conservación", lambda l: v(l["estado_conservacion"])),
    ("Sinopsis", lambda l: v(l["sinopsis"])),
    ("Reseña", lambda l: v(l["resena"])),
    ("Notas", lambda l: v(l["notas"])),
    ("Destacado", lambda l: si_no(l["destacado"])),
    ("Portada (URL)", lambda l: v(l["portada"])),
    ("Slug", lambda l: l["slug"]),
    ("ID", lambda l: l["id"]),
    ("Añadido", lambda l: fecha(l["created_at"])),
    ("Actualizado", lambda l: fecha(l["updated_at"])),
]


def variables_entorno() -> dict[str, str]:
    valores = {}
    env = RAIZ / ".env"
    for linea in env.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            clave, valor = linea.split("=", 1)
            valores[clave.strip()] = valor.strip().strip("'\"")
    valores.update({k: v for k, v in os.environ.items() if k.startswith("SUPABASE_")})
    return valores


def celda(valor) -> str:
    s = "" if valor is None else str(valor)
    return '"' + s.replace('"', '""') + '"' if re.search(r'["\r\n;]', s) else s


def main() -> int:
    cfg = variables_entorno()
    url, clave = cfg.get("SUPABASE_URL"), cfg.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not clave:
        raise SystemExit("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env")

    peticion = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/libros?select=*&limit=5000",
        headers={"apikey": clave, "Authorization": f"Bearer {clave}"},
    )
    with urllib.request.urlopen(peticion, timeout=60) as r:
        libros = json.loads(r.read().decode("utf-8"))

    try:  # orden alfabético español (ñ, acentos), como localeCompare('es')
        locale.setlocale(locale.LC_COLLATE, "es_ES.UTF-8")
        orden = locale.strxfrm
    except locale.Error:
        orden = lambda s: s.lower()
    libros.sort(key=lambda l: orden(l["titulo"]))

    lineas = [";".join(celda(c) for c, _ in COLUMNAS)]
    lineas += [";".join(celda(saca(l)) for _, saca in COLUMNAS) for l in libros]

    destino = Path(sys.argv[1]) if len(sys.argv) > 1 else (
        RAIZ / "copias" / f"la-libreria-de-jl-{date.today():%Y-%m-%d}.csv")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("﻿" + "\r\n".join(lineas) + "\r\n", encoding="utf-8", newline="")
    print(f"CSV: {destino}")
    print(f"  {len(libros)} libros × {len(COLUMNAS)} columnas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
