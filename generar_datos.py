# -*- coding: utf-8 -*-
"""Empaqueta el contenido de la aplicación de escritorio para la versión móvil.

Genera en `movil/datos/`:
  - banco.json          todas las preguntas fusionadas en un solo fichero
  - senales/*.png       solo las señales que alguna pregunta utiliza

Las señales oficiales se copian del catálogo. Las vectoriales están dibujadas
con tkinter en `dgtapp/senales.py`, así que en vez de reprogramarlas en
JavaScript se rasterizan aquí con el mismo código ya verificado.

    python movil/generar_datos.py
"""

from __future__ import annotations

import json
import shutil
import sys
import time
import tkinter as tk
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from dgtapp import catalogo, senales                      # noqa: E402
from dgtapp.banco import Banco                            # noqa: E402

DESTINO = RAIZ / "movil" / "datos"
DIR_SENALES = DESTINO / "senales"
LADO_VECTORIAL = 380          # px del PNG que se genera para cada dibujo


def rasterizar(identificadores: set[str]) -> dict[str, str]:
    """Dibuja cada señal vectorial en un Canvas y la guarda como PNG."""
    from PIL import ImageGrab

    raiz = tk.Tk()
    raiz.title("Generando señales…")
    raiz.geometry(f"{LADO_VECTORIAL}x{LADO_VECTORIAL}+30+30")
    raiz.attributes("-topmost", True)     # o la captura cogería otra ventana
    lienzo = tk.Canvas(raiz, width=LADO_VECTORIAL, height=LADO_VECTORIAL,
                       bg="#ffffff", highlightthickness=0)
    lienzo.pack()

    # Sin este calentamiento las primeras capturas salen en negro: la ventana
    # todavía no se ha pintado cuando ImageGrab lee la pantalla.
    raiz.update()
    time.sleep(0.6)

    def capturar():
        raiz.lift()
        raiz.update()
        time.sleep(0.05)
        x, y = lienzo.winfo_rootx(), lienzo.winfo_rooty()
        return ImageGrab.grab(bbox=(x, y, x + LADO_VECTORIAL,
                                    y + LADO_VECTORIAL))

    generadas = {}
    for identificador in sorted(identificadores):
        lienzo.delete("all")
        senales.dibujar(lienzo, identificador, LADO_VECTORIAL / 2,
                        LADO_VECTORIAL / 2, LADO_VECTORIAL * 0.44)

        # Ninguna señal llega a las esquinas del lienzo, así que ahí debe
        # verse el fondo blanco. Si salen oscuras es que la captura ha cogido
        # la pantalla antes de que la ventana se pintara.
        for intento in range(5):
            imagen = capturar()
            d = 3
            esquinas = [imagen.getpixel(p) for p in (
                (d, d), (LADO_VECTORIAL - d, d),
                (d, LADO_VECTORIAL - d),
                (LADO_VECTORIAL - d, LADO_VECTORIAL - d))]
            if all(min(c[:3]) > 200 for c in esquinas):
                break
            time.sleep(0.5)
        else:
            raise RuntimeError(
                f"no se ha podido capturar la señal '{identificador}': "
                f"las esquinas salen {esquinas}")

        archivo = f"v_{identificador}.png"
        imagen.save(DIR_SENALES / archivo, optimize=True)
        generadas[identificador] = archivo
        if intento:
            print(f"  (aviso) '{identificador}' necesitó "
                  f"{intento + 1} intentos")

    raiz.destroy()
    return generadas


def main() -> int:
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DIR_SENALES.mkdir(parents=True)

    banco = Banco()
    oficiales: set[str] = set()
    vectoriales: set[str] = set()
    for pregunta in banco.preguntas:
        if not pregunta.senal:
            continue
        if catalogo.existe(pregunta.senal):
            oficiales.add(pregunta.senal)
        elif senales.existe(pregunta.senal):
            vectoriales.add(pregunta.senal)

    # --- señales oficiales: copia directa ---
    archivos: dict[str, str] = {}
    for codigo in sorted(oficiales):
        origen = catalogo.ruta(codigo)
        shutil.copy2(origen, DIR_SENALES / origen.name)
        archivos[codigo] = origen.name

    # --- señales vectoriales: se rasterizan ---
    archivos.update(rasterizar(vectoriales))

    # --- banco de preguntas ---
    preguntas = []
    for p in banco.preguntas:
        entrada = {
            "id": p.id, "tema": p.tema, "texto": p.texto,
            "opciones": p.opciones, "correcta": p.correcta,
            "explicacion": p.explicacion, "etiquetas": p.etiquetas,
        }
        if p.senal and p.senal in archivos:
            entrada["imagen"] = archivos[p.senal]
            entrada["senal"] = p.senal
        preguntas.append(entrada)

    salida = {
        "version": 1,
        "temas": {str(n): nombre for n, nombre in banco.temas.items()},
        "preguntas": preguntas,
    }
    (DESTINO / "banco.json").write_text(
        json.dumps(salida, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")

    peso = sum(f.stat().st_size for f in DESTINO.rglob("*")) / 1024 / 1024
    print(f"Preguntas:           {len(preguntas)}")
    print(f"Señales oficiales:   {len(oficiales)}")
    print(f"Señales rasterizadas:{len(vectoriales):4}")
    print(f"Total en datos/:     {peso:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
