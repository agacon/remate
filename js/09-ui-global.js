/* ═══════════════════════════════════════════════
   AGACON — 09-ui-global.js
   Utilidades de interfaz: modales, toast, paneles, eliminar remate
   ═══════════════════════════════════════════════ */
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}

// ── Menú lateral del módulo Administración ──
function admShowPanel(name, btn){
  document.querySelectorAll('#screen-admin .adm-panel').forEach(function(p){p.classList.remove('on');});
  var p=document.getElementById('adm-panel-'+name); if(p)p.classList.add('on');
  document.querySelectorAll('#screen-admin .adm-nav').forEach(function(b){b.classList.remove('on');});
  if(btn)btn.classList.add('on');
  if(name==='comp') admEmbedCompradores();
  if(name==='socios' && typeof sociosAdminLoad==='function') sociosAdminLoad();
}
// Mueve la pantalla de Compradores dentro del panel del admin (una sola vez)
function admEmbedCompradores(){
  var scr=document.getElementById('screen-compradores');
  var host=document.getElementById('adm-panel-comp');
  if(scr && host && scr.parentNode!==host){ host.appendChild(scr); }
  try{ compLoadRematesList(); }catch(e){}
}
// (legado) config ahora vive en su propio panel del sidebar
function ensureConfigInModal(){}
function openConfigModal(){ admShowPanel('config'); }
function closeConfigModal(){}
function setText(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
function setFlip(id,val){var el=document.getElementById(id);if(!el||el.textContent===val)return;el.textContent=val;el.classList.remove('num-flip');void el.offsetWidth;el.classList.add('num-flip');}

// ── Delete remate ──
function delRemateSelectChanged(id) {
  var info = document.getElementById('del-remate-info');
  if (!id) { info.textContent=''; return; }
  supa.from('lotes').select('id', {count:'exact'}).eq('remate_id', id).then(function(res){
    var count = res.count || 0;
    info.textContent = '⚠ Este remate tiene '+count+' lotes. Se eliminarán permanentemente.';
    info.style.color = 'var(--gold)';
  });
}

function openDeleteRemateModal() {
  var sel = document.getElementById('del-remate-sel');
  sel.innerHTML = '<option value="">— Seleccionar remate —</option>';
  supa.from('remates').select('*').order('creado_en', {ascending: false}).then(function(res) {
    var data = res.data || [];
    if (!data.length) { toast('No hay remates en Supabase', true); return; }
    data.forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = (r.nombre || ('Remate '+(r.fecha||'')));
      sel.appendChild(opt);
    });
  });
  document.getElementById('del-remate-info').textContent = '';
  openModal('m-del-remate');
}

// button calls openDeleteRemateModal directly via onclick

// Also update select to show info
setTimeout(function(){
  var sel = document.getElementById('del-remate-sel');
  if (sel) sel.addEventListener('change', function() {
    var id = this.value;
    var info = document.getElementById('del-remate-info');
    if (!id) { info.textContent=''; return; }
    supa.from('lotes').select('id', {count:'exact'}).eq('remate_id', id).then(function(res) {
      var count = res.count || 0;
      info.textContent = '⚠ Este remate tiene '+count+' lotes registrados. Se eliminarán permanentemente.';
      info.style.color = 'var(--gold)';
    });
  });
}, 500);

function confirmDeleteRemate() {
  var sel = document.getElementById('del-remate-sel');
  var id  = sel.value;
  var nombre = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : id;
  if (!id) { toast('Seleccioná un remate', true); return; }

  if (!confirm('¿Estas seguro? Se eliminara permanentemente: ' + nombre)) return;

  // ON DELETE CASCADE elimina los lotes automáticamente
  supa.from('remates').delete().eq('id', id).then(function(res) {
    if (res.error) {
      toast('Error al eliminar: '+res.error.message, true);
    } else {
      closeModal('m-del-remate');
      toast('Remate eliminado ✓');
      if (admRemateId === id) {
        admLotes = [];
        admRemateId = null;
        if (_admPoller) { clearInterval(_admPoller); _admPoller = null; }
        admRecalc();
      }
      admLoadRematesList();
    }
  });
}

var toastTimer;
function toast(msg,err){
  var el=document.getElementById('toast');
  el.textContent=msg;el.className='toast show'+(err?' err':'');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){el.classList.remove('show');},3000);
}

// ════════════════════════════════════════
//  BALANZA SERIAL (Web Serial API)
// ════════════════════════════════════════
var balPort      = null;
var balReader    = null;
var balBuffer    = '';
var balPesoActual= 0;
var balActiva    = false;
