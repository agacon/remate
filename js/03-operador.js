/* ═══════════════════════════════════════════════
   AGACON — 03-operador.js
   Portal Operador: carga de Excel, remate en vivo, pantalla pública, sincronización offline
   ═══════════════════════════════════════════════ */
function mkLot(d) {
  return {
    orden: +(d.orden||d.ORDEN||0), lote: +(d.lote||d.LOTE||0),
    propietario:    d.propietario||d.PROPIETARIO||'',
    ciPropietario:  String(d.ciPropietario||d.CI_PROPIETARIO||'').trim(),
    estancia:       d.estancia||d.ESTANCIA||'',
    cantidad: +(d.cantidad||d.CANTIDAD||0), categoria: d.categoria||d.CATEGORIA||'',
    raza: d.raza||d.RAZA||'', edad: d.edad||d.EDAD||'', obs: d.obs||d.OBS||'',
    precio:0, peso:0, comprador:'', compradorCI:'', compradorTel:'', saved:false,
  };
}

// File import
var dz = document.getElementById('dropzone');
document.getElementById('file-in').addEventListener('change', function(e){ if(e.target.files[0]) readFile(e.target.files[0]); });

// Update remate ID preview as user types
document.getElementById('remate-num').addEventListener('input', function() {
  updateRematePreview();
});

function updateRematePreview() {
  var num = document.getElementById('remate-num').value || '—';
  var now = new Date();
  var yyyy = now.getFullYear();
  var mm   = String(now.getMonth()+1).padStart(2,'0');
  var dd   = String(now.getDate()).padStart(2,'0');
  var id   = 'REMATE N°'+num+' — '+yyyy+'/'+mm+'/'+dd;
  document.getElementById('remate-id-preview').textContent = id;
  return {num: num, fecha: dd+'/'+mm+'/'+yyyy, id: id};
}
updateRematePreview();
dz.addEventListener('dragover', function(e){ e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', function(){ dz.classList.remove('over'); });
dz.addEventListener('drop', function(e){ e.preventDefault(); dz.classList.remove('over'); if(e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });

function readFile(f) {
  var name = f.name.toLowerCase();
  if (name.endsWith('.xls')||name.endsWith('.xlsx')) {
    var r = new FileReader();
    r.onload = function(ev){ parseXLS(ev.target.result, f.name); };
    r.readAsArrayBuffer(f);
  } else {
    var r = new FileReader();
    r.onload = function(ev){ parseText(ev.target.result, f.name); };
    r.readAsText(f);
  }
}

function parseXLS(buffer, name) {
  try {
    var wb   = XLSX.read(buffer, {type:'array'});
    var shName = wb.SheetNames.find(function(s){ return s.toLowerCase()==='base'; }) || wb.SheetNames[0];
    var raw  = XLSX.utils.sheet_to_json(wb.Sheets[shName], {header:1, defval:null});
    var hi   = -1;
    for (var i=0;i<raw.length;i++) { if(raw[i]&&String(raw[i][0]).toUpperCase().trim()==='LOTE'){hi=i;break;} }
    if (hi<0) { toast('No se encontro encabezado LOTE', true); return; }
    var H = raw[hi].map(function(h){ return h?String(h).toUpperCase().trim():''; });
    var c = {lote:H.indexOf('LOTE'),orden:H.indexOf('ORDEN'),propietario:H.findIndex(function(h){return h==='PROPIETARIO';}),ciProp:H.findIndex(function(h){var hn=h.replace(/[^A-ZÉ]/g,'').replace(/É/g,'E');return hn==='CI' || hn==='NROCI' || hn==='CINRO' || hn.indexOf('CEDULA')>=0 || (hn.indexOf('CI')>=0 && (hn.indexOf('PROP')>=0 || hn.indexOf('VEND')>=0));}),estancia:H.indexOf('ESTANCIA'),cantidad:H.indexOf('CANTIDAD'),categoria:H.indexOf('CATEGORIA'),raza:H.indexOf('RAZA'),edad:H.indexOf('EDAD'),obs:H.findIndex(function(h){return h==='OBS.'||h==='OBS';})};
    var data = [];
    for (var i=hi+1;i<raw.length;i++) {
      var r=raw[i]; if(!r) continue;
      var lv=r[c.lote]; if(typeof lv!=='number'||lv===0) continue;
      var ov=c.orden>=0?r[c.orden]:null; if(!ov&&ov!==0) continue;
      data.push({LOTE:lv,ORDEN:ov,PROPIETARIO:c.propietario>=0?r[c.propietario]||'':'',CI_PROPIETARIO:c.ciProp>=0?String(r[c.ciProp]||'').trim():'',ESTANCIA:c.estancia>=0?r[c.estancia]||'':'',CANTIDAD:c.cantidad>=0?r[c.cantidad]||0:0,CATEGORIA:c.categoria>=0?r[c.categoria]||'':'',RAZA:c.raza>=0?r[c.raza]||'':'',EDAD:c.edad>=0?r[c.edad]||'':'',OBS:c.obs>=0?r[c.obs]||'':''});
    }
    if(!data.length){toast('No se encontraron lotes validos',true);return;}
    lots = data.map(mkLot).sort(function(a,b){return a.orden-b.orden;});
    showPreview(lots.length + ' lotes cargados desde "' + shName + '"');
  } catch(e){ toast('Error: '+e.message, true); }
}

function parseText(text, name) {
  try {
    var data;
    if (name.toLowerCase().endsWith('.json')) {
      data = JSON.parse(text);
    } else {
      var lines = text.trim().split('\n');
      var H = lines[0].split(',').map(function(h){return h.trim().toUpperCase();});
      data = lines.slice(1).map(function(l){var v=l.split(','),o={};H.forEach(function(h,i){o[h]=(v[i]||'').trim();});return o;});
    }
    lots = data.map(mkLot).sort(function(a,b){return a.orden-b.orden;});
    showPreview(lots.length + ' lotes cargados');
  } catch(e){ toast('Error al leer archivo', true); }
}

function showPreview(msg) {
  var pi = document.getElementById('preview-info');
  pi.textContent = msg; pi.style.display = 'block';
  document.getElementById('btn-start').disabled = false;
  toast(msg);
}

function loadDemo() {
  lots = DEMO.map(mkLot);
  showPreview(lots.length + ' lotes de demostracion');
}

function downloadTemplate() {
  var wb = XLSX.utils.book_new();
  var headers = ['LOTE','ORDEN','PROPIETARIO','CI PROPIETARIO','COMPRADOR','ESTANCIA','CANTIDAD','CATEGORIA','RAZA','EDAD','OBS.'];
  var rows = [
    headers,
    [3,  1, 'JEAN PAUL MORENO',      '9821301 SC', '', 'LA PRIMAVERA',   10, 'VAQUILLAS', 'NELORE',   '12 MESES', ''],
    [7,  2, 'CARLOS ANTELO SUAREZ',  '3845621 SC', '', 'SAN RAFAEL',      5, 'VAQUILLAS', 'BRAHMAN',  '14 MESES', ''],
    [11, 3, 'PATRICIA VACA DIEZ',    '5123874 SC', '', 'LA ESPERANZA',    8, 'VACA',      'MESTIZA',  '36 MESES', 'CON CRIA'],
    [15, 4, 'RODRIGO SALVATIERRA',   '2987463 SC', '', 'EL PORVENIR',    22, 'TORILLOS',  'NELORE',   '18 MESES', ''],
    [19, 5, 'MONICA PARADA RIOS',    '4562198 SC', '', 'SANTA ROSA',     14, 'TORILLOS',  'ANELORADO','20 MESES',  ''],
    [24, 6, 'FERNANDO CRONEMBOLD',   '1874536 SC', '', 'LOS TAJIBOS',     3, 'TORO',      'SENEPOL',  '36 MESES', 'REPRODUCTOR'],
    [28, 7, 'LUCIA AYMALLA TORREZ',  '6321485 SC', '', 'CAMPO VERDE',    18, 'TORILLOS',  'NELORE',   '15 MESES', ''],
    [33, 8, 'GABRIEL PINTO VACA',    '7845632 SC', '', 'EL RETIRO',       6, 'VACAS',     'NELORE',   '36 MESES', 'CON CRIA'],
    [40, 9, 'JOSE LEDEZMA PAZ',      '3214567 SC', '', 'DONA LEONOR',    25, 'TORILLOS',  'BRAHMAN',  '22 MESES', ''],
    [47,10, 'BEATRIZ ANTELO MELGAR', '8963214 SC', '', 'LAS LOMAS',       9, 'VAQUILLAS', 'NELORE',   '11 MESES', ''],
  ];
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    {wch:6},{wch:6},{wch:28},{wch:16},{wch:28},{wch:18},
    {wch:9},{wch:12},{wch:12},{wch:10},{wch:12}
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'base');
  XLSX.writeFile(wb, 'AGACON_Plantilla_Lotes.xlsx');
  toast('Plantilla descargada ✓');
}

function startRemate() {
  if(!lots.length) return;
  cur = 0;
  document.getElementById('op-import').style.display = 'none';
  var panel = document.getElementById('op-panel');
  panel.style.display = 'grid';
  document.getElementById('op-live-badge').style.display = 'inline';
  initFirebaseRemate();
  renderOp();
  setInterval(function(){ document.getElementById('op-date').textContent = new Date().toLocaleString('es-BO',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}); }, 1000);
}

// Firebase for operator
async function initFirebaseRemate() {
  var info = updateRematePreview();
  var num  = document.getElementById('remate-num').value || '?';
  var now  = new Date();
  var yyyy = now.getFullYear();
  var mm   = String(now.getMonth()+1).padStart(2,'0');
  var dd   = String(now.getDate()).padStart(2,'0');
  var nombreRemate = 'REMATE N°'+num+' — '+yyyy+'/'+mm+'/'+dd;

  var res = await supa.from('remates').insert({
    fecha: dd+'/'+mm+'/'+yyyy,
    nombre: nombreRemate,
    numero: parseInt(num),
    tc: parseFloat(document.getElementById('remate-tc').value) || 9.80,
    creado_en: Date.now(),
    estado: 'activo'
  }).select('id').single();

  if (res.error) { toast('Error creando remate: '+res.error.message, true); return; }
  remateId = res.data.id;
  localStorage.setItem('agacon_remateId', remateId);
  localStorage.setItem('agacon_remateNombre', nombreRemate);
  toast('Iniciado: ' + nombreRemate);

  // Poll for buyer updates from compradores module
  startLotesPolling(remateId, function(remoteLotes) {
    var updated = false;
    remoteLotes.forEach(function(fbLot) {
      var local = lots.find(function(l){ return l.lote===fbLot.lote && l.orden===fbLot.orden; });
      if (local && fbLot.comprador && !local.comprador) {
        local.comprador=fbLot.comprador; local.compradorCI=fbLot.compradorCI||''; local.compradorTel=fbLot.compradorTel||'';
        updated = true;
      }
    });
    if (updated) { renderSidebar(); toast('Comprador asignado remotamente'); }
  });
}

// ════════════════════════════════════════
//  COLA OFFLINE — sync automatico al volver conexion
// ════════════════════════════════════════
var _offlineQueue = JSON.parse(localStorage.getItem('agacon_offline_queue') || '[]');
var _isOnline = navigator.onLine;
var _isSyncing = false;

function offlineSaveQueue() {
  localStorage.setItem('agacon_offline_queue', JSON.stringify(_offlineQueue));
}

function offlineUpdateBadge() {
  var badge = document.getElementById('offline-badge');
  var count = document.getElementById('offline-count');
  var sync  = document.getElementById('syncing-badge');
  if (!badge) return;
  if (_isSyncing) {
    badge.style.display = 'none';
    sync.style.display = 'inline';
  } else if (!_isOnline || _offlineQueue.length > 0) {
    badge.style.display = 'inline';
    sync.style.display = 'none';
    if (count) count.textContent = _offlineQueue.length;
  } else {
    badge.style.display = 'none';
    sync.style.display = 'none';
  }
}

async function offlineFlush() {
  if (_isSyncing || _offlineQueue.length === 0) return;
  _isSyncing = true;
  offlineUpdateBadge();
  var failed = [];
  for (var i = 0; i < _offlineQueue.length; i++) {
    var item = _offlineQueue[i];
    var ok = await supaUpsertLote(item.remateId, item.lot);
    if (!ok) failed.push(item);
  }
  _offlineQueue = failed;
  offlineSaveQueue();
  _isSyncing = false;
  if (failed.length === 0 && _offlineQueue.length === 0) {
    toast('Sincronizacion completa — todos los lotes subidos');
  } else if (failed.length > 0) {
    toast(failed.length + ' lotes aun pendientes — reintentando...', true);
  }
  offlineUpdateBadge();
}

window.addEventListener('online', function() {
  _isOnline = true;
  offlineUpdateBadge();
  if (_offlineQueue.length > 0) {
    toast('Conexion restaurada — subiendo ' + _offlineQueue.length + ' lotes pendientes...');
    setTimeout(offlineFlush, 1000);
  }
});

window.addEventListener('offline', function() {
  _isOnline = false;
  offlineUpdateBadge();
  toast('Sin conexion — los lotes se guardan localmente', true);
});

// Retry periodically even if no online event fires
setInterval(function() {
  if (navigator.onLine && _offlineQueue.length > 0 && !_isSyncing) {
    offlineFlush();
  }
}, 15000);

function syncLot(lot) {
  if (!remateId) return;
  if (!navigator.onLine) {
    // Save to offline queue
    var key = 'lot_'+lot.lote+'_'+String(lot.orden).replace('.','_');
    var existing = _offlineQueue.findIndex(function(i){ return i.lot.lote===lot.lote && i.remateId===remateId; });
    var item = {remateId: remateId, lot: JSON.parse(JSON.stringify(lot))};
    if (existing >= 0) _offlineQueue[existing] = item;
    else _offlineQueue.push(item);
    offlineSaveQueue();
    offlineUpdateBadge();
    return;
  }
  supaUpsertLote(remateId, lot).then(function(ok) {
    if (!ok) {
      // Failed even with connection — queue it
      var existing = _offlineQueue.findIndex(function(i){ return i.lot.lote===lot.lote && i.remateId===remateId; });
      var item = {remateId: remateId, lot: JSON.parse(JSON.stringify(lot))};
      if (existing >= 0) _offlineQueue[existing] = item;
      else _offlineQueue.push(item);
      offlineSaveQueue();
      offlineUpdateBadge();
    }
  });
}

// On load: check if there are pending items from a previous session
if (_offlineQueue.length > 0) {
  setTimeout(function() {
    toast(_offlineQueue.length + ' lotes pendientes del remate anterior — reintentando...');
    offlineFlush();
    offlineUpdateBadge();
  }, 3000);
}

// ── Render operator ──
function renderOp() {
  var l = lots[cur]; if(!l) return;
  setText('op-cat', l.categoria||'—');
  setText('op-order-tag', 'ORDEN #'+l.orden);
  setText('op-lote', l.lote);
  setText('op-cant', l.cantidad);
  setText('op-prop', (l.propietario||'—') + (l.ciPropietario?'  (CI: '+l.ciPropietario+')':''));
  setText('op-estancia', l.estancia||'—');
  setText('op-raza', l.raza||'—');
  setText('op-edad', l.edad||'—');
  setText('op-obs', l.obs||'—');
  setText('op-price', l.precio||'0');
  document.getElementById('f-peso').value = l.peso||'';
  updateTotal(l);
  setText('lot-counter', (cur+1)+' / '+lots.length);
  setText('op-prog', lots.filter(function(x){return x.saved;}).length+' guardados');
  document.getElementById('btn-prev').disabled = cur===0;
  document.getElementById('btn-next').disabled = cur===lots.length-1;
  renderSidebar();
  renderPublic();
}

function renderBuyer(l) {
  // Called from remote polling when buyer is assigned remotely
  contratoUpdate(l);
}

function renderSidebar() {
  var list = document.getElementById('lot-list');
  list.innerHTML = '';
  lots.forEach(function(l,i) {
    var div = document.createElement('div');
    div.className = 'lot-item' + (i===cur?' current':'') + (l.saved?' saved':'');
    div.onclick = (function(idx){ return function(){ goToLot(idx); }; })(i);
    div.innerHTML =
      '<div class="li-ord">'+l.orden+'</div>'+
      '<div class="li-lot">'+l.lote+'</div>'+
      '<div class="li-info">'+
        '<div class="li-cat">'+l.categoria+'</div>'+
        '<div class="li-own">'+l.propietario+'</div>'+
        (l.ciPropietario?'<div class="li-ci" style="font-size:.72rem;opacity:.6">CI: '+l.ciPropietario+'</div>':'')+
        (l.saved&&!l.comprador?'<div class="li-nobuy">sin comprador</div>':'')+
        (l.comprador?'<div class="li-buyer">'+l.comprador+'</div>':'')+
      '</div>'+
      '<div class="li-price">'+(l.precio?'$'+l.precio:'')+'</div>';
    list.appendChild(div);
  });
  var items = list.querySelectorAll('.lot-item');
  if (items[cur]) items[cur].scrollIntoView({block:'nearest',behavior:'smooth'});
  setText('sidebar-stat', lots.filter(function(x){return x.saved;}).length+'/'+lots.length);
}

function navigate(dir) { var n=cur+dir; if(n<0||n>=lots.length) return; cur=n; renderOp(); }
function goToLot(i) { cur=i; renderOp(); }

function adjPrice(amount) {
  var l=lots[cur];
  l.precio=Math.max(0,(l.precio||0)+amount);
  var el=document.getElementById('op-price');
  el.textContent=l.precio;
  el.classList.remove('flash-up','flash-down');
  void el.offsetWidth;
  el.classList.add(amount>0?'flash-up':'flash-down');
  setTimeout(function(){el.classList.remove('flash-up','flash-down');},300);
  updateTotal(l); renderPublic();
  if(l.saved) syncLot(l);
}

function resetPrice(){ lots[cur].precio=0; renderOp(); }
function updateTotal(l){
  var monto = (l.precio||0)*(l.cantidad||0);
  var com   = monto * 0.03;
  var total = monto + com;
  setText('op-total', '$us '+monto.toLocaleString());
  // Store on lot for Firebase sync
  l.montoTotal  = monto;
  l.comision    = parseFloat(com.toFixed(2));
  l.totalConCom = parseFloat(total.toFixed(2));
}
function onPesoChange(){ lots[cur].peso=parseFloat(document.getElementById('f-peso').value)||0; renderPublic(); }

function opConfirmExit() {
  // Only ask if remate has started and has saved lots
  var savedCount = lots.filter(function(l){ return l.saved; }).length;
  if (savedCount > 0) {
    if (!confirm('¿Seguro que deseas cerrar sesión?\n\nEl remate quedara guardado en Supabase y podras continuar luego.')) return;
  }
  logout();
}

// ════ CONTRATO PANEL — timer 30s ════
var _contratoTimer = null;

function contratoFill(l) {
  var setT = function(id,v){ var e=document.getElementById(id); if(e) e.textContent=v||'—'; };
  setT('op-propietario',      l.propietario);
  setT('op-lote-num',         l.lote);
  setT('op-precio-display',   '$us '+(l.precio||0));
  setT('op-cantidad-display', l.cantidad);
  setT('op-cat-display',      l.categoria);
  setT('op-raza-display',     l.raza);
  var monto = (l.precio||0)*(l.cantidad||0);
  var com   = monto * 0.03;
  var total = monto + com;
  setT('op-box-total',     '$us '+monto.toLocaleString());
  setT('op-box-com',       '$us '+com.toFixed(2));
  setT('op-box-total-com', '$us '+total.toFixed(2));
  var dot  = document.getElementById('buyer-dot');
  var disp = document.getElementById('buyer-display');
  if (l.comprador) {
    if(dot) dot.className='dot-d';
    if(disp) { disp.innerHTML='<b>'+l.comprador+'</b>'+(l.compradorCI?' <span style="color:var(--muted);font-size:.8rem">CI: '+l.compradorCI+'</span>':''); disp.style.color='#fff'; }
  } else {
    if(dot) dot.className='dot-p';
    if(disp) { disp.textContent='Sin comprador — el remate puede continuar'; disp.style.color='var(--muted)'; }
  }
}

function contratoUpdate(l) {
  // Called from remote polling — fill directly no timer
  contratoFill(l);
}

function contratoStartTimer(savedLot) {
  contratoFill(savedLot);
  var timerEl = document.getElementById('contrato-timer');
  var bar     = document.getElementById('contrato-bar');
  var secs    = document.getElementById('contrato-seconds');
  var box     = document.querySelector('.buyer-box');
  if (!timerEl) return;
  if (_contratoTimer) { clearInterval(_contratoTimer); _contratoTimer = null; }
  timerEl.style.display = 'flex';
  bar.style.transition = 'none';
  bar.style.width = '100%';
  bar.style.background = 'var(--green)';
  secs.style.color = 'var(--green)';
  if (box) box.style.borderColor = 'var(--green)';
  var remaining = 30;
  secs.textContent = remaining;
  setTimeout(function() {
    bar.style.transition = 'width 30s linear';
    bar.style.width = '0%';
  }, 80);
  _contratoTimer = setInterval(function() {
    remaining--;
    secs.textContent = remaining;
    if (remaining <= 5) {
      secs.style.color = 'var(--red)';
      bar.style.background = 'var(--red)';
      if (box) box.style.borderColor = 'var(--red)';
    }
    if (remaining <= 0) {
      clearInterval(_contratoTimer); _contratoTimer = null;
      timerEl.style.display = 'none';
      bar.style.transition = 'none'; bar.style.width = '100%';
      bar.style.background = 'var(--green)'; secs.style.color = 'var(--green)';
      if (box) box.style.borderColor = '';
      if (lots[cur]) contratoFill(lots[cur]);
    }
  }, 1000);
}

function saveLot() {
  var l = lots[cur]; l.saved = true;
  syncLot(l);
  renderSidebar();
  var savedLot = JSON.parse(JSON.stringify(l));
  // Advance operator immediately
  if (cur < lots.length - 1) setTimeout(function(){ navigate(1); }, 400);
  // Contrato panel stays on saved lot for 30s
  contratoStartTimer(savedLot);
  toast('Lote '+l.lote+' guardado ✓');
}

// ── Public display ──
var LS_KEY = 'agacon_pub_state';
function renderPublic() {
  if(!lots.length) return;
  var l=lots[cur]||{};
  var cant = l.cantidad || 1;
  var peso = l.peso || 0;
  var prom = (peso > 0 && cant > 0) ? Math.round(peso / cant) : 0;

  // Mini preview
  setFlip('mini-lote',  String(l.lote||'—'));
  setFlip('mini-cant',  String(l.cantidad||'—'));
  setFlip('mini-peso',  l.peso?String(l.peso):'—');
  setFlip('mini-prom',  prom?String(prom):'—');
  setFlip('mini-price', String(l.precio||'0'));
  setText('mini-cat',   l.categoria||'—');
  setText('mini-raza',  l.raza||'—');
  setText('mini-edad',  l.edad||'—');
  // Full public screen
  setFlip('pf-lote',    String(l.lote||'—'));
  setFlip('pf-cant',    String(l.cantidad||'—'));
  setFlip('pf-price',   String(l.precio||'0'));
  setText('pf-cat',     l.categoria||'—');
  setText('pf-raza',    l.raza||'—');
  setText('pf-edad',    l.edad||'—');
  var pesoEl = document.getElementById('pf-peso');
  if(pesoEl) pesoEl.textContent = peso ? String(peso) : '—';
  var promEl = document.getElementById('pf-promedio');
  if(promEl) promEl.textContent = prom ? String(prom) : '—';
  // localStorage for external tab
  try{ localStorage.setItem(LS_KEY, JSON.stringify({lote:l.lote||'—',cant:l.cantidad||'—',peso:peso||'—',prom:prom||'—',precio:l.precio||'0',categoria:l.categoria||'—',raza:l.raza||'—',edad:l.edad||'—',estancia:l.estancia||'—',ts:Date.now()})); }catch(e){}
}

function showPublic() {
  renderPublic();
  // Open public screen in a NEW window so it can be moved to the TV
  var pubUrl = window.location.href.split('?')[0] + '?pantalla=publica';
  var w = window.open(pubUrl, 'agacon_public', 'width=1280,height=720');
  if (!w) {
    // Popup blocked - fallback to same window
    toast('Permite ventanas emergentes en el navegador, o usa F11 aqui');
    goTo('public');
  } else {
    toast('Arrastrá la nueva ventana al TV y presioná F11');
  }
}

// ── Buyer modal ──
function openBuyerModal() {
  var sel = document.getElementById('m-lot-sel');
  sel.innerHTML = '<option value="">— Seleccionar lote —</option>';
  lots.forEach(function(l,i){
    if(!l.comprador){
      var opt=document.createElement('option');
      opt.value=i;
      opt.textContent='#'+l.orden+' | Lote '+l.lote+' — '+l.categoria+' ('+l.cantidad+' cab.)';
      sel.appendChild(opt);
    }
  });
  if(!lots[cur].comprador) sel.value=cur;
  onModalLotChange();
  document.getElementById('m-buyer-name').value='';
  document.getElementById('m-buyer-ci').value='';
  document.getElementById('m-buyer-tel').value='';
  openModal('m-buyer');
}

function onModalLotChange() {
  var idx=document.getElementById('m-lot-sel').value;
  var tag=document.getElementById('m-lot-tag');
  if(idx===''){tag.style.display='none';return;}
  var l=lots[+idx];
  tag.style.display='block';
  tag.textContent='Lote '+l.lote+' — '+l.categoria+' | '+l.cantidad+' cab. | '+l.raza+' | '+l.propietario;
}

function saveBuyer() {
  var idx=document.getElementById('m-lot-sel').value;
  var nombre=document.getElementById('m-buyer-name').value.trim();
  if(idx===''||!nombre){toast('Selecciona lote y nombre',true);return;}
  var l=lots[+idx];
  l.comprador=nombre; l.compradorCI=document.getElementById('m-buyer-ci').value.trim(); l.compradorTel=document.getElementById('m-buyer-tel').value.trim();
  if(remateId) syncLot(l);
  closeModal('m-buyer'); renderOp();
  toast('Comprador asignado al lote '+l.lote);
}

// ── Add lot ──
function openAddLotModal() {
  var sel=document.getElementById('al-after');
  sel.innerHTML='<option value="-1">— Al inicio —</option>';
  lots.forEach(function(l,i){
    var opt=document.createElement('option');
    opt.value=i;
    opt.textContent='Orden '+l.orden+' — Lote '+l.lote+' — '+l.categoria;
    sel.appendChild(opt);
  });
  ['al-lote','al-raza','al-prop','al-prop-ci','al-estancia','al-edad','al-obs'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('al-preview').style.display='none';
  openModal('m-addlot');
}

function updateAddLotPreview() {
  var idx=parseInt(document.getElementById('al-after').value);
  var prev=document.getElementById('al-preview');
  prev.style.display='block';
  if(idx===-1){prev.textContent='Se insertara al inicio'; return;}
  var after=lots[idx], next=lots[idx+1];
  var newOrden=next?((after.orden+next.orden)/2).toFixed(2):(after.orden+1).toFixed(1);
  prev.textContent=next?'Entre orden '+after.orden+' y '+next.orden+' — nuevo orden: '+newOrden:'Al final, orden: '+newOrden;
}

function saveNewLot() {
  var idx=parseInt(document.getElementById('al-after').value);
  var lote=parseInt(document.getElementById('al-lote').value);
  var cant=parseInt(document.getElementById('al-cant').value);
  if(!lote||!cant){toast('Completa Lote y Cantidad',true);return;}
  var newOrden;
  if(isNaN(idx)||idx===-1){ newOrden=lots.length?lots[0].orden/2:1; }
  else { var after=lots[idx],next=lots[idx+1]; newOrden=next?(after.orden+next.orden)/2:after.orden+1; }
  var currentLot=lots[cur];
  lots.push(mkLot({LOTE:lote,ORDEN:newOrden,CANTIDAD:cant,CATEGORIA:document.getElementById('al-cat').value,RAZA:document.getElementById('al-raza').value.toUpperCase(),PROPIETARIO:document.getElementById('al-prop').value.toUpperCase(),CI_PROPIETARIO:document.getElementById('al-prop-ci').value.toUpperCase(),ESTANCIA:document.getElementById('al-estancia').value.toUpperCase(),EDAD:document.getElementById('al-edad').value.toUpperCase(),OBS:document.getElementById('al-obs').value.toUpperCase()}));
  lots.sort(function(a,b){return a.orden-b.orden;});
  cur=lots.indexOf(currentLot);
  closeModal('m-addlot'); renderOp();
  toast('Lote '+lote+' agregado — seguís en el lote actual');
}

// ── Export from operator ──
function openExportModal() {
  var saved=lots.filter(function(l){return l.saved;});
  var monto=saved.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  document.getElementById('export-summary').innerHTML=
    'Lotes guardados: <b style="color:var(--green)">'+saved.length+'</b> / '+lots.length+'<br>'+
    'Sin comprador: <b style="color:var(--gold)">'+saved.filter(function(l){return !l.comprador;}).length+'</b><br>'+
    'Monto total: <b style="color:var(--gold)">$'+monto.toLocaleString()+'</b>';
  openModal('m-export');
}
function exportJSON(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(lots,null,2)],{type:'application/json'}));a.download='agacon_remate.json';a.click();toast('JSON exportado');}
function exportCSV(){var cols=['orden','lote','propietario','estancia','cantidad','categoria','raza','edad','obs','peso','precio','comprador','compradorCI','compradorTel','saved'];var rows=lots.map(function(l){return cols.map(function(c){return'"'+String(l[c]||'').replace(/"/g,'""')+'"';}).join(',');});var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([[cols.join(',')].concat(rows).join('\n')],{type:'text/csv'}));a.download='agacon_remate.csv';a.click();toast('CSV exportado');}

// ════════════════════════════════════════
//  COMPRADORES MODULE
// ════════════════════════════════════════
var compLotes=[], compFilterMode='todos', compRemateId=null, compCurrentLotKey=null;
