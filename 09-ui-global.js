/* ═══════════════════════════════════════════════
   AGACON — 12-socios-admin.js
   Módulo Socios (Administración): tabla con búsqueda
   por nombre o CI, añadir y editar socios en Supabase.
   ═══════════════════════════════════════════════ */

var sociosAdmData = [];      // lista completa [{id, nombre, ci, telefono}]
var sociosAdmEditId = null;  // id en edición (null = nuevo)

// Cargar socios desde Supabase (incluye id para poder editar)
function sociosAdminLoad() {
  var tb = document.getElementById('socios-adm-tbody');
  if (tb) tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);">Cargando socios...</td></tr>';
  supa.from('socios').select('*').eq('activo', true).order('nombre')
    .then(function(res) {
      if (res.error) {
        if (tb) tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--red);">Error cargando socios: ' + res.error.message + '</td></tr>';
        return;
      }
      sociosAdmData = res.data || [];
      sociosAdminRender();
    });
}

// Escapar HTML para nombres/CI con caracteres especiales
function sociosEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Pintar la tabla aplicando el filtro actual
function sociosAdminRender() {
  var tb = document.getElementById('socios-adm-tbody');
  var cnt = document.getElementById('socios-adm-count');
  if (!tb) return;
  var q = (document.getElementById('socios-adm-search').value || '').trim();
  var qName = normName(q);
  var qCI = normCI(q);

  var list = sociosAdmData.filter(function(s) {
    if (!q) return true;
    // Coincidencia por nombre (normalizado, sin tildes) o por CI (solo dígitos)
    var okName = qName && normName(s.nombre || '').indexOf(qName) !== -1;
    var okCI = qCI && qCI.length >= 2 && normCI(s.ci || '').indexOf(qCI) !== -1;
    return okName || okCI;
  });

  if (cnt) cnt.textContent = q
    ? list.length + ' de ' + sociosAdmData.length
    : sociosAdmData.length + ' socios';

  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);">' +
      (q ? 'Sin resultados para "' + sociosEsc(q) + '"' : 'No hay socios cargados') + '</td></tr>';
    return;
  }

  var html = '';
  list.forEach(function(s, i) {
    html += '<tr>' +
      '<td style="color:var(--muted);">' + (i + 1) + '</td>' +
      '<td>' + sociosEsc(s.nombre) + '</td>' +
      '<td>' + sociosEsc(s.ci) + '</td>' +
      '<td>' + sociosEsc(s.telefono || '—') + '</td>' +
      '<td><button class="socio-edit-btn" onclick="sociosAdminEdit(\'' + s.id + '\')">✏️ Editar</button></td>' +
      '</tr>';
  });
  tb.innerHTML = html;
}

function sociosAdminFilter() { sociosAdminRender(); }

// Abrir modal en modo "nuevo"
function sociosAdminNew() {
  sociosAdmEditId = null;
  document.getElementById('m-socio-title').textContent = 'AÑADIR SOCIO';
  document.getElementById('m-socio-nombre').value = '';
  document.getElementById('m-socio-ci').value = '';
  document.getElementById('m-socio-tel').value = '';
  document.getElementById('m-socio-error').textContent = '';
  openModal('m-socio');
  setTimeout(function(){ document.getElementById('m-socio-nombre').focus(); }, 60);
}

// Abrir modal en modo "editar"
function sociosAdminEdit(id) {
  var s = null;
  for (var i = 0; i < sociosAdmData.length; i++) {
    if (String(sociosAdmData[i].id) === String(id)) { s = sociosAdmData[i]; break; }
  }
  if (!s) { toast('Socio no encontrado', true); return; }
  sociosAdmEditId = s.id;
  document.getElementById('m-socio-title').textContent = 'EDITAR SOCIO';
  document.getElementById('m-socio-nombre').value = s.nombre || '';
  document.getElementById('m-socio-ci').value = s.ci || '';
  document.getElementById('m-socio-tel').value = s.telefono || '';
  document.getElementById('m-socio-error').textContent = '';
  openModal('m-socio');
  setTimeout(function(){ document.getElementById('m-socio-nombre').focus(); }, 60);
}

// Guardar (insertar o actualizar)
function sociosAdminSave() {
  var nombre = (document.getElementById('m-socio-nombre').value || '').trim();
  var ci = (document.getElementById('m-socio-ci').value || '').trim();
  var tel = (document.getElementById('m-socio-tel').value || '').trim();
  var errEl = document.getElementById('m-socio-error');
  var btn = document.getElementById('m-socio-save');
  errEl.textContent = '';

  if (!nombre) { errEl.textContent = 'El nombre es obligatorio'; return; }
  if (!ci) { errEl.textContent = 'El CI es obligatorio'; return; }

  // Aviso de CI duplicado (contra otro socio distinto al que se edita)
  var ciN = normCI(ci);
  for (var i = 0; i < sociosAdmData.length; i++) {
    var o = sociosAdmData[i];
    if (String(o.id) !== String(sociosAdmEditId) && ciN && normCI(o.ci || '') === ciN) {
      errEl.textContent = 'Ya existe un socio con ese CI: ' + o.nombre;
      return;
    }
  }

  var payload = {
    nombre: nombre.toUpperCase(),
    ci: ci,
    ci_num: ciN,
    telefono: tel || null,
    categoria: 'socio',
    activo: true
  };

  btn.disabled = true;
  var prev = btn.textContent;
  btn.textContent = 'Guardando…';

  var op = sociosAdmEditId
    ? supa.from('socios').update(payload).eq('id', sociosAdmEditId)
    : supa.from('socios').insert([payload]);

  op.then(function(res) {
    // Si la tabla no tiene columna "telefono", reintentar sin ella
    if (res.error && /telefono/i.test(res.error.message || '')) {
      delete payload.telefono;
      return sociosAdmEditId
        ? supa.from('socios').update(payload).eq('id', sociosAdmEditId)
        : supa.from('socios').insert([payload]);
    }
    return res;
  }).then(function(res) {
    btn.disabled = false; btn.textContent = prev;
    if (res.error) {
      errEl.textContent = 'Error al guardar: ' + res.error.message;
      return;
    }
    closeModal('m-socio');
    toast(sociosAdmEditId ? 'Socio actualizado ✓' : 'Socio añadido ✓');
    sociosAdminLoad();
    // Refrescar la lista en memoria que usa la detección de defensas
    try { sociosLoadFromFirebase(); } catch (e) {}
  }).catch(function(e) {
    btn.disabled = false; btn.textContent = prev;
    errEl.textContent = 'Error inesperado: ' + e.message;
  });
}
