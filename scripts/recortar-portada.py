#!/usr/bin/env python3
"""Recorta la cubierta de un libro fotografiado sobre un fondo oscuro.

Uso:  python3 scripts/recortar-portada.py foto.jpg portada.jpg

Sirve para las fotos que manda José Luis por WhatsApp (libro sobre la mesa
negra). Busca, columna a columna y fila a fila, dónde deja de haber fondo
—gris oscuro casi neutro— y recorta con 6 px de margen. Los colores oscuros
de la cubierta (azul marino, morado) se distinguen del fondo porque tienen
saturación. Comprobar siempre el resultado con la vista antes de subirlo.
"""
import sys
from PIL import Image

MARGEN = 6


def es_fondo(p) -> bool:
    return max(p) < 75 and (max(p) - min(p)) < 18


def limites(perfil, umbral):
    n = len(perfil)
    a = b = n // 2
    while a > 0 and perfil[a - 1] < umbral:
        a -= 1
    while b < n - 1 and perfil[b + 1] < umbral:
        b += 1
    return a, b


def recortar(origen: str, destino: str) -> None:
    im = Image.open(origen).convert("RGB")
    w, h = im.size
    px = im.load()
    columnas = [sum(es_fondo(px[x, y]) for y in range(0, h, 4)) / (h // 4) for x in range(w)]
    x0, x1 = limites(columnas, max(0.12, (sum(columnas[:15]) + sum(columnas[-15:])) / 30 * 0.5))
    filas = [sum(es_fondo(px[x, y]) for x in range(x0, x1, 4)) / ((x1 - x0) // 4) for y in range(h)]
    y0, y1 = limites(filas, max(0.12, (sum(filas[:10]) + sum(filas[-10:])) / 20 * 0.5))
    recorte = im.crop((x0 + MARGEN, y0 + MARGEN, x1 - MARGEN + 1, y1 - MARGEN + 1))
    recorte.save(destino, quality=90)
    print(f"caja {x0}-{x1} × {y0}-{y1} de {w}×{h} → {recorte.size[0]}×{recorte.size[1]} en {destino}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    recortar(sys.argv[1], sys.argv[2])
