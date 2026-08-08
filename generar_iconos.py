# -*- coding: utf-8 -*-
"""Genera los iconos que Android e iOS usan al instalar la PWA."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DESTINO = Path(__file__).resolve().parent / "iconos"
DESTINO.mkdir(exist_ok=True)

FONDO = "#0f151d"
ACENTO = "#f0a500"
ROJO = "#cc1122"
BLANCO = "#ffffff"


def icono(lado: int, recorte_seguro: bool = False) -> Image.Image:
    """recorte_seguro deja margen para los iconos 'maskable' de Android."""
    img = Image.new("RGB", (lado, lado), FONDO)
    d = ImageDraw.Draw(img)
    escala = 0.62 if recorte_seguro else 0.80
    r = lado * escala / 2
    cx = cy = lado / 2

    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ROJO)
    d.ellipse([cx - r * 0.74, cy - r * 0.74, cx + r * 0.74, cy + r * 0.74],
              fill=BLANCO)
    try:
        fuente = ImageFont.truetype("arialbd.ttf", int(r * 1.05))
    except OSError:
        fuente = ImageFont.load_default()
    d.text((cx, cy + r * 0.02), "B", fill="#151515", font=fuente, anchor="mm")
    return img


for lado in (192, 512):
    icono(lado).save(DESTINO / f"icono-{lado}.png", optimize=True)
icono(512, recorte_seguro=True).save(DESTINO / "icono-maskable.png",
                                     optimize=True)

# Favicon para cuando se abre en el navegador
icono(64).save(DESTINO / "favicon.png", optimize=True)

for f in sorted(DESTINO.iterdir()):
    print(f"  {f.name:22} {f.stat().st_size / 1024:.1f} KB")
