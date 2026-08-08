# -*- coding: utf-8 -*-
"""Sirve la versión móvil para abrirla desde el teléfono.

    python movil/servir.py

Deja el ordenador y el móvil en la misma wifi y abre en el teléfono la
dirección que aparece en pantalla.
"""

from __future__ import annotations

import http.server
import socket
import socketserver
from pathlib import Path

PUERTO = 8765
CARPETA = Path(__file__).resolve().parent


def ip_local() -> str:
    """La IP del ordenador en la red local, sin depender del nombre de host."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))      # no envía nada, solo elige la interfaz
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(CARPETA), **kwargs)

    def end_headers(self):
        # Sin esto el navegador se queda con una versión antigua del banco.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, formato, *args):
        pass                            # sin ruido en la consola


def main() -> int:
    ip = ip_local()
    print()
    print("  Autoescuela DGT — versión móvil")
    print("  " + "-" * 44)
    print(f"  En este ordenador:  http://localhost:{PUERTO}/")
    print(f"  En el móvil:        http://{ip}:{PUERTO}/")
    print()
    print("  El móvil tiene que estar en la misma wifi.")
    print("  Para parar el servidor, cierra esta ventana o pulsa Ctrl+C.")
    print()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PUERTO), Manejador) as servidor:
        try:
            servidor.serve_forever()
        except KeyboardInterrupt:
            print("\n  Servidor detenido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
