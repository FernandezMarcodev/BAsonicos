#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper de conciertos para BAsónicos (backend en Go).

Los scrapers siguen siendo scripts de Python: este script se encarga de la
extracción (agendade.com.ar), geocodificación (Nominatim/OSM), el filtro de la
región AMBA, la persistencia y el mantenimiento de la base. El backend Go solo
lo orquesta (endpoint manual + scheduler).

Modos:
    python scraper.py scrape          # extracción + inserción + sync (como antes)
    python scraper.py mantenimiento   # limpieza diaria (pasados, fuera de AMBA, duplicados)
"""
import argparse
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Región: solo Buenos Aires y alrededores (CABA + GBA + La Plata/Cañuelas).
AMBA_MIN_LAT = -35.15
AMBA_MAX_LAT = -34.2
AMBA_MIN_LNG = -58.95
AMBA_MAX_LNG = -57.7

HEADERS_NAV = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

URL_AGENDA = "https://www.agendade.com.ar/agenda?deb54158_page="


def en_amba(lng, lat):
    return (AMBA_MIN_LAT <= lat <= AMBA_MAX_LAT) and (AMBA_MIN_LNG <= lng <= AMBA_MAX_LNG)


def cargar_env():
    """Busca el .env (backend/.env o raíz) para correr el script de forma manual."""
    base = Path(__file__).resolve().parent
    candidatos = [
        Path.cwd() / ".env",
        base / ".env",
        base.parent / "backend" / ".env",
        base.parent / ".env",
    ]
    for candidato in candidatos:
        if candidato.exists():
            load_dotenv(candidato, override=False)
            print(f"Config cargada desde {candidato}")
            return
    print("AVISO: no se encontró un archivo .env (se usan variables de entorno).")


def conectar():
    kwargs = dict(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "conciertos"),
        user=os.getenv("DB_USER", "conciertos"),
        password=os.getenv("DB_PASSWORD", "conciertos_dev"),
    )
    sslmode = os.getenv("DB_SSLMODE", "")
    if sslmode:
        kwargs["sslmode"] = sslmode
    conn = psycopg2.connect(**kwargs)
    conn.autocommit = True
    print("Conexión a la base establecida.")
    return conn


# ----------------------------------------------------------------------------
# Geocodificación
# ----------------------------------------------------------------------------
def get_coordenadas(location_name):
    """
    Obtiene las coordenadas usando Nominatim de OpenStreetMap (gratuito).
    Restringido a Argentina y al área AMBA para evitar geocodificar a otro país.
    """
    base_url = "https://nominatim.openstreetmap.org/search"
    params = {
        'q': location_name,
        'format': 'json',
        'limit': 5,
        'countrycodes': 'ar',
    }
    headers = {'User-Agent': 'VenueLocator/1.0'}
    try:
        response = requests.get(base_url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        if data and len(data) > 0:
            for resultado in data:
                lat = float(resultado['lat'])
                lon = float(resultado['lon'])
                if en_amba(lon, lat):
                    return str(lat), str(lon)
        return None, None
    except Exception as e:
        print(f"Error al obtener coordenadas para {location_name}: {e}")
        return None, None


# ----------------------------------------------------------------------------
# Acceso a la base (psycopg2 — reemplaza SQLAlchemy/geoalchemy2)
# ----------------------------------------------------------------------------
def buscar_ubicacion(conn, normalizado, nombre_original):
    cur = conn.cursor()
    cur.execute("SELECT id, nombre FROM ubicaciones WHERE lower(trim(nombre)) = %s", (normalizado,))
    row = cur.fetchone()
    if row:
        return {'id': row[0], 'nombre': row[1]}
    cur.execute(
        "SELECT id, nombre FROM ubicaciones WHERE nombre ILIKE %s LIMIT 1",
        (f"%{nombre_original}%",),
    )
    row = cur.fetchone()
    if row:
        return {'id': row[0], 'nombre': row[1]}
    return None


def insertar_ubicacion(conn, nombre, lon, lat):
    url_maps = f'https://www.google.com/maps/search/?api=1&query={lat},{lon}'
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO ubicaciones (nombre, capacidad_total, coordenadas, url_maps) "
        "VALUES (%s, 0, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s) RETURNING id",
        (nombre, lon, lat, url_maps),
    )
    nuevo_id = cur.fetchone()[0]
    return nuevo_id


def obtener_punto(conn, venue_id):
    cur = conn.cursor()
    cur.execute(
        "SELECT ST_X(coordenadas), ST_Y(coordenadas) FROM ubicaciones WHERE id = %s",
        (venue_id,),
    )
    row = cur.fetchone()
    if not row or row[0] is None or row[1] is None:
        return None
    return {'lng': float(row[0]), 'lat': float(row[1])}


def existe_concierto(conn, artista, fecha, hora, lugar):
    cur = conn.cursor()
    cur.execute(
        """
        SELECT c.id FROM conciertos c
        JOIN ubicaciones u ON u.id = c.ubicacion
        WHERE lower(trim(c.artista)) = %s
          AND c.fecha = %s
          AND c.hora = %s
          AND lower(trim(u.nombre)) = %s
        LIMIT 1
        """,
        ((artista or '').strip().lower(), fecha, hora, lugar),
    )
    return cur.fetchone() is not None


def insertar_concierto(conn, nombre_evento, artista, url_evento, ubicacion_id, fecha, hora):
    url = (url_evento[:100] if url_evento else None)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO conciertos (nombre, artista, url_evento, ubicacion, fecha, hora) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (nombre_evento, artista, url, ubicacion_id, fecha, hora),
    )


def _clave_concierto(artista, fecha, hora, lugar):
    a = (artista or '').strip().lower()
    f = '' if fecha is None else str(fecha)
    h = '' if hora is None else hora.strftime('%H:%M')
    return f"{a}|{f}|{h}|{(lugar or '').strip().lower()}"


def _clave_concierto_crudo(artista, fecha_cruda, hora_cruda, lugar):
    """Clave a partir de los datos tal como vienen del sitio (sin normalizar fecha/hora).

    Se usa para marcar como 'vigente en el sitio' un concierto aunque el parsing
    de fecha/hora o la geocodificación fallen en la corrida. Así el sync de
    ausentes no borra conciertos legítimos por fallos transitorios.
    """
    a = (artista or '').strip().lower()
    f = (fecha_cruda or '').strip()
    h = (hora_cruda or '').strip()
    return f"{a}|{f}|{h}|{(lugar or '').strip().lower()}"


# ----------------------------------------------------------------------------
# Scrapeo (extracción + persistencia + sync)
# ----------------------------------------------------------------------------
def ejecutar_scrapeo():
    conciertos = []
    conn = conectar()
    try:
        claves_vigentes = set()
        claves_en_sitio = set()
        max_paginas = 60
        page = 1
        while True:
            url_base = f"{URL_AGENDA}{page}"
            print("procesando pagina " + url_base)
            response = requests.get(url_base, headers=HEADERS_NAV, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            lista_conciertos = soup.find('div', {
                'fs-cmsload-element': 'list',
                'fs-cmsfilter-element': 'list',
            })
            if not lista_conciertos:
                print("Sin lista de conciertos, se detiene la paginación.")
                break
            items = lista_conciertos.find_all('div', {'role': 'listitem'})
            if not items:
                print("Página sin conciertos, se detiene la paginación.")
                break
            for idx, item in enumerate(items, 1):
                try:
                    link_element = item.find('a', class_='link-block-11')
                    if not link_element or not link_element.get('href'):
                        continue
                    href = link_element['href']
                    url_concierto = f"https://www.agendade.com.ar{href}" if href.startswith('/') else href

                    time.sleep(1)
                    response_concierto = requests.get(url_concierto, headers=HEADERS_NAV, timeout=30)
                    response_concierto.raise_for_status()
                    soup_concierto = BeautifulSoup(response_concierto.content, 'html.parser')

                    info_div = soup_concierto.find('div', class_='div-block-192')
                    if not info_div:
                        continue

                    boton_compra = soup_concierto.find('a', class_='boton-comprar-entradas w-button')
                    url_concierto = boton_compra.get("href") if boton_compra else url_concierto

                    nombre_evento = info_div.get('data-event-title', '')
                    ubicacion_data = info_div.get('data-event-location', '')

                    artista = ''
                    ubicacion = ubicacion_data
                    fecha = ''
                    hora = ''

                    bloques_info = info_div.find_all('div', class_='div-block-243')
                    for bloque in bloques_info:
                        titulo = bloque.find('div', class_='titulo-chico')
                        valor = bloque.find('div', class_='titulo-intermedio')
                        if titulo and valor:
                            titulo_texto = titulo.get_text(strip=True).upper()
                            valor_texto = valor.get_text(strip=True)
                            if titulo_texto in ('ARTISTA', 'SHOW'):
                                if not artista:
                                    artista = valor_texto
                            elif titulo_texto == 'VENUE':
                                ubicacion = valor_texto
                            elif titulo_texto == 'UBICACIÓN':
                                if ubicacion:
                                    ubicacion = f"{ubicacion}, {valor_texto}"
                                else:
                                    ubicacion = valor_texto
                            elif titulo_texto == 'FECHA':
                                fecha = valor_texto
                            elif titulo_texto == 'HORARIO':
                                hora = valor_texto

                    if not artista:
                        artista = nombre_evento

                    concierto_info = {
                        'nombre_evento': nombre_evento,
                        'artista': artista,
                        'url_evento': url_concierto,
                        'ubicacion': ubicacion,
                        'fecha': fecha,
                        'hora': hora,
                    }
                    print("concierto de " + nombre_evento)
                    conciertos.append(concierto_info)

                    # Marcar como vigente en el sitio ANTES de cerrar la ubicación/fecha,
                    # para que un fallo transitorio de red/geocodificación no haga que el
                    # sync de ausentes borre conciertos que en realidad siguen existiendo.
                    claves_en_sitio.add(_clave_concierto_crudo(artista, fecha, hora, ubicacion))

                    # --- AGREGAR A LA BASE DE DATOS ---
                    nombre_lugar_normalizado = (ubicacion or '').strip().lower()
                    ubicacion_obj = buscar_ubicacion(conn, nombre_lugar_normalizado, ubicacion)
                    if not ubicacion_obj:
                        lat, lon = get_coordenadas(ubicacion)
                        if not (lat and lon):
                            print(f"No se encontró ubicación para '{ubicacion}', no se agrega el concierto '{nombre_evento}'")
                            continue
                        if not en_amba(float(lon), float(lat)):
                            print(f"'{ubicacion}' está fuera del área de Buenos Aires y alrededores, no se agrega el concierto '{nombre_evento}'")
                            continue
                        nuevo_id = insertar_ubicacion(conn, ubicacion, lon, lat)
                        ubicacion_obj = {'id': nuevo_id, 'nombre': ubicacion}
                    else:
                        # Reusar la ubicación encontrada: su nombre define la clave estable.
                        nombre_lugar_normalizado = (ubicacion_obj['nombre'] or '').strip().lower()
                        punto_reuso = obtener_punto(conn, ubicacion_obj['id'])
                        if punto_reuso is None or not en_amba(punto_reuso['lng'], punto_reuso['lat']):
                            print(f"'{ubicacion}' está fuera del área de Buenos Aires y alrededores, no se agrega el concierto '{nombre_evento}'")
                            continue

                    # Parsear fecha y hora
                    nueva_fecha = None
                    nueva_hora = None
                    try:
                        if fecha:
                            ddmmyy = fecha.split(sep='/')
                            nueva_fecha = '20' + ddmmyy[2] + '-' + ddmmyy[1] + '-' + ddmmyy[0]
                        if hora:
                            if len(hora.split(":")) == 2:
                                nueva_hora = datetime.strptime(hora, "%H:%M").time()
                            else:
                                nueva_hora = datetime.strptime(hora, "%H:%M:%S").time()
                    except Exception:
                        pass

                    claves_vigentes.add(_clave_concierto(artista, nueva_fecha, nueva_hora, nombre_lugar_normalizado))

                    if existe_concierto(conn, artista, nueva_fecha, nueva_hora, nombre_lugar_normalizado):
                        print(f"Ya existe en la BD: '{artista}' en {nueva_fecha} {nueva_hora} — se omite")
                        continue

                    insertar_concierto(conn, nombre_evento, artista, url_concierto, ubicacion_obj['id'], nueva_fecha, nueva_hora)
                except Exception as e:
                    print(f"Error procesando concierto {idx}: {str(e)}")
                    continue

            page += 1
            if page > max_paginas:
                print("Se alcanzó el tope de paginación, se detiene.")
                break

        print(f"\n{'=' * 50}")
        print(f"Total de conciertos extraídos: {len(conciertos)}")
        print(f"{'=' * 50}")

        # Mantener la base vigente: pasados, fuera de región, lugares duplicados, duplicados y ausentes
        eliminar_conciertos_pasados(conn)
        eliminar_fuera_de_amba(conn)
        fusionar_ubicaciones(conn)
        eliminar_duplicados(conn)
        if conciertos:
            eliminar_conciertos_ausentes(conn, claves_vigentes, claves_en_sitio)

    except Exception as e:
        print(f"Error al obtener la página principal: {str(e)}")
    finally:
        conn.close()

    return conciertos


# ----------------------------------------------------------------------------
# Mantenimiento (limpieza diaria)
# ----------------------------------------------------------------------------
def eliminar_conciertos_pasados(conn):
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM conciertos WHERE fecha < CURRENT_DATE")
        eliminados = cur.rowcount
        print(f"Limpieza: {eliminados} conciertos pasados eliminados.")
        return eliminados
    except Exception as e:
        print(f"Error al eliminar conciertos pasados: {e}")
        return 0


def eliminar_fuera_de_amba(conn):
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT c.id, ST_X(u.coordenadas), ST_Y(u.coordenadas) "
            "FROM conciertos c JOIN ubicaciones u ON u.id = c.ubicacion"
        )
        a_eliminar = []
        for cid, lng, lat in cur.fetchall():
            if lng is None or lat is None or not en_amba(float(lng), float(lat)):
                a_eliminar.append(cid)

        eliminados = 0
        if a_eliminar:
            cur.execute("DELETE FROM conciertos WHERE id = ANY(%s)", (a_eliminar,))
            eliminados = cur.rowcount
            print(f"Limpieza: {eliminados} conciertos fuera del área de Buenos Aires eliminados.")
        else:
            print("Limpieza: sin conciertos fuera del área de Buenos Aires.")

        # Eliminar también los lugares fuera de AMBA que quedaron sin conciertos,
        # para que el próximo scrape no los reutilice al volver a aparecer el evento.
        cur.execute(
            "SELECT u.id, ST_X(u.coordenadas), ST_Y(u.coordenadas) "
            "FROM ubicaciones u "
            "WHERE NOT EXISTS (SELECT 1 FROM conciertos c WHERE c.ubicacion = u.id)"
        )
        venues_eliminar = []
        for vid, lng, lat in cur.fetchall():
            if lng is None or lat is None or not en_amba(float(lng), float(lat)):
                venues_eliminar.append(vid)
        if venues_eliminar:
            cur.execute("DELETE FROM ubicaciones WHERE id = ANY(%s)", (venues_eliminar,))
            print(f"Limpieza: {cur.rowcount} lugares fuera del área de Buenos Aires eliminados.")
        return eliminados
    except Exception as e:
        print(f"Error al eliminar conciertos fuera del área de Buenos Aires: {e}")
        return 0


def eliminar_duplicados(conn):
    try:
        cur = conn.cursor()
        cur.execute(
            """
            DELETE FROM conciertos a
            USING conciertos b, ubicaciones ua, ubicaciones ub
            WHERE b.id < a.id
              AND ua.id = a.ubicacion
              AND ub.id = b.ubicacion
              AND lower(trim(a.artista)) = lower(trim(b.artista))
              AND a.fecha IS NOT DISTINCT FROM b.fecha
              AND a.hora IS NOT DISTINCT FROM b.hora
              AND lower(trim(ua.nombre)) = lower(trim(ub.nombre))
            """
        )
        print(f"Limpieza: {cur.rowcount} duplicados eliminados.")
        return cur.rowcount
    except Exception as e:
        print(f"Error al eliminar duplicados: {e}")
        return 0


def fusionar_ubicaciones(conn):
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, nombre FROM ubicaciones")
        grupos = {}
        for uid, nombre in cur.fetchall():
            clave = (nombre or '').strip().lower()
            if not clave:
                continue
            grupos.setdefault(clave, []).append(uid)

        fusionadas = 0
        for clave, lista in grupos.items():
            if len(lista) < 2:
                continue
            lista.sort()
            canonic = lista[0]
            for dup in lista[1:]:
                cur.execute(
                    "UPDATE conciertos SET ubicacion = %s WHERE ubicacion = %s",
                    (canonic, dup),
                )
                cur.execute("DELETE FROM ubicaciones WHERE id = %s", (dup,))
                fusionadas += 1
        if fusionadas:
            print(f"Limpieza: {fusionadas} lugares duplicados fusionados.")
        return fusionadas
    except Exception as e:
        print(f"Error al fusionar lugares duplicados: {e}")
        return 0


def eliminar_conciertos_ausentes(conn, claves_vigentes, claves_en_sitio=None):
    if not claves_vigentes and not claves_en_sitio:
        print("Sync: sin referencia (scrapeo sin datos), no se elimina nada.")
        return 0
    claves_en_sitio = claves_en_sitio or set()
    try:
        # Red de seguridad: pares (artista, lugar) vistos en el sitio esta corrida.
        artistas_en_sitio = set()
        lugares_en_sitio = set()
        for clave in claves_en_sitio:
            partes = clave.split('|')
            if len(partes) == 4:
                artistas_en_sitio.add(partes[0])
                lugares_en_sitio.add(partes[3])
        cur = conn.cursor()
        cur.execute(
            "SELECT c.id, c.artista, c.fecha, c.hora, u.nombre "
            "FROM conciertos c JOIN ubicaciones u ON u.id = c.ubicacion"
        )
        a_eliminar = []
        for cid, artista, fecha, hora, lugar in cur.fetchall():
            clave_canonica = _clave_concierto(artista, fecha, hora, lugar)
            if clave_canonica in claves_vigentes:
                continue
            # Si no aparece con la clave normalizada, verificar que no esté entre los
            # ítems vistos en el sitio durante esta corrida (datos crudos).
            clave_cruda_bd = _clave_concierto_crudo(
                artista,
                fecha.strftime('%d/%m/%y') if fecha else '',
                hora.strftime('%H:%M') if hora else '',
                lugar,
            )
            if clave_cruda_bd in claves_en_sitio:
                continue
            # Última red: si el (artista, lugar) se vio en el sitio, el concierto puede
            # seguir existiendo con fecha/hora que no pudieron normalizarse.
            if (artista or '').strip().lower() in artistas_en_sitio and \
               (lugar or '').strip().lower() in lugares_en_sitio:
                continue
            a_eliminar.append(cid)
        if not a_eliminar:
            print("Sync: todos los conciertos siguen existiendo en agendade.")
            return 0
        cur.execute("DELETE FROM conciertos WHERE id = ANY(%s)", (a_eliminar,))
        eliminados = cur.rowcount
        print(f"Sync: {eliminados} conciertos ya no existen en agendade — eliminados.")
        return eliminados
    except Exception as e:
        print(f"Error al eliminar conciertos ausentes: {e}")
        return 0


def mantenimiento():
    conn = conectar()
    try:
        eliminar_conciertos_pasados(conn)
        eliminar_fuera_de_amba(conn)
        fusionar_ubicaciones(conn)
        eliminar_duplicados(conn)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Scraper de conciertos (agendade.com.ar) y mantenimiento de la base."
    )
    parser.add_argument(
        "modo",
        nargs="?",
        default="scrape",
        choices=["scrape", "mantenimiento"],
        help="scrape (extrae e inserta) o mantenimiento (limpieza diaria)",
    )
    args = parser.parse_args()

    cargar_env()
    if args.modo == "scrape":
        ejecutar_scrapeo()
    else:
        mantenimiento()


if __name__ == "__main__":
    main()