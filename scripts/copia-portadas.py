#!/usr/bin/env python3
"""Baja una copia de las portadas del catálogo a partir del CSV de /admin/exportar.

Uso:  python3 scripts/copia-portadas.py [ruta-del-csv]

Sin argumentos coge el CSV más reciente de copias/. Guarda las imágenes en
copias/portadas-AAAA-MM-DD/, con el nombre del libro en vez del código interno,
para que la carpeta se pueda hojear como un álbum. Salta las que ya estén
bajadas, así repetirlo sale barato.
"""
import csv
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
COPIAS = RAIZ / "copias"


def nombre_seguro(texto: str, limite: int = 90) -> str:
    """Convierte un título en un nombre de fichero legible y sin sorpresas."""
    texto = unicodedata.normalize("NFC", texto).strip()
    texto = re.sub(r'[/\\:*?"<>|\x00-\x1f]', "-", texto)  # prohibidos en macOS/Windows
    texto = re.sub(r"\s+", " ", texto).strip(" .")
    return texto[:limite].strip() or "sin-titulo"


def main() -> int:
    if len(sys.argv) > 1:
        csv_path = Path(sys.argv[1])
    else:
        candidatos = sorted(COPIAS.glob("la-libreria-de-jl-*.csv"))
        if not candidatos:
            print("No encuentro ningún CSV en copias/. Baja primero la copia del catálogo.")
            return 1
        csv_path = candidatos[-1]

    destino = COPIAS / f"portadas-{date.today():%Y-%m-%d}"
    destino.mkdir(parents=True, exist_ok=True)
    print(f"CSV:     {csv_path.name}")
    print(f"Destino: {destino}\n")

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        libros = list(csv.DictReader(f, delimiter=";"))

    bajadas = saltadas = sin_portada = 0
    fallos: list[tuple[str, str]] = []
    usados: set[str] = set()

    for libro in libros:
        url = (libro.get("Portada (URL)") or "").strip()
        titulo = (libro.get("Título") or "").strip()
        autor = (libro.get("Autor") or "").strip()
        if not url:
            sin_portada += 1
            continue

        extension = Path(url.split("?")[0]).suffix.lower() or ".jpg"
        base = nombre_seguro(f"{titulo} - {autor}" if autor else titulo)
        candidato, n = base, 2
        while candidato in usados:  # dos ediciones del mismo título
            candidato, n = f"{base} ({n})", n + 1
        usados.add(candidato)
        fichero = destino / f"{candidato}{extension}"

        if fichero.exists() and fichero.stat().st_size > 0:
            saltadas += 1
            continue

        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                datos = r.read()
            if not datos:
                raise ValueError("respuesta vacía")
            fichero.write_bytes(datos)
            bajadas += 1
        except (urllib.error.URLError, ValueError, OSError) as e:
            fallos.append((titulo, str(e)))

    print(f"  bajadas:      {bajadas}")
    print(f"  ya estaban:   {saltadas}")
    print(f"  sin portada:  {sin_portada}")
    print(f"  fallos:       {len(fallos)}")
    for titulo, motivo in fallos:
        print(f"    · {titulo}: {motivo}")

    peso = sum(f.stat().st_size for f in destino.iterdir() if f.is_file())
    print(f"\n  {len(list(destino.iterdir()))} ficheros · {peso / 1024 / 1024:.1f} MB en {destino.name}")
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
