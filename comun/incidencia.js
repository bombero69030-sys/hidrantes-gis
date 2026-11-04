/* ============================================================
   PORTAL OPERATIVO · INCIDENCIA ACTIVA
   Núcleo compartido por todos los módulos.

   Guarda el punto de la incidencia en sessionStorage, de modo que
   si saltas de Hidrantes a Sótanos o a Patrimonio no hay que volver
   a teclear la dirección. Se borra al cerrar el navegador.

   Expone: Incidencia.get / set / limpiar / alEscuchar
           Incidencia.geocodificar / posicionGPS
           Incidencia.ruta / haversine / fmtDist / fmtDur
           Incidencia.enlaceNavegador / coordOK
           Incidencia.pintarBarra
   ============================================================ */
(function(global){
'use strict';

const CLAVE   = 'portal_incidencia';
const PARQUE  = {lat:37.1606665, lon:-5.9371868, nombre:'Parque de Bomberos — Pol. El Muro'};
const OSRM    = 'https://router.project-osrm.org/route/v1/driving/';
const T_OSRM  = 5000;
const T_GEO   = 8000;

/* Recuadro de seguridad: provincia de Sevilla y alrededores.
   Fuera de aquí Leaflet pide teselas sin fin y el navegador se cae. */
const LIMITES = {latMin:36.0, latMax:38.5, lonMin:-7.0, lonMax:-4.0};
function coordOK(lat, lon){
  return typeof lat === 'number' && typeof lon === 'number' &&
         isFinite(lat) && isFinite(lon) &&
         lat >= LIMITES.latMin && lat <= LIMITES.latMax &&
         lon >= LIMITES.lonMin && lon <= LIMITES.lonMax;
}

/* ---------- estado ---------- */
const oyentes = [];
function get(){
  try{
    const bruto = sessionStorage.getItem(CLAVE);
    if(!bruto) return null;
    const i = JSON.parse(bruto);
    return coordOK(i.lat, i.lon) ? i : null;
  }catch(e){ return null; }
}
function set(inc){
  if(!coordOK(inc.lat, inc.lon)) throw new Error('Coordenadas fuera de la provincia');
  const guardada = {
    lat: inc.lat, lon: inc.lon,
    etiqueta: inc.etiqueta || `${inc.lat.toFixed(5)}, ${inc.lon.toFixed(5)}`,
    origen: inc.origen || 'manual',          // direccion | gps | mapa
    tipo: inc.tipo || null,                  // vivienda | garaje | patrimonio | otro
    cuando: Date.now()
  };
  try{ sessionStorage.setItem(CLAVE, JSON.stringify(guardada)); }catch(e){}
  oyentes.forEach(f=>{ try{ f(guardada); }catch(e){} });
  return guardada;
}
function limpiar(){
  try{ sessionStorage.removeItem(CLAVE); }catch(e){}
  oyentes.forEach(f=>{ try{ f(null); }catch(e){} });
}
function alEscuchar(fn){ oyentes.push(fn); }

/* ---------- geocodificación ---------- */
/* Nominatim, acotado a la provincia para que "Calle Real" no devuelva Madrid.
   Si el texto no menciona municipio, se asume Los Palacios y Villafranca. */
const MUNICIPIOS = ['los palacios','villafranca','sevilla','dos hermanas','utrera',
                    'alcalá','alcala','coria','puebla','lebrija','guadaíra','guadaira'];

async function geocodificar(texto){
  const limpio = (texto||'').trim();
  if(limpio.length < 3) throw new Error('Escribe al menos tres letras');

  const bajo = limpio.toLowerCase();
  const tieneMunicipio = MUNICIPIOS.some(m => bajo.includes(m));
  const consulta = tieneMunicipio ? limpio
                                  : `${limpio}, Los Palacios y Villafranca, Sevilla`;

  const url = 'https://nominatim.openstreetmap.org/search'
            + `?q=${encodeURIComponent(consulta)}`
            + '&format=jsonv2&addressdetails=1&limit=6&countrycodes=es'
            + `&viewbox=${LIMITES.lonMin},${LIMITES.latMax},${LIMITES.lonMax},${LIMITES.latMin}`
            + '&bounded=1';

  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), T_GEO);
  let datos;
  try{
    const r = await fetch(url, {signal: ctrl.signal, headers:{'Accept-Language':'es'}});
    if(!r.ok) throw new Error('El buscador de direcciones no responde');
    datos = await r.json();
  }catch(e){
    throw new Error(e.name === 'AbortError'
      ? 'El buscador de direcciones tarda demasiado'
      : 'Sin conexión con el buscador de direcciones');
  }finally{ clearTimeout(t); }

  const salida = (datos||[])
    .map(d => ({
      lat: parseFloat(d.lat), lon: parseFloat(d.lon),
      etiqueta: etiquetaCorta(d),
      completa: d.display_name
    }))
    .filter(d => coordOK(d.lat, d.lon));

  if(!salida.length) throw new Error(`No se encuentra «${limpio}»`);
  return salida;
}

/* "Calle Soleá 14 · Los Palacios y Villafranca" en vez del nombre kilométrico de OSM */
function etiquetaCorta(d){
  const a = d.address || {};
  const via = a.road || a.pedestrian || a.square || a.neighbourhood || d.name || '';
  const num = a.house_number ? ' ' + a.house_number : '';
  const pueblo = a.town || a.village || a.city || a.municipality || '';
  const calle = (via + num).trim();
  if(calle && pueblo) return `${calle} · ${pueblo}`;
  if(calle) return calle;
  return (d.display_name || '').split(',').slice(0,2).join(',').trim();
}

/* ---------- GPS ---------- */
function posicionGPS(){
  return new Promise((res, rej)=>{
    if(!navigator.geolocation) return rej(new Error('Este navegador no tiene GPS'));
    navigator.geolocation.getCurrentPosition(
      p => {
        const lat = p.coords.latitude, lon = p.coords.longitude;
        if(!coordOK(lat, lon)) return rej(new Error('El GPS da una posición fuera de la provincia'));
        res({lat, lon, precision: p.coords.accuracy});
      },
      e => rej(new Error(e.code === 1
        ? 'Has denegado el permiso de ubicación'
        : 'No se consigue señal GPS')),
      {enableHighAccuracy:true, timeout:10000, maximumAge:15000}
    );
  });
}

/* ---------- distancias y rutas ---------- */
function haversine(lat1, lon1, lat2, lon2){
  const R = 6371000, rad = Math.PI/180;
  const dLat = (lat2-lat1)*rad, dLon = (lon2-lon1)*rad;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

/* Ruta por calles. Devuelve {dist, dur, coords} o null si OSRM no contesta. */
async function ruta(desdeLat, desdeLon, hastaLat, hastaLon){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), T_OSRM);
  try{
    const url = `${OSRM}${desdeLon},${desdeLat};${hastaLon},${hastaLat}?overview=full&geometries=geojson`;
    const r = await fetch(url, {signal: ctrl.signal});
    if(!r.ok) return null;
    const d = await r.json();
    if(d.code !== 'Ok' || !d.routes || !d.routes.length) return null;
    return {
      dist: d.routes[0].distance,
      dur: d.routes[0].duration,
      coords: d.routes[0].geometry.coordinates.map(([x,y])=>[y,x])
    };
  }catch(e){ return null; }
  finally{ clearTimeout(t); }
}

/* Varias rutas a la vez, tolerando fallos sueltos */
function rutas(desdeLat, desdeLon, destinos){
  return Promise.all(destinos.map(d => ruta(desdeLat, desdeLon, d.lat, d.lon)));
}

function fmtDist(m){
  if(m == null) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`;
}
function fmtDur(s){
  if(s == null) return '—';
  const min = Math.round(s/60);
  return min < 1 ? '<1 min' : `${min} min`;
}

/* Conducir de verdad se hace en el navegador del vehículo, no aquí */
function enlaceNavegador(lat, lon){
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

/* ---------- barra de incidencia activa ---------- */
/* Se inyecta en cualquier módulo. alCambiar() lo lleva a su pantalla de entrada. */
const CSS_BARRA = `
#inc-barra{display:none;align-items:center;gap:12px;padding:8px 16px;
  background:#7B241C;color:#fff;font-family:'Barlow Condensed',Barlow,system-ui,sans-serif;
  font-size:14px;letter-spacing:.03em;border-bottom:1px solid rgba(255,255,255,.2)}
#inc-barra.visible{display:flex}
#inc-barra .inc-pin{font-size:15px;flex-shrink:0}
#inc-barra .inc-txt{font-weight:700;text-transform:uppercase;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
#inc-barra .inc-dato{opacity:.85;font-weight:400;white-space:nowrap;flex-shrink:0}
#inc-barra button{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.35);
  color:#fff;font:inherit;font-size:12px;font-weight:600;text-transform:uppercase;
  letter-spacing:.06em;padding:4px 11px;border-radius:4px;cursor:pointer;flex-shrink:0}
#inc-barra button:hover{background:rgba(255,255,255,.28)}
@media(max-width:720px){ #inc-barra .inc-dato{display:none} }`;

function pintarBarra(opciones){
  opciones = opciones || {};
  if(!document.getElementById('inc-barra-css')){
    const s = document.createElement('style');
    s.id = 'inc-barra-css'; s.textContent = CSS_BARRA;
    document.head.appendChild(s);
  }
  let barra = document.getElementById('inc-barra');
  if(!barra){
    barra = document.createElement('div');
    barra.id = 'inc-barra';
    const ancla = opciones.despuesDe && document.querySelector(opciones.despuesDe);
    if(ancla && ancla.parentNode) ancla.parentNode.insertBefore(barra, ancla.nextSibling);
    else document.body.insertBefore(barra, document.body.firstChild);
  }

  function dibujar(inc){
    if(!inc){ barra.classList.remove('visible'); barra.innerHTML = ''; return; }
    const d = haversine(PARQUE.lat, PARQUE.lon, inc.lat, inc.lon);
    barra.innerHTML = `
      <span class="inc-pin">📍</span>
      <span class="inc-txt"></span>
      <span class="inc-dato">${fmtDist(d)} del parque</span>
      <button type="button" data-inc="cambiar">Cambiar</button>
      <button type="button" data-inc="cerrar">Cerrar incidencia</button>`;
    barra.querySelector('.inc-txt').textContent = inc.etiqueta;
    barra.classList.add('visible');
    barra.querySelector('[data-inc="cambiar"]').onclick = () => {
      if(typeof opciones.alCambiar === 'function') opciones.alCambiar();
    };
    barra.querySelector('[data-inc="cerrar"]').onclick = () => {
      if(confirm('¿Cerrar la incidencia activa?')) limpiar();
    };
  }

  dibujar(get());
  alEscuchar(dibujar);
  return barra;
}

global.Incidencia = {
  PARQUE, LIMITES,
  get, set, limpiar, alEscuchar,
  geocodificar, posicionGPS,
  haversine, ruta, rutas,
  fmtDist, fmtDur, enlaceNavegador, coordOK,
  pintarBarra
};

})(window);
