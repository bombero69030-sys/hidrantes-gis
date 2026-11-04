/* ============================================================
   PORTAL OPERATIVO · ARMAZÓN DE MODO EMERGENCIA
   Pantalla completa compartida por Sótanos y Patrimonio.

   El módulo aporta sus datos y cómo se pintan; esto pone la
   pantalla: búsqueda entre fichas dadas de alta, respaldo por
   dirección, ruta desde el parque y panel operativo.

   Requiere: Leaflet y comun/incidencia.js
   Uso:  const EMG = Emergencia.crear({...});  EMG.abrir();
   ============================================================ */
(function(global){
'use strict';

const CSS = `
.emx{position:fixed;inset:0;z-index:5000;display:none;flex-direction:column;
  background:#0D0F12;color:#F2F3F5;font-family:system-ui,'DM Sans',sans-serif}
.emx.abierto{display:flex}
body:has(.emx.abierto) #pa-user{display:none!important}

.emx-top{display:flex;align-items:center;gap:14px;padding:12px 18px;flex-shrink:0;
  background:#15181C;border-bottom:1px solid #262B31}
.emx-rotulo{font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;
  display:flex;align-items:center;gap:8px;white-space:nowrap}
.emx-rotulo::before{content:'';width:9px;height:9px;border-radius:50%;background:currentColor;
  box-shadow:0 0 0 0 currentColor;animation:emxLatido 1.8s infinite}
@keyframes emxLatido{70%{box-shadow:0 0 0 9px transparent}100%{box-shadow:0 0 0 0 transparent}}
.emx-sitio{flex:1;min-width:0;font-size:17px;font-weight:600;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.emx-acciones{display:flex;gap:8px;flex-shrink:0}
.emx-bt{background:none;border:1px solid #3A4149;color:#9AA3AD;font:inherit;font-size:13px;
  padding:7px 15px;border-radius:5px;cursor:pointer;white-space:nowrap}
.emx-bt:hover{border-color:#5A636D;color:#F2F3F5}
.emx-bt.destacado{border-color:#6B757F;color:#F2F3F5;font-weight:600}
.emx-corto{display:none}

/* entrada */
.emx-entrada{flex:1;display:flex;flex-direction:column;align-items:center;gap:20px;
  padding:34px 20px;overflow-y:auto}
.emx-entrada h2{margin:0;font-size:27px;font-weight:600;text-align:center;line-height:1.2}
.emx-entrada .sub{margin:-10px 0 0;color:#9AA3AD;font-size:15px;text-align:center;max-width:52ch}
.emx-caja{width:100%;max-width:580px;display:flex;flex-direction:column;gap:12px}
.emx-campo{background:#15181C;border:2px solid #262B31;border-radius:7px;color:#F2F3F5;
  font:inherit;font-size:18px;padding:16px 18px;width:100%}
.emx-campo:focus{outline:none}
.emx-campo::placeholder{color:#6B747E}
.emx-btn2{background:#15181C;border:1px solid #3A4149;border-radius:7px;color:#D5DAE0;font:inherit;
  font-size:16px;padding:15px;cursor:pointer;width:100%;display:flex;align-items:center;
  justify-content:center;gap:10px}
.emx-btn2:hover{border-color:#5A636D;background:#1B1F24}
.emx-btn2:disabled{color:#6B747E;cursor:progress}
.emx-o{display:flex;align-items:center;gap:14px;color:#6B747E;font-size:12px;
  letter-spacing:.14em;text-transform:uppercase}
.emx-o::before,.emx-o::after{content:'';flex:1;height:1px;background:#262B31}
.emx-aviso{display:none;background:rgba(231,76,60,.12);border:1px solid rgba(231,76,60,.4);
  border-radius:6px;padding:12px 15px;font-size:15px;color:#F5A79D}
.emx-aviso.visible{display:block}
.emx-coincid{display:flex;flex-direction:column;gap:7px}
.emx-coincid button{text-align:left;background:#15181C;border:1px solid #262B31;border-radius:6px;
  color:#F2F3F5;font:inherit;font-size:16px;padding:14px 15px;cursor:pointer;
  display:flex;flex-direction:column;gap:3px}
.emx-coincid button:hover{background:#1B1F24}
.emx-coincid .c-sub{font-size:13px;color:#8A939D;font-weight:400}
.emx-nada{color:#8A939D;font-size:14.5px;padding:4px 2px;line-height:1.5}

/* resultado */
.emx-res{flex:1;display:none;min-height:0}
.emx-res.visible{display:flex}
.emx-panel{width:430px;flex-shrink:0;overflow-y:auto;padding:14px;display:flex;
  flex-direction:column;gap:11px;background:#101317;border-right:1px solid #262B31}
.emx-mapa{flex:1;min-width:0;background:#15181C}

.emx-aprox{background:#15181C;border:1px solid #262B31;border-left:4px solid #E67E22;
  border-radius:5px;padding:11px 14px;font-size:14px;color:#C5CCD3}
.emx-aprox b{color:#F2F3F5;font-size:17px}
.emx-bloque{background:#15181C;border:1px solid #262B31;border-radius:5px;padding:13px 15px;
  display:flex;flex-direction:column;gap:9px}
.emx-bloque.alerta{border-left:4px solid #E74C3C;background:rgba(231,76,60,.07)}
.emx-bloque.ojo{border-left:4px solid #E67E22}
.emx-bloque.calma{border-left:4px solid #27AE60}
.emx-rot{font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:#8A939D}
.emx-grande{font-size:25px;font-weight:700;line-height:1.1;color:#F2F3F5}
.emx-txt{font-size:15px;line-height:1.45;color:#D5DAE0}
.emx-chips{display:flex;flex-wrap:wrap;gap:7px}
.emx-chip{font-size:13.5px;font-weight:600;padding:5px 10px;border-radius:4px;background:#1F242A;
  color:#C5CCD3;border:1px solid #2D343B}
.emx-chip.mal{background:rgba(231,76,60,.15);color:#F1897D;border-color:rgba(231,76,60,.35)}
.emx-chip.ojo{background:rgba(230,126,34,.15);color:#F0A868;border-color:rgba(230,126,34,.35)}
.emx-chip.ok{background:rgba(39,174,96,.15);color:#6FCF97;border-color:rgba(39,174,96,.35)}
.emx-ul{margin:0;padding-left:19px;font-size:14.5px;line-height:1.55;color:#D5DAE0}
.emx-ul li{margin-bottom:3px}
.emx-ir{display:block;text-align:center;background:#1F242A;border:1px solid #3A4149;
  border-radius:5px;color:#D5DAE0;font:inherit;font-size:14px;font-weight:600;padding:11px;
  text-decoration:none;cursor:pointer;width:100%}
.emx-ir:hover{background:#2A3139;border-color:#5A636D;color:#fff}
.emx-ir.principal{background:#C0392B;border-color:#C0392B;color:#fff}
.emx-ir.principal:hover{background:#D1452F}
.emx-cargando{color:#8A939D;font-size:15px;text-align:center;padding:28px 10px}

/* tira de fotos dentro del panel */
.emx-tira{display:flex;gap:7px;overflow-x:auto;padding-bottom:3px;
  scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.emx-tira::-webkit-scrollbar{height:5px}
.emx-tira::-webkit-scrollbar-thumb{background:#3A4149;border-radius:3px}
.emx-foto{position:relative;flex:0 0 auto;width:132px;height:99px;border-radius:4px;
  overflow:hidden;background:#1F242A;border:1px solid #2D343B;cursor:zoom-in;
  scroll-snap-align:start;padding:0}
.emx-foto img{width:100%;height:100%;object-fit:cover;display:block}
.emx-foto figcaption{position:absolute;left:0;right:0;bottom:0;
  background:linear-gradient(transparent,rgba(0,0,0,.82));color:#fff;
  font-size:11px;font-weight:600;letter-spacing:.04em;padding:12px 6px 4px;text-align:left}
.emx-foto.falla{display:none}
.emx-sinfoto{font-size:13.5px;color:#6B747E;font-style:italic}

/* lupa */
.emx-lupa{position:fixed;inset:0;z-index:6000;display:none;align-items:center;
  justify-content:center;background:rgba(0,0,0,.93);padding:20px}
.emx-lupa.visible{display:flex}
.emx-lupa img{max-width:100%;max-height:88vh;object-fit:contain;border-radius:5px}
.emx-lupa-pie{position:absolute;bottom:16px;left:0;right:0;text-align:center;color:#C5CCD3;
  font-size:14px;padding:0 20px}
.emx-lupa-x{position:absolute;top:14px;right:16px;background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.3);color:#fff;font-size:20px;line-height:1;
  width:42px;height:42px;border-radius:50%;cursor:pointer}
.emx-lupa-x:hover{background:rgba(255,255,255,.25)}

@media(max-width:880px){
  .emx-res.visible{flex-direction:column}
  .emx-panel{width:auto;order:2;flex:1;border-right:none;border-top:1px solid #262B31}
  .emx-mapa{order:1;height:38vh;flex:none}
  .emx-top{flex-wrap:wrap;row-gap:9px;padding:10px 13px;gap:10px}
  .emx-rotulo{font-size:0;gap:0;order:0}
  .emx-sitio{flex:1 1 100%;order:1;font-size:15px;white-space:normal;line-height:1.2;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .emx-acciones{order:2;flex:1;justify-content:flex-end}
  .emx-largo{display:none}
  .emx-corto{display:inline}
  .emx-entrada h2{font-size:23px}
}
@media(prefers-reduced-motion:reduce){ .emx-rotulo::before{animation:none} }`;

function css(){
  if(document.getElementById('emx-css')) return;
  const s = document.createElement('style');
  s.id = 'emx-css'; s.textContent = CSS;
  document.head.appendChild(s);
}

/* Una sola lupa para todos los módulos */
let _lupa = null;
function lupa(url, pie){
  if(!_lupa){
    _lupa = document.createElement('div');
    _lupa.className = 'emx-lupa';
    _lupa.innerHTML = '<button class="emx-lupa-x" type="button" aria-label="Cerrar">✕</button>' +
                      '<img alt=""><div class="emx-lupa-pie"></div>';
    _lupa.addEventListener('click', e=>{
      if(e.target === _lupa || e.target.classList.contains('emx-lupa-x'))
        _lupa.classList.remove('visible');
    });
    document.addEventListener('keydown', e=>{
      if(e.key === 'Escape') _lupa.classList.remove('visible');
    });
    document.body.appendChild(_lupa);
  }
  _lupa.querySelector('img').src = url;
  _lupa.querySelector('.emx-lupa-pie').textContent = pie || '';
  _lupa.classList.add('visible');
}

function el(tag, clase, texto){
  const n = document.createElement(tag);
  if(clase) n.className = clase;
  if(texto != null) n.textContent = texto;
  return n;
}

/* Normaliza para buscar sin tildes ni mayúsculas */
function plano(s){
  return (s||'').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'');
}

function crear(cfg){
  css();

  const color = cfg.color || '#C0392B';
  let raiz, mapa = null, capas = null, eligiendoMapa = false;
  let registroActivo = null;

  /* ---------- armazón ---------- */
  raiz = el('div', 'emx');
  raiz.setAttribute('role','dialog');
  raiz.setAttribute('aria-label', 'Modo emergencia · ' + (cfg.modulo||''));
  raiz.innerHTML = `
    <div class="emx-top">
      <span class="emx-rotulo" style="color:${color}">Emergencia</span>
      <span class="emx-sitio">Sin localizar</span>
      <div class="emx-acciones">
        <button class="emx-bt destacado" data-ac="cambiar" type="button">
          <span class="emx-largo">Cambiar ubicación</span><span class="emx-corto">Cambiar</span></button>
        <button class="emx-bt" data-ac="cerrar" type="button">
          <span class="emx-largo">Cerrar incidencia</span><span class="emx-corto">Cerrar</span></button>
        <button class="emx-bt" data-ac="salir" type="button">
          <span class="emx-largo">Salir al módulo</span><span class="emx-corto">Salir</span></button>
      </div>
    </div>
    <div class="emx-entrada">
      <h2></h2>
      <p class="sub"></p>
      <div class="emx-caja">
        <div class="emx-aviso"></div>
        <input class="emx-campo" type="text" autocomplete="off" enterkeyhint="search">
        <div class="emx-coincid"></div>
        <div class="emx-o">o</div>
        <button class="emx-btn2" data-ac="gps" type="button">📍 Ya estoy en el lugar — usar mi ubicación</button>
        <button class="emx-btn2" data-ac="mapa" type="button">🗺️ Señalarlo en el mapa</button>
      </div>
    </div>
    <div class="emx-res">
      <div class="emx-panel"></div>
      <div class="emx-mapa"></div>
    </div>`;
  document.body.appendChild(raiz);

  const q = s => raiz.querySelector(s);
  const campo    = q('.emx-campo');
  const aviso    = q('.emx-aviso');
  const coincid  = q('.emx-coincid');
  const panel    = q('.emx-panel');
  const sitio    = q('.emx-sitio');
  const entrada  = q('.emx-entrada');
  const res      = q('.emx-res');

  q('.emx-entrada h2').textContent  = cfg.pregunta || '¿Dónde es la intervención?';
  q('.emx-entrada .sub').textContent = cfg.explica || '';
  campo.placeholder = cfg.marcador || 'Nombre o dirección';
  campo.style.borderColor = color;
  const idMapa = 'emx-mapa-' + (cfg.modulo||'x');
  q('.emx-mapa').id = idMapa;

  function ponAviso(t){
    aviso.textContent = t || '';
    aviso.classList.toggle('visible', !!t);
  }

  /* ---------- búsqueda entre fichas dadas de alta ---------- */
  function buscarFichas(texto){
    const t = plano(texto).trim();
    if(t.length < 2) return [];
    const lista = (cfg.registros && cfg.registros()) || [];
    return lista
      .map(r => {
        const et = cfg.etiqueta(r);
        const heno = plano(et.titulo + ' ' + (et.sub||''));
        const i = heno.indexOf(t);
        return i < 0 ? null : {r, et, peso: i};
      })
      .filter(Boolean)
      .sort((a,b)=> a.peso - b.peso)
      .slice(0, 6);
  }

  function pintarCoincidencias(texto){
    coincid.innerHTML = '';
    const t = (texto||'').trim();
    if(t.length < 2) return;

    buscarFichas(t).forEach(({r, et})=>{
      const b = el('button','', null); b.type = 'button';
      b.append(el('span','', et.titulo));
      if(et.sub) b.append(el('span','c-sub', et.sub));
      b.onclick = ()=> elegirFicha(r);
      coincid.appendChild(b);
    });

    const n = coincid.children.length;
    const pie = el('div','emx-nada');
    pie.textContent = n
      ? 'Si no es ninguno de estos, pulsa Intro y lo busco como dirección.'
      : `Ninguna ficha coincide con «${t}». Pulsa Intro y lo busco como dirección.`;
    coincid.appendChild(pie);
  }

  /* ---------- elegir destino ---------- */
  function elegirFicha(r){
    const c = cfg.punto(r);
    registroActivo = r;
    const et = cfg.etiqueta(r);
    if(c && Incidencia.coordOK(c.lat, c.lon)){
      Incidencia.set({lat:c.lat, lon:c.lon, etiqueta:et.titulo,
                      origen:'ficha', tipo:cfg.modulo});
    } else {
      /* Ficha sin coordenadas: se puede enseñar, pero no hay ruta */
      Incidencia.limpiar();
    }
    calcular();
  }

  async function buscarDireccion(){
    const txt = campo.value.trim();
    ponAviso('');
    try{
      const r = await Incidencia.geocodificar(txt);
      if(r.length === 1){
        registroActivo = null;
        Incidencia.set({lat:r[0].lat, lon:r[0].lon, etiqueta:r[0].etiqueta,
                        origen:'direccion', tipo:cfg.modulo});
        calcular();
      } else {
        coincid.innerHTML = '';
        r.forEach(o=>{
          const b = el('button','',null); b.type='button';
          b.append(el('span','', o.etiqueta), el('span','c-sub', o.completa));
          b.onclick = ()=>{
            registroActivo = null;
            Incidencia.set({lat:o.lat, lon:o.lon, etiqueta:o.etiqueta,
                            origen:'direccion', tipo:cfg.modulo});
            calcular();
          };
          coincid.appendChild(b);
        });
      }
    }catch(e){
      ponAviso(e.message + '. Prueba con tu ubicación o señálalo en el mapa.');
    }
  }

  /* ---------- pantallas ---------- */
  function pantallaEntrada(){
    entrada.style.display = 'flex';
    res.classList.remove('visible');
    sitio.textContent = 'Sin localizar';
    raiz.querySelectorAll('[data-ac="cambiar"],[data-ac="cerrar"]')
        .forEach(b=> b.style.display = 'none');
  }
  function pantallaResultado(){
    entrada.style.display = 'none';
    res.classList.add('visible');
    raiz.querySelectorAll('[data-ac="cambiar"],[data-ac="cerrar"]')
        .forEach(b=> b.style.display = '');
  }

  function prepararMapa(){
    if(mapa){ setTimeout(()=>mapa.invalidateSize(), 60); return; }
    mapa = L.map(idMapa, {zoomControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {maxZoom:19, attribution:'© OpenStreetMap'}).addTo(mapa);
    capas = L.layerGroup().addTo(mapa);
    mapa.on('click', e=>{
      if(!eligiendoMapa) return;
      const {lat, lng} = e.latlng;
      if(!Incidencia.coordOK(lat, lng)) return;
      eligiendoMapa = false;
      mapa.getContainer().style.cursor = '';
      registroActivo = null;
      Incidencia.set({lat, lon:lng, origen:'mapa', tipo:cfg.modulo,
        etiqueta:`Punto marcado (${lat.toFixed(5)}, ${lng.toFixed(5)})`});
      calcular();
    });
    setTimeout(()=>mapa.invalidateSize(), 60);
  }

  function senalarMapa(){
    eligiendoMapa = true;
    pantallaResultado();
    sitio.textContent = 'Toca el punto en el mapa';
    panel.innerHTML = '<div class="emx-cargando">Toca en el mapa el lugar exacto.<br>' +
                      'Si te equivocas, vuelve a tocar.</div>';
    prepararMapa();
    mapa.setView([Incidencia.PARQUE.lat, Incidencia.PARQUE.lon], 15);
    mapa.getContainer().style.cursor = 'crosshair';
  }

  /* ---------- resultado ---------- */
  async function calcular(){
    const inc = Incidencia.get();
    const r = registroActivo;
    if(!inc && !r){ pantallaEntrada(); return; }

    pantallaResultado();
    const et = r ? cfg.etiqueta(r) : null;
    sitio.textContent = et ? et.titulo : (inc ? inc.etiqueta : '—');
    panel.innerHTML = '<div class="emx-cargando">⟳ Preparando…</div>';
    prepararMapa();
    capas.clearLayers();

    let aprox = null;
    if(inc){
      mapa.setView([inc.lat, inc.lon], 17);
      capas.addLayer(L.marker([inc.lat, inc.lon], {
        icon: L.divIcon({className:'', iconSize:[34,34], iconAnchor:[17,17],
          html:`<div style="width:34px;height:34px;border-radius:50%;background:${color};`+
               `border:4px solid #fff;box-shadow:0 0 0 4px ${color}66,0 3px 10px rgba(0,0,0,.5);`+
               `display:flex;align-items:center;justify-content:center;font-size:16px">🔥</div>`}),
        zIndexOffset:3000}));
      aprox = await Incidencia.ruta(Incidencia.PARQUE.lat, Incidencia.PARQUE.lon, inc.lat, inc.lon);
      if(aprox){
        capas.addLayer(L.polyline(aprox.coords,{color:'#fff',weight:7,opacity:.55}));
        capas.addLayer(L.polyline(aprox.coords,{color:'#E67E22',weight:4,opacity:.95}));
        capas.addLayer(L.marker([Incidencia.PARQUE.lat, Incidencia.PARQUE.lon], {
          icon: L.divIcon({className:'', iconSize:[26,26], iconAnchor:[13,13],
            html:'<div style="width:26px;height:26px;border-radius:50%;background:#1A5276;'+
                 'border:2px solid #fff;display:flex;align-items:center;justify-content:center;'+
                 'font-size:12px">🚒</div>'})}).bindPopup(Incidencia.PARQUE.nombre));
        mapa.fitBounds(L.latLngBounds(aprox.coords), {padding:[55,55], maxZoom:17});
      }
    }

    /* El módulo añade sus capas y su panel */
    const ctx = {inc, aprox, mapa, capas, color, el, chip, bloque, tira, lupa, Incidencia};
    if(r && cfg.capas) try{ cfg.capas(r, ctx); }catch(e){ console.error(e); }

    panel.innerHTML = '';
    if(aprox){
      const a = el('div','emx-aprox');
      a.innerHTML = `Aproximación desde el parque: <b>${Incidencia.fmtDur(aprox.dur)}</b> · ` +
                    `${Incidencia.fmtDist(aprox.dist)}`;
      panel.appendChild(a);
    }

    if(r){
      try{
        const trozos = cfg.panel(r, ctx) || [];
        (Array.isArray(trozos) ? trozos : [trozos]).forEach(n=> n && panel.appendChild(n));
      }catch(e){
        console.error(e);
        panel.appendChild(bloque('alerta','Error','No se ha podido montar la ficha.'));
      }
    } else {
      const b = bloque('ojo', 'Sin ficha',
        'Esta ubicación no está dada de alta en ' + (cfg.nombreModulo||cfg.modulo) + '. ' +
        'No hay datos de accesos ni de riesgos preparados.');
      panel.appendChild(b);
      const h = el('a','emx-ir principal','🔴 Ver hidrantes cercanos');
      h.href = '../hidrantes/index.html?emergencia=1';
      panel.appendChild(h);
    }

    if(inc){
      const ir = el('a','emx-ir','🧭 Llevarme aquí');
      ir.href = Incidencia.enlaceNavegador(inc.lat, inc.lon);
      ir.target = '_blank'; ir.rel = 'noopener';
      panel.appendChild(ir);
      if(r){
        const h = el('a','emx-ir','🔴 Hidrantes cercanos a este punto');
        h.href = '../hidrantes/index.html?emergencia=1';
        panel.appendChild(h);
      }
    }
  }

  /* Tira de fotos deslizable. fotos: [{url, pie}] */
  function tira(fotos){
    if(!fotos || !fotos.length) return null;
    const t = el('div','emx-tira');
    fotos.forEach(f=>{
      if(!f || !f.url) return;
      const fig = el('figure','emx-foto');
      const img = document.createElement('img');
      img.src = f.url; img.loading = 'lazy'; img.alt = f.pie || '';
      /* Una foto rota no debe dejar un hueco gris en mitad de la intervención */
      img.onerror = ()=> fig.classList.add('falla');
      fig.appendChild(img);
      if(f.pie) fig.appendChild(el('figcaption','', f.pie));
      fig.tabIndex = 0;
      fig.onclick = ()=> lupa(f.url, f.pie);
      fig.onkeydown = e=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); lupa(f.url, f.pie); } };
      t.appendChild(fig);
    });
    return t.children.length ? t : null;
  }

  /* helpers que el módulo recibe para construir su panel */
  function chip(texto, clase){
    return el('span','emx-chip' + (clase ? ' '+clase : ''), texto);
  }
  function bloque(estilo, rotulo, contenido){
    const b = el('div','emx-bloque' + (estilo ? ' '+estilo : ''));
    if(rotulo) b.appendChild(el('div','emx-rot', rotulo));
    if(typeof contenido === 'string') b.appendChild(el('div','emx-txt', contenido));
    else if(Array.isArray(contenido)) contenido.forEach(n=> n && b.appendChild(n));
    else if(contenido) b.appendChild(contenido);
    return b;
  }

  /* ---------- acciones ---------- */
  function abrir(){
    raiz.classList.add('abierto');
    document.body.style.overflow = 'hidden';
    if(registroActivo || Incidencia.get()) calcular();
    else { pantallaEntrada(); setTimeout(()=>campo.focus(), 120); }
  }
  function cerrar(){
    raiz.classList.remove('abierto');
    document.body.style.overflow = '';
    eligiendoMapa = false;
  }
  function cambiar(){
    registroActivo = null;
    Incidencia.limpiar();
    eligiendoMapa = false;
    if(mapa) mapa.getContainer().style.cursor = '';
    ponAviso(''); coincid.innerHTML = ''; campo.value = '';
    pantallaEntrada();
    setTimeout(()=>campo.focus(), 120);
  }

  campo.addEventListener('input', ()=> pintarCoincidencias(campo.value));
  campo.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); buscarDireccion(); }
  });
  raiz.querySelector('[data-ac="cambiar"]').onclick = cambiar;
  raiz.querySelector('[data-ac="salir"]').onclick = cerrar;
  raiz.querySelector('[data-ac="cerrar"]').onclick = ()=>{
    if(!confirm('¿Cerrar la incidencia? Los demás módulos dejarán de tenerla.')) return;
    registroActivo = null; Incidencia.limpiar(); cerrar();
  };
  raiz.querySelector('[data-ac="mapa"]').onclick = senalarMapa;
  raiz.querySelector('[data-ac="gps"]').onclick = async function(){
    const b = this;
    ponAviso(''); coincid.innerHTML = '';
    b.disabled = true; b.textContent = 'Localizando…';
    try{
      const p = await Incidencia.posicionGPS();
      registroActivo = null;
      Incidencia.set({lat:p.lat, lon:p.lon, etiqueta:'Mi ubicación actual',
                      origen:'gps', tipo:cfg.modulo});
      calcular();
    }catch(e){
      ponAviso(e.message + '. Escribe la dirección o señálalo en el mapa.');
    }finally{
      b.disabled = false;
      b.textContent = '📍 Ya estoy en el lugar — usar mi ubicación';
    }
  };

  return {abrir, cerrar, cambiar, recalcular: calcular,
          get registro(){ return registroActivo; }};
}

global.Emergencia = {crear, plano, lupa};

})(window);
