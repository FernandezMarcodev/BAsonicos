#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor + planificador del scraper para Render (plan free).

El plan free de Render duerme los servicios inactivos: este proceso expone un
endpoint HTTP mínimo que un "despertador" externo (UptimeRobot, cron-job.org,
etc.) pinguea cada pocos minutos para mantener la instancia viva, y un hilo en
background que ejecuta el scrapeo:

    - Inmediatamente al arrancar (primera corrida).
    - Luego cada 24 h a la hora configurada en SCRAPER_HORA_UTC (default 08:00).

Reutiliza toda la lógica de scraper.py (extracción, geocodificación, filtro
AMBA, persistencia y mantenimiento). No agrega dependencias: usa la stdlib.

Variables de entorno:
    PORT                   Puerto HTTP (Render lo inyecta; default 8080).
    SCRAPER_HORA_UTC       "HH:MM" en UTC para la corrida diaria (default 08:00).
    SCRAPER_MODO           "scrape" (default) o "mantenimiento".
    DB_*                   Igual que scraper.py (host, puerto, nombre, user,
                           password) + DB_SSLMODE para conexiones TLS.
"""
import argparse
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import scraper

SCHEGULER_NAME = "planificador-24h"


def parsear_port():
    try:
        return int(os.getenv("PORT", "8080"))
    except ValueError:
        return 8080


def parsear_hora_utc():
    valor = os.getenv("SCRAPER_HORA_UTC", "08:00")
    try:
        hh, mm = (int(p) for p in valor.strip().split(":"))
        if not (0 <= hh <= 23 and 0 <= mm <= 59):
            raise ValueError
        return hh, mm
    except ValueError:
        print(f"AVISO: SCRAPER_HORA_UTC inválido ('{valor}'), se usa 08:00 UTC.")
        return 8, 0


def _proxima_corrida(hh, mm):
    """Próximo datetime UTC con la hora indicada (si ya pasó hoy, mañana)."""
    ahora = datetime.now(timezone.utc)
    candidata = ahora.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if candidata <= ahora:
        candidata += timedelta(days=1)
    return candidata


def correr_corrida(modo):
    t0 = datetime.now(timezone.utc)
    print(f"[{SCHEGULER_NAME}] Iniciando corrida ({modo}) en {t0.isoformat()}...")
    try:
        if modo == "mantenimiento":
            scraper.mantenimiento()
        else:
            scraper.ejecutar_scrapeo()
        elapsed = (datetime.now(timezone.utc) - t0).total_seconds()
        print(f"[{SCHEGULER_NAME}] Corrida finalizada en {elapsed:.0f}s.")
    except Exception as e:
        print(f"[{SCHEGULER_NAME}] ERROR en la corrida: {e}")


def dormir_hasta(objetivo):
    """Duerme hasta `objetivo` en tramos cortos (permite salir a tiempo)."""
    while True:
        restante = (objetivo - datetime.now(timezone.utc)).total_seconds()
        if restante <= 0:
            return
        time.sleep(min(restante, 60))


def planificador():
    modo = os.getenv("SCRAPER_MODO", "scrape")
    hh, mm = parsear_hora_utc()

    # Primera corrida inmediata (al desplegar puebla la base al momento).
    correr_corrida(modo)

    while True:
        proxima = _proxima_corrida(hh, mm)
        print(f"[{SCHEGULER_NAME}] Próxima corrida: {proxima.isoformat()} "
              f"(en {(proxima - datetime.now(timezone.utc)).total_seconds() / 3600:.1f} h).")
        dormir_hasta(proxima)
        correr_corrida(modo)


class Handler(BaseHTTPRequestHandler):
    """Endpoint mínimo para el despertador externo y el healthcheck de Render."""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    def do_HEAD(self):
        self.do_GET()

    def log_message(self, formato, *args):
        # Silencia el log por request (UptimeRobot pinguea cada pocos minutos).
        return


def main():
    parser = argparse.ArgumentParser(
        description="Servidor + planificador diario del scraper (para Render)."
    )
    parser.add_argument("--solo-hora", action="store_true", help="imprimir la próxima corrida y salir")
    args = parser.parse_args()

    scraper.cargar_env()

    hh, mm = parsear_hora_utc()
    if args.solo_hora:
        print(_proxima_corrida(hh, mm).isoformat())
        return

    port = parsear_port()

    hilo = threading.Thread(target=planificador, name=SCHEGULER_NAME, daemon=True)
    hilo.start()

    servidor = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"[http] Escuchando en 0.0.0.0:{port} (mantiene la instancia viva).")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nDetenido por el usuario.")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()