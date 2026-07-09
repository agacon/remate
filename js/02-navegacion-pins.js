/* ═══════════════════════════════════════════════
   AGACON — 02-navegacion-pins.js
   Sistema de PIN por rol y navegación entre pantallas
   ═══════════════════════════════════════════════ */
// ── PIN system ──
var _pins = {operador:'', compradores:'', admin:''};
var _pinTarget = null;

function pinLoadFromFirebase() {
  configGet('pins').then(function(data) {
    if (!data) return;
    _pins = {
      operador:    data.operador    || '',
      compradores: data.compradores || '',
      admin:       data.admin       || ''
    };
    var op = document.getElementById('pin-op');
    var cp = document.getElementById('pin-comp');
    var ad = document.getElementById('pin-adm');
    if (op && _pins.operador)    op.placeholder    = '••••• (configurada)';
    if (cp && _pins.compradores) cp.placeholder    = '••••• (configurada)';
    if (ad && _pins.admin)       ad.placeholder    = '••••• (configurada)';
  });
}

function pinSaveAll() {
  var op   = document.getElementById('pin-op').value.trim();
  var comp = document.getElementById('pin-comp').value.trim();
  var adm  = document.getElementById('pin-adm').value.trim();
  var update = Object.assign({}, _pins);
  if (op)   { update.operador    = op;   _pins.operador    = op; }
  if (comp) { update.compradores = comp; _pins.compradores = comp; }
  if (adm)  { update.admin       = adm;  _pins.admin       = adm; }
  configSet('pins', update).then(function(ok) {
    if (!ok) { toast('Error guardando contraseñas', true); return; }
    document.getElementById('pin-op').value   = '';
    document.getElementById('pin-comp').value = '';
    document.getElementById('pin-adm').value  = '';
    toast('Contraseñas guardadas ✓');
  });
}

function pinRequired(screen) {
  var map = {operador:'operador', compradores:'compradores', admin:'admin'};
  var key = map[screen];
  var pin = (_pins[key] || '').trim();
  return pin.length > 0 ? pin : null;
}

function pinPrompt(screen, onSuccess) {
  var names = {operador:'🎙 Operador', compradores:'👤 Compradores', admin:'📊 Administración'};
  _pinTarget = {screen: screen, onSuccess: onSuccess};
  document.getElementById('pin-title').textContent = 'ACCESO RESTRINGIDO';
  document.getElementById('pin-module').textContent = names[screen] || screen;
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').textContent = '';
  document.getElementById('m-pin').classList.add('open');
  setTimeout(function(){ document.getElementById('pin-input').focus(); }, 100);
}

function pinVerify() {
  var entered = document.getElementById('pin-input').value.trim();
  var required = _pinTarget ? pinRequired(_pinTarget.screen) : null;
  if (!required || entered === required) {
    document.getElementById('m-pin').classList.remove('open');
    if (_pinTarget && _pinTarget.onSuccess) _pinTarget.onSuccess();
    _pinTarget = null;
  } else {
    document.getElementById('pin-error').textContent = '❌ Contraseña incorrecta';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
  }
}

function pinCancel() {
  document.getElementById('m-pin').classList.remove('open');
  _pinTarget = null;
}

function goToWithPin(screen) {
  var pinMap = {operador:'operador', compradores:'compradores', admin:'admin'};
  var key = pinMap[screen];
  var pin = key ? (_pins[key] || '').trim() : '';
  if (pin.length > 0) {
    pinPrompt(screen, function(){ goTo(screen); });
  } else {
    goTo(screen);
  }
}

var publicPollInterval = null;
// Lista de remates realizados (portal operador)
function opLoadRemates() {
  var tbody = document.getElementById('op-remates-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="padding:.8rem;color:#9AA4B5;text-align:center">Cargando…</td></tr>';
  supa.from('remates').select('*').order('creado_en', {ascending:false}).then(function(res){
    var data = res.data || [];
    if (res.error) { tbody.innerHTML = '<tr><td colspan="3" style="padding:.8rem;color:#C0392B;text-align:center">Error al cargar</td></tr>'; return; }
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="3" style="padding:.8rem;color:#9AA4B5;text-align:center">Aún no hay remates</td></tr>'; return; }
    tbody.innerHTML = data.map(function(r){
      var hora = r.creado_en ? new Date(r.creado_en).toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'}) : '';
      var nombre = r.nombre || ('Remate '+(r.fecha||''));
      return '<tr style="border-bottom:1px solid #EEF1F6">'+
        '<td style="padding:.4rem .5rem;font-weight:800;color:#1B8A4A">'+(r.numero!=null?r.numero:'—')+'</td>'+
        '<td style="padding:.4rem .5rem;color:#1a2333">'+nombre+'</td>'+
        '<td style="padding:.4rem .5rem;color:#5B667A;white-space:nowrap">'+(r.fecha||'')+(hora?' · '+hora:'')+'</td>'+
      '</tr>';
    }).join('');
  });
}

function goTo(screen) {
  document.getElementById('menu-screen').style.display = 'none';
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  if (publicPollInterval) { clearInterval(publicPollInterval); publicPollInterval = null; }

  if (screen === 'menu') {
    document.getElementById('menu-screen').style.display = 'flex';
  } else {
    var el = document.getElementById('screen-' + screen);
    if (el) el.classList.add('active');
    if (screen === 'compradores') compLoadRematesList();
    if (screen === 'operador') opLoadRemates();
    if (screen === 'admin') {
      admLoadRematesList();
      bankLoadFromFirebase();
      sociosLoadFromFirebase();
      pinLoadFromFirebase();
    }
    if (screen === 'public') {
      renderPublic();
      // Poll localStorage every 300ms for updates from operator tab
      publicPollInterval = setInterval(function() {
        try {
          var raw = localStorage.getItem('agacon_pub_state');
          if (!raw) return;
          var d = JSON.parse(raw);
          setFlip('pf-lote',  String(d.lote  || '—'));
          setFlip('pf-cant',  String(d.cant  || '—'));
          setFlip('pf-price', String(d.precio || '0'));
          setText('pf-cat',  d.categoria || '—');
          setText('pf-raza', d.raza || '—');
          setText('pf-edad', d.edad || '—');
          var pesoEl = document.getElementById('pf-peso');
          if (pesoEl) pesoEl.textContent = d.peso ? String(d.peso) : '—';
          var promEl = document.getElementById('pf-promedio');
          if (promEl) promEl.textContent = d.prom ? String(d.prom) : '—';
        } catch(e) {}
      }, 300);
    }
  }
  currentScreen = screen;
}

// ════════════════════════════════════════
//  OPERATOR STATE
// ════════════════════════════════════════
var lots = [], cur = 0, remateId = null;

var DEMO = [
  {orden:1,lote:3,propietario:'JEAN PAUL MORENO',CI_PROPIETARIO:'9821301 SC',estancia:'LA PRIMAVERA',cantidad:10,categoria:'VAQUILLAS',raza:'NELORE',edad:'12 MESES',obs:''},
  {orden:2,lote:7,propietario:'CARLOS ANTELO SUAREZ',CI_PROPIETARIO:'3845621 SC',estancia:'SAN RAFAEL',cantidad:5,categoria:'VAQUILLAS',raza:'BRAHMAN',edad:'14 MESES',obs:''},
  {orden:3,lote:11,propietario:'PATRICIA VACA DIEZ',CI_PROPIETARIO:'5123874 SC',estancia:'LA ESPERANZA',cantidad:8,categoria:'VACA',raza:'MESTIZA',edad:'36 MESES',obs:'CON CRIA'},
  {orden:4,lote:15,propietario:'RODRIGO SALVATIERRA',CI_PROPIETARIO:'2987463 SC',estancia:'EL PORVENIR',cantidad:22,categoria:'TORILLOS',raza:'NELORE',edad:'18 MESES',obs:''},
  {orden:5,lote:19,propietario:'MONICA PARADA RIOS',CI_PROPIETARIO:'4562198 SC',estancia:'SANTA ROSA',cantidad:14,categoria:'TORILLOS',raza:'ANELORADO',edad:'20 MESES',obs:''},
  {orden:6,lote:24,propietario:'FERNANDO CRONEMBOLD',CI_PROPIETARIO:'1874536 SC',estancia:'LOS TAJIBOS',cantidad:3,categoria:'TORO',raza:'SENEPOL',edad:'36 MESES',obs:'REPRODUCTOR'},
  {orden:7,lote:28,propietario:'LUCIA AYMALLA TORREZ',CI_PROPIETARIO:'6321485 SC',estancia:'CAMPO VERDE',cantidad:18,categoria:'TORILLOS',raza:'NELORE',edad:'15 MESES',obs:''},
  {orden:8,lote:33,propietario:'GABRIEL PINTO VACA',CI_PROPIETARIO:'7845632 SC',estancia:'EL RETIRO',cantidad:6,categoria:'VACAS',raza:'NELORE',edad:'36 MESES',obs:'CON CRIA'},
  {orden:9,lote:40,propietario:'JOSE LEDEZMA PAZ',CI_PROPIETARIO:'3214567 SC',estancia:'DONA LEONOR',cantidad:25,categoria:'TORILLOS',raza:'BRAHMAN',edad:'22 MESES',obs:''},
  {orden:10,lote:47,propietario:'BEATRIZ ANTELO MELGAR',CI_PROPIETARIO:'8963214 SC',estancia:'LAS LOMAS',cantidad:9,categoria:'VAQUILLAS',raza:'NELORE',edad:'11 MESES',obs:''},
];
