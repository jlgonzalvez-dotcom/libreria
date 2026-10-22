#!/usr/bin/env python3
"""Regenera el Excel del inventario privado desde la base de datos.

Uso:  python3 scripts/inventario-cajas.py [ruta-del-excel]

El Excel tiene tres hojas:

  · Resumen        — una fila por caja: nº de libros, materias y otros contenidos.
  · Detalle        — un libro por fila (caja, título, autor, categoría).
  · Otros objetos  — LO QUE ESCRIBE JOSÉ LUIS A MANO: cosas guardadas en las
                     cajas que NO son libros (álbum de sellos, manta, fotos…).

Las dos primeras se rehacen desde Supabase. La tercera se conserva y tiene
una copia CSV privada fuera del repositorio. Configura LIBRERIA_DATOS_PRIVADOS
para cambiar la carpeta y LIBRERIA_INVENTARIO_EXCEL para elegir el Excel.

Antes de escribir, el Excel anterior se guarda en la subcarpeta `anteriores/`.
"""
import csv
import json
import os
import shutil
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

RAIZ = Path(__file__).resolve().parent.parent
DATOS_PRIVADOS = Path(os.environ.get(
    "LIBRERIA_DATOS_PRIVADOS", Path.home() / ".local" / "share" / "libreria"
)).expanduser()
ESPEJO_CSV = DATOS_PRIVADOS / "otros-objetos.csv"
EXCEL_POR_DEFECTO = Path(os.environ.get(
    "LIBRERIA_INVENTARIO_EXCEL", str(DATOS_PRIVADOS / "Inventario.xlsx")
)).expanduser()

HOJA_RESUMEN, HOJA_DETALLE, HOJA_OTROS = "Resumen", "Detalle", "Otros objetos"
COLUMNAS_OTROS = ["Objeto", "Tipo", "Dónde", "Notas", "Anotado el"]



def variables_entorno() -> dict[str, str]:
    """Lee el .env del proyecto (sin pisar lo que ya venga del entorno)."""
    valores = {}
    env = RAIZ / ".env"
    if env.exists():
        for linea in env.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, valor = linea.split("=", 1)
            valores[clave.strip()] = valor.strip().strip("'\"")
    valores.update({k: v for k, v in os.environ.items() if k in valores or k.startswith("SUPABASE_")})
    return valores


def descargar_libros() -> list[dict]:
    """Trae título, autor, categoría y ubicación de todos los libros."""
    cfg = variables_entorno()
    url, clave = cfg.get("SUPABASE_URL"), cfg.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not clave:
        raise SystemExit("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env")

    peticion = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/libros"
        "?select=titulo,autor,categoria,ubicacion&order=titulo.asc&limit=5000",
        headers={"apikey": clave, "Authorization": f"Bearer {clave}"},
    )
    with urllib.request.urlopen(peticion, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def orden_caja(nombre: str) -> tuple:
    """Caja 1, Caja 2… Caja 10 en orden natural; los sitios sin número, al final."""
    digitos = "".join(c for c in nombre if c.isdigit())
    return (0, int(digitos), "") if digitos else (1, 0, nombre.lower())


def leer_otros(excel: Path) -> list[list[str]]:
    """Recupera la hoja de objetos que no son libros, sin tocar lo escrito."""
    if excel.exists():
        wb = openpyxl.load_workbook(excel, data_only=True)
        if HOJA_OTROS in wb.sheetnames:
            ws = wb[HOJA_OTROS]
            cabecera = [str(c.value or "").strip() for c in ws[1]]
            indice = {nombre: cabecera.index(nombre) for nombre in COLUMNAS_OTROS if nombre in cabecera}
            filas = []
            for fila in ws.iter_rows(min_row=2, values_only=True):
                celda = lambda n: str(fila[indice[n]]).strip() if indice.get(n) is not None and indice[n] < len(fila) and fila[indice[n]] is not None else ""
                if not celda("Objeto") or celda("Objeto").startswith("↑"):  # el texto de ayuda no es un objeto
                    continue
                filas.append([celda(n) for n in COLUMNAS_OTROS])
            return filas
    if ESPEJO_CSV.exists():  # el Excel se perdió: se recupera de la copia privada
        with ESPEJO_CSV.open(newline="", encoding="utf-8-sig") as f:
            lector = csv.DictReader(f, delimiter=";")
            equivalencias = {"Ubicación": "Dónde"}  # nombre antiguo de la columna
            filas = []
            for fila in lector:
                fila = {equivalencias.get(k, k): v for k, v in fila.items()}
                if (fila.get("Objeto") or "").strip():
                    filas.append([(fila.get(n) or "").strip() for n in COLUMNAS_OTROS])
            if filas:
                return filas
    return []


def guardar_espejo(otros: list[list[str]]) -> None:
    """Conserva los objetos en un CSV privado para Numbers/Excel."""
    ESPEJO_CSV.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with ESPEJO_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
        w.writerow(COLUMNAS_OTROS)
        w.writerows(otros)


def ancho(ws, anchos: dict[int, int]) -> None:
    for columna, medida in anchos.items():
        ws.column_dimensions[get_column_letter(columna)].width = medida


def main() -> int:
    excel = Path(sys.argv[1]) if len(sys.argv) > 1 else EXCEL_POR_DEFECTO
    excel.parent.mkdir(parents=True, exist_ok=True)

    libros = descargar_libros()
    otros = leer_otros(excel)

    por_caja: dict[str, list[dict]] = defaultdict(list)
    for libro in libros:
        por_caja[(libro.get("ubicacion") or "").strip() or "(sin ubicación)"].append(libro)

    objetos_por_caja: dict[str, list[str]] = defaultdict(list)
    for objeto, _tipo, donde, _notas, _fecha in otros:
        objetos_por_caja[donde.strip() or "(sin ubicación)"].append(objeto)

    cajas = sorted(set(por_caja) | set(objetos_por_caja), key=orden_caja)

    if excel.exists():  # nunca se pisa el anterior sin guardarlo
        anteriores = excel.parent / "anteriores"
        anteriores.mkdir(exist_ok=True)
        sello = datetime.now().strftime("%Y-%m-%d-%H%M")
        shutil.copy2(excel, anteriores / f"{excel.stem}-{sello}{excel.suffix}")

    negrita = Font(bold=True)
    wb = openpyxl.Workbook()

    # ---------- Resumen ----------
    ws = wb.active
    ws.title = HOJA_RESUMEN
    ws["A1"] = "Inventario privado de cajas"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = ('Todas las cajas contienen libros. La columna "Otros contenidos" '
                'recoge lo que no son libros (ver la hoja "Otros objetos").')
    for columna, titulo in enumerate(["Caja", "Nº libros", "Materias", "Otros contenidos"], 1):
        celda = ws.cell(row=4, column=columna, value=titulo)
        celda.font = negrita
    fila = 5
    for caja in cajas:
        materias = Counter((l.get("categoria") or "Sin categoría").strip() for l in por_caja.get(caja, []))
        ws.cell(row=fila, column=1, value=caja)
        ws.cell(row=fila, column=2, value=len(por_caja.get(caja, [])))
        ws.cell(row=fila, column=3, value=", ".join(
            f"{m} ({n})" for m, n in sorted(materias.items(), key=lambda x: (-x[1], x[0]))))
        ws.cell(row=fila, column=4, value=", ".join(objetos_por_caja.get(caja, [])))
        for columna in (3, 4):
            ws.cell(row=fila, column=columna).alignment = Alignment(wrap_text=True, vertical="top")
        fila += 1
    ws.cell(row=fila, column=1, value="TOTAL").font = negrita
    ws.cell(row=fila, column=2, value=len(libros)).font = negrita
    ws.cell(row=fila, column=4, value=f"{len(otros)} objetos que no son libros").font = negrita
    ws.cell(row=fila + 2, column=1, value=(
        'Libros: base de datos del catálogo (campo "ubicación"), consultada el '
        f'{datetime.now():%d/%m/%Y}. Se rehace al ejecutar scripts/inventario-cajas.py.'))
    ws.cell(row=fila + 3, column=1, value=(
        'Lo que no son libros lo escribe José Luis en la hoja "Otros objetos"; '
        "no está en la base de datos y el script nunca lo borra."))
    ancho(ws, {1: 12, 2: 10, 3: 62, 4: 34})
    ws.freeze_panes = "A5"

    # ---------- Detalle ----------
    ws = wb.create_sheet(HOJA_DETALLE)
    for columna, titulo in enumerate(["Caja", "Título", "Autor", "Categoría"], 1):
        ws.cell(row=1, column=columna, value=titulo).font = negrita
    fila = 2
    for caja in cajas:
        for libro in sorted(por_caja.get(caja, []), key=lambda l: (
                (l.get("categoria") or "").lower(), (l.get("autor") or "").lower(),
                (l.get("titulo") or "").lower())):
            ws.cell(row=fila, column=1, value=caja)
            ws.cell(row=fila, column=2, value=libro.get("titulo"))
            ws.cell(row=fila, column=3, value=libro.get("autor"))
            ws.cell(row=fila, column=4, value=libro.get("categoria"))
            fila += 1
    ancho(ws, {1: 12, 2: 70, 3: 28, 4: 18})
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:D{fila - 1}"

    # ---------- Otros objetos ----------
    ws = wb.create_sheet(HOJA_OTROS)
    for columna, titulo in enumerate(COLUMNAS_OTROS, 1):
        ws.cell(row=1, column=columna, value=titulo).font = negrita
    for i, objeto in enumerate(otros, start=2):
        for columna, valor in enumerate(objeto, 1):
            ws.cell(row=i, column=columna, value=valor)
    # El aviso va fuera de las columnas de datos (y empieza por ↑) para que al
    # releer la hoja no se confunda con un objeto más.
    aviso = ws.cell(row=1, column=7, value=(
        "↑ Esta hoja es tuya: añade una fila por cada cosa que no sea un libro, "
        "con la caja donde la metes. El script solo la lee, nunca la borra."))
    aviso.font = Font(italic=True, color="777777")
    aviso.alignment = Alignment(wrap_text=True, vertical="top")
    ancho(ws, {1: 34, 2: 20, 3: 12, 4: 40, 5: 14, 6: 3, 7: 46})
    ws.freeze_panes = "A2"

    wb.save(excel)
    excel.chmod(0o600)
    guardar_espejo(otros)
    ESPEJO_CSV.chmod(0o600)

    print(f"Excel:  {excel}")
    print(f"  {len(libros)} libros en {len([c for c in cajas if por_caja.get(c)])} sitios")
    for caja in cajas:
        extra = objetos_por_caja.get(caja) or []
        print(f"    {caja:<14} {len(por_caja.get(caja, [])):>3} libros"
              + (f"  + {', '.join(extra)}" if extra else ""))
    print(f"  {len(otros)} objetos que no son libros → espejo en {ESPEJO_CSV.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
