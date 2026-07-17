/* ═══════════════════════════════════════════════
   AGACON — 01-conexion-datos.js
   Conexión a Supabase, guardado y lectura de lotes
   ═══════════════════════════════════════════════ */

window.onerror=function(m,s,l,c,e){console.error("[AGACON ERROR] "+m+" (line "+l+")"+(e?" "+e.stack:""));return false;};
// ════════════════════════════════════════
//  SUPABASE CONFIG — reemplazar estos valores
// ════════════════════════════════════════
const SUPA_URL = 'https://uybelqzyrhdhvbncypwf.supabase.co';
const SUPA_KEY = 'sb_publishable_3PzMEHMnRa3Ag68xeUwysQ_CS4ymo8N';

// ════════════════════════════════════════
//  SUPABASE INIT
// ════════════════════════════════════════
var supa = supabase.createClient(SUPA_URL, SUPA_KEY);

// Connection check
async function checkConnection() {
  try {
    var res = await supa.from('config').select('clave').limit(1);
    var ok = !res.error;
    var dot = document.getElementById('menu-conn-dot');
    var txt = document.getElementById('menu-conn-txt');
    if (dot) dot.className = 'conn-dot ' + (ok ? 'conn-ok' : 'conn-err');
    if (txt) txt.textContent = ok ? 'Conectado a Supabase' : 'Sin conexión';
    var pill = document.getElementById('menu-conn-pill');
    if (pill) pill.className = 'menu-conn-pill ' + (ok ? 'ok' : '');
    // Login screen connection pill
    var ldot = document.getElementById('login-conn-dot');
    if (ldot) ldot.className = 'conn-dot ' + (ok ? 'conn-ok' : 'conn-err');
    var ltxt = document.getElementById('login-conn-txt');
    if (ltxt) ltxt.textContent = ok ? 'Conectado a Supabase' : 'Sin conexión';
    var lpill = document.getElementById('login-conn-pill');
    if (lpill) lpill.className = 'menu-conn-pill ' + (ok ? 'ok' : '');
    ['comp-conn','adm-conn'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.textContent = ok ? '⬤ Conectado' : '⬤ Sin conexión'; el.className = 'conn-badge ' + (ok ? 'badge-ok' : 'badge-err'); }
    });
  } catch(e) {
    console.error('[AGACON] Error de conexión:', e);
  }
}
checkConnection();

// Al cargar, mover las secciones de configuración al modal (descongestiona el admin)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ try{ ensureConfigInModal(); }catch(e){} });
} else {
  try{ ensureConfigInModal(); }catch(e){}
}

// ════════════════════════════════════════
//  SUPABASE HELPERS — reemplazan db.ref(...)
// ════════════════════════════════════════

// Leer config por clave
async function configGet(clave) {
  var res = await supa.from('config').select('valor').eq('clave', clave).single();
  if (res.error) return null;
  return res.data.valor;
}

// Guardar config por clave
async function configSet(clave, valor) {
  var res = await supa.from('config').upsert({clave: clave, valor: valor});
  return !res.error;
}

// Guardar/actualizar un lote
async function supaUpsertLote(remateId, lot) {
  var key = 'lot_'+lot.lote+'_'+String(lot.orden).replace('.','_');
  var res = await supa.from('lotes').upsert({
    remate_id:    remateId,
    lote_key:     key,
    orden:        lot.orden,
    lote:         lot.lote,
    propietario:  lot.propietario||'',
    ci_propietario: lot.ciPropietario||'',
    estancia:     lot.estancia||'',
    cantidad:     lot.cantidad||0,
    categoria:    lot.categoria||'',
    raza:         lot.raza||'',
    edad:         lot.edad||'',
    obs:          lot.obs||'',
    precio:       lot.precio||0,
    peso:         lot.peso||0,
    saved:        lot.saved||false,
    monto_total:  lot.montoTotal||0,
    comision:     lot.comision||0,
    total_con_com:lot.totalConCom||0,
    comprador:    lot.comprador||'',
    comprador_ci: lot.compradorCI||'',
    comprador_tel:lot.compradorTel||'',
    es_defensa:   lot.esDefensa||false,
    defensa_com:  lot.defensaCom||null,
    synced_at:    Date.now()
  }, {onConflict: 'remate_id,lote_key'});
  return !res.error;
}

// Leer lotes de un remate
async function supaGetLotes(remateId) {
  var res = await supa.from('lotes').select('*').eq('remate_id', remateId).order('orden');
  if (res.error) return [];
  return res.data.map(function(r) {
    return {
      _key: r.lote_key, orden: r.orden, lote: r.lote,
      propietario: r.propietario, ciPropietario: r.ci_propietario||'', estancia: r.estancia,
      cantidad: r.cantidad, categoria: r.categoria, raza: r.raza,
      edad: r.edad, obs: r.obs, precio: r.precio, peso: r.peso,
      saved: r.saved, montoTotal: r.monto_total, comision: r.comision,
      totalConCom: r.total_con_com, comprador: r.comprador,
      compradorCI: r.comprador_ci, compradorTel: r.comprador_tel,
      esDefensa: r.es_defensa, defensaCom: r.defensa_com,
      otraPlataforma: !!r.otra_plataforma
    };
  });
}

// Polling para sincronizar compradores asignados remotamente
var _lotesPoller = null;
function startLotesPolling(remateId, onUpdate) {
  if (_lotesPoller) clearInterval(_lotesPoller);
  _lotesPoller = setInterval(async function() {
    var lotes = await supaGetLotes(remateId);
    onUpdate(lotes);
  }, 3000);
}
function stopLotesPolling() {
  if (_lotesPoller) { clearInterval(_lotesPoller); _lotesPoller = null; }
}

// ════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════
var currentScreen = 'menu';
var publicPollInterval = null;
