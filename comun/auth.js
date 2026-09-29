/* ============================================================
   PORTAL OPERATIVO · auth.js (común a todos los módulos)
   - Pantalla de acceso obligatoria (llave del portal)
   - Sesión persistente con renovación automática del token
   - Roles: admin / bombero / demo (tabla public.perfiles)
   Uso: <script src="../comun/auth.js"></script> antes del script del módulo.
   Expone window.PortalAuth = { token(), user(), rol(), puedeEditar(), logout() }
   ============================================================ */
(function(){
  const SB  = 'https://zgwnkahaeuckdtjehpfj.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpnd25rYWhhZXVja2R0amVocGZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjk2NTgsImV4cCI6MjA5Mzg0NTY1OH0.CqbtLMuzijzOFiPdivAdlbf-rmaXkyXgyY4CGVOkCzM';
  const LS  = 'portal_sesion';
  const MARGEN_RENOVACION = 5*60; // segundos antes de caducar en que se renueva

  let sesion = null; // {access_token, refresh_token, expires_at, email, uid, rol, nombre}
  const fetchOriginal = window.fetch.bind(window);
  let renovando = null;

  // ---------- utilidades ----------
  function decodeJWT(t){ try{ const p=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(decodeURIComponent(atob(p).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''))); }catch(e){ return null; } }
  function leer(){ try{ return JSON.parse(localStorage.getItem(LS)||'null'); }catch(e){ return null; } }
  function guardar(s){ sesion=s; try{ if(s) localStorage.setItem(LS,JSON.stringify(s)); else localStorage.removeItem(LS); }catch(e){} sincronizarCompat(); }
  function ahora(){ return Math.floor(Date.now()/1000); }

  // Los módulos leen sessionStorage.sb_token / sb_user para mostrar los botones de edición.
  // Solo se rellenan si el rol puede editar; los "demo" ven el portal en modo lectura.
  function sincronizarCompat(){
    try{
      if(sesion && puedeEditar()){ sessionStorage.setItem('sb_token',sesion.access_token); sessionStorage.setItem('sb_user',sesion.email); }
      else { sessionStorage.removeItem('sb_token'); sessionStorage.removeItem('sb_user'); }
    }catch(e){}
  }
  function puedeEditar(){ return !!sesion && (sesion.rol==='admin'||sesion.rol==='bombero'); }

  // ---------- perfil / rol ----------
  async function cargarPerfil(s){
    try{
      const r=await fetchOriginal(`${SB}/rest/v1/perfiles?select=rol,nombre,activo&id=eq.${s.uid}`,{headers:{'apikey':KEY,'Authorization':'Bearer '+s.access_token}});
      const d=r.ok?await r.json():[];
      if(!d.length) return {rol:'demo',nombre:'',activo:true};
      return d[0];
    }catch(e){ return {rol:s.rol||'demo',nombre:s.nombre||'',activo:true}; }
  }

  // ---------- login / logout / renovación ----------
  async function login(email,password){
    const r=await fetch(`${SB}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({email,password})});
    const d=await r.json();
    if(!r.ok||!d.access_token) throw new Error(d.error_description||d.msg||'Email o contraseña incorrectos');
    const jwt=decodeJWT(d.access_token)||{};
    const s={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:jwt.exp||(ahora()+3600),email:email,uid:jwt.sub};
    const p=await cargarPerfil(s);
    if(p.activo===false) throw new Error('Tu acceso está desactivado. Contacta con el administrador.');
    s.rol=p.rol||'demo'; s.nombre=p.nombre||'';
    guardar(s);
    return s;
  }
  function logout(){ guardar(null); location.reload(); }

  async function renovar(){
    if(!sesion||!sesion.refresh_token) return false;
    if(renovando) return renovando;
    renovando=(async()=>{
      try{
        const r=await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({refresh_token:sesion.refresh_token})});
        const d=await r.json();
        if(!r.ok||!d.access_token){ if(r.status===400||r.status===401){ guardar(null); mostrarGate('La sesión ha caducado. Vuelve a entrar.'); } return false; }
        const jwt=decodeJWT(d.access_token)||{};
        guardar({...sesion,access_token:d.access_token,refresh_token:d.refresh_token||sesion.refresh_token,expires_at:jwt.exp||(ahora()+3600)});
        return true;
      }catch(e){ return false; }
      finally{ renovando=null; }
    })();
    return renovando;
  }
  async function asegurarVigente(){
    if(!sesion) return false;
    if(sesion.expires_at-ahora() < MARGEN_RENOVACION) return renovar();
    return true;
  }

  // ---------- interceptor: token siempre fresco y reintento si caduca ----------
  window.fetch=async function(url,opts){
    const u=typeof url==='string'?url:(url&&url.url)||'';
    const esSB=u.startsWith(SB)&&!u.includes('/auth/v1/');
    if(esSB){
      if(!sesion){ const cuerpo=JSON.stringify({message:'Sin sesión'}); return {ok:false,status:401,statusText:'Sin sesión',headers:new Headers(),json:async()=>({message:'Sin sesión'}),text:async()=>cuerpo}; }
      await asegurarVigente();
      opts=opts||{};
      const h=new Headers(opts.headers||{});
      // Sustituye cualquier Authorization (anon o token viejo) por el token vigente
      if(sesion) h.set('Authorization','Bearer '+sesion.access_token);
      if(!h.has('apikey')) h.set('apikey',KEY);
      opts={...opts,headers:h};
      let r=await fetchOriginal(url,opts);
      if(r.status===401 && sesion){
        const ok=await renovar();
        if(ok){ h.set('Authorization','Bearer '+sesion.access_token); r=await fetchOriginal(url,{...opts,headers:h}); }
      }
      return r;
    }
    return fetchOriginal(url,opts);
  };

  // Renovar en segundo plano y al volver a la pestaña
  setInterval(()=>{ asegurarVigente(); },60*1000);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') asegurarVigente(); });

  // ---------- pantalla de acceso ----------
  const CSS=`
  #pa-gate{position:fixed;inset:0;z-index:99999;background:#0D0F12;display:flex;align-items:center;justify-content:center;font-family:'Barlow','Segoe UI',sans-serif;color:#F0F2F5}
  #pa-gate::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 20% 20%,rgba(192,57,43,.10),transparent 60%),radial-gradient(ellipse 40% 60% at 80% 80%,rgba(26,82,118,.10),transparent 60%)}
  .pa-box{position:relative;background:#161A1F;border:1px solid #2A2F38;border-radius:14px;padding:32px 30px 26px;width:360px;max-width:92vw;box-shadow:0 24px 70px rgba(0,0,0,.7)}
  .pa-escudo{width:52px;height:52px;background:#7B241C;border:2px solid #C0392B;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 14px;box-shadow:0 0 22px rgba(192,57,43,.4)}
  .pa-t{font-family:'Barlow Condensed','Barlow',sans-serif;font-size:24px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-align:center;line-height:1.1}
  .pa-s{font-size:11px;color:#8892A0;letter-spacing:.12em;text-transform:uppercase;text-align:center;margin:4px 0 22px}
  .pa-in{width:100%;background:#1E232B;border:1px solid #353C47;border-radius:6px;color:#F0F2F5;padding:11px 12px;font-size:14px;margin-bottom:10px;font-family:inherit;outline:none;box-sizing:border-box}
  .pa-in:focus{border-color:#C0392B}
  .pa-btn{width:100%;background:#C0392B;border:none;color:#fff;padding:12px;border-radius:6px;font-family:'Barlow Condensed','Barlow',sans-serif;font-size:16px;font-weight:700;letter-spacing:.06em;cursor:pointer;margin-top:4px}
  .pa-btn:disabled{background:#555;cursor:wait}
  .pa-msg{font-size:12px;color:#EC7063;text-align:center;margin-top:10px;min-height:18px}
  .pa-foot{font-size:10px;color:#5A6475;text-align:center;margin-top:16px;letter-spacing:.06em;text-transform:uppercase}
  .pa-user{position:fixed;bottom:10px;left:12px;z-index:9500;background:rgba(22,26,31,.92);border:1px solid #2A2F38;border-radius:20px;padding:4px 6px 4px 12px;font-family:'Barlow','Segoe UI',sans-serif;font-size:11px;color:#8892A0;display:flex;align-items:center;gap:8px;backdrop-filter:blur(6px)}
  .pa-user b{color:#58D68D;font-weight:600}
  .pa-user .pa-rol{background:rgba(255,255,255,.07);padding:1px 7px;border-radius:10px;font-size:10px;letter-spacing:.06em;text-transform:uppercase}
  .pa-user button{background:none;border:1px solid #353C47;color:#8892A0;border-radius:12px;padding:2px 9px;font-size:10px;cursor:pointer;font-family:inherit}
  .pa-user button:hover{color:#EC7063;border-color:#EC7063}
  @media(max-width:600px){.pa-user{bottom:6px;left:6px;padding:3px 5px 3px 9px;font-size:10px}.pa-user .pa-email{display:none}}
  `;
  function inyectarCSS(){ if(document.getElementById('pa-css')) return; const s=document.createElement('style'); s.id='pa-css'; s.textContent=CSS; (document.head||document.documentElement).appendChild(s); }

  function mostrarGate(msg){
    inyectarCSS();
    let g=document.getElementById('pa-gate');
    if(!g){
      g=document.createElement('div'); g.id='pa-gate';
      g.innerHTML=`<div class="pa-box">
        <div class="pa-escudo">🚒</div>
        <div class="pa-t">Portal Operativo</div>
        <div class="pa-s">Acceso restringido · Bomberos Los Palacios</div>
        <form id="pa-form" autocomplete="on">
          <input class="pa-in" id="pa-email" type="email" placeholder="Email" autocomplete="username" required>
          <input class="pa-in" id="pa-pass" type="password" placeholder="Contraseña" autocomplete="current-password" required>
          <button class="pa-btn" id="pa-btn" type="submit">Entrar</button>
        </form>
        <div class="pa-msg" id="pa-msg"></div>
        <div class="pa-foot">Uso exclusivo del personal autorizado</div>
      </div>`;
      (document.body||document.documentElement).appendChild(g);
      g.querySelector('#pa-form').addEventListener('submit',async ev=>{
        ev.preventDefault();
        const b=g.querySelector('#pa-btn'), m=g.querySelector('#pa-msg');
        b.disabled=true; b.textContent='Comprobando…'; m.textContent='';
        try{ await login(g.querySelector('#pa-email').value.trim(),g.querySelector('#pa-pass').value); location.reload(); }
        catch(e){ m.textContent=e.message||'No se pudo entrar'; b.disabled=false; b.textContent='Entrar'; }
      });
      setTimeout(()=>g.querySelector('#pa-email').focus(),50);
    }
    if(msg) g.querySelector('#pa-msg').textContent=msg;
    g.style.display='flex';
  }

  function mostrarUsuario(){
    if(!sesion||document.getElementById('pa-user')) return;
    inyectarCSS();
    const d=document.createElement('div'); d.id='pa-user'; d.className='pa-user';
    d.innerHTML=`<span class="pa-email"><b>${sesion.nombre||sesion.email}</b></span><span class="pa-rol">${sesion.rol}</span><button type="button" title="Cerrar sesión">Salir</button>`;
    d.querySelector('button').onclick=()=>{ if(confirm('¿Cerrar sesión?')) logout(); };
    document.body.appendChild(d);
  }

  // ---------- arranque ----------
  sesion=leer();
  if(sesion&&sesion.access_token){
    sincronizarCompat();
    // Si ya caducó y no se puede renovar, se pedirá acceso al primer fetch (401) o aquí:
    if(sesion.expires_at-ahora()<0){ renovar().then(ok=>{ if(!ok) mostrarGate('La sesión ha caducado. Vuelve a entrar.'); }); }
    // Refrescar el rol por si el admin lo ha cambiado
    cargarPerfil(sesion).then(p=>{ if(p.activo===false){ guardar(null); mostrarGate('Tu acceso está desactivado.'); return; } if(p.rol&&p.rol!==sesion.rol){ guardar({...sesion,rol:p.rol,nombre:p.nombre||''}); } });
    document.addEventListener('DOMContentLoaded',mostrarUsuario);
  } else {
    sincronizarCompat();
    if(document.body) mostrarGate(); else document.addEventListener('DOMContentLoaded',()=>mostrarGate());
  }

  window.PortalAuth={
    token:()=>sesion?sesion.access_token:null,
    user:()=>sesion?sesion.email:null,
    rol:()=>sesion?sesion.rol:null,
    nombre:()=>sesion?(sesion.nombre||sesion.email):null,
    puedeEditar, logout, login,
    gate:mostrarGate
  };
})();
