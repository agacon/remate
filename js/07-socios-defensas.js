/* ═══════════════════════════════════════════════
   AGACON — 07-socios-defensas.js
   Lista de socios, detección de defensas por CI, datos bancarios
   ═══════════════════════════════════════════════ */
// ── SOCIOS management ──
var sociosList = []; // [{nombre, ci, ciNum}]

function normCI(ci) {
  // Extract only digits from CI for comparison
  if (!ci) return '';
  return String(ci).replace(/[^0-9]/g, '').trim();
}

function normName(name) {
  if (!name) return '';
  return String(name).toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/ +/g, ' ').trim();
}

function isSocio(nombre, ci) {
  if (!sociosList.length) return null; // list not loaded
  var normN = normName(nombre);
  var normC = normCI(ci);
  var tieneCI = normC && normC.length >= 6;
  for (var i = 0; i < sociosList.length; i++) {
    var s = sociosList[i];
    var sCI = normCI(s.ciNum || s.ci || '');
    // Si la persona y el socio tienen CI, se decide SOLO por CI EXACTO.
    // (un CI distinto = persona distinta, aunque el nombre se parezca)
    if (tieneCI && sCI && sCI.length >= 6) {
      if (sCI === normC) return true;
      continue; // distinto CI: no comparar por nombre con este socio
    }
    // Sin CI para comparar: recién ahí se usa el nombre (2+ palabras coinciden)
    if (normN && s.normNombre) {
      var partsS = s.normNombre.split(' ');
      var partsN = normN.split(' ');
      var matches = partsS.filter(function(p){ return p.length>2 && partsN.indexOf(p)>=0; });
      if (matches.length >= 2) return true;
    }
  }
  return false;
}

function sociosImport(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var wb = XLSX.read(e.target.result, {type:'array'});
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});

    // Buscar fila de encabezados (contiene CARNET o NOMBRE)
    var headerRow = -1;
    for (var i=0; i<rows.length; i++) {
      var r = rows[i];
      if (r && r.some(function(c){ return c && String(c).toUpperCase().includes('CARNET'); })) {
        headerRow = i; break;
      }
    }
    if (headerRow < 0) { toast('No se encontró columna CARNET en el Excel', true); return; }

    var H = rows[headerRow].map(function(h){ return h ? String(h).toUpperCase().trim() : ''; });

    // Detectar columnas por contenido del header
    var colNombre = H.findIndex(function(h){ return h.includes('APELLIDO') || h.includes('NOMBRE'); });
    var colCI     = H.findIndex(function(h){ return h.includes('CARNET'); });
    var colObs    = H.findIndex(function(h){ return h === 'OBS.' || h === 'OBS' || h.includes('OBSERV'); });

    if (colNombre < 0) { toast('No se encontró columna de NOMBRE/APELLIDO', true); return; }
    if (colCI < 0)     { toast('No se encontró columna N° CARNET', true); return; }

    var parsed = [];
    for (var i=headerRow+1; i<rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      var nombre = r[colNombre];
      var ciBase = r[colCI];
      var ciObs  = colObs >= 0 ? r[colObs] : null;

      if (!nombre && !ciBase) continue;
      nombre = String(nombre||'').trim();
      if (!nombre) continue;

      // CI completo = numero + sufijo (ej: "1454078 SC")
      var ciNum  = String(ciBase||'').trim().replace(/[^0-9]/g,'');
      var ciSuf  = ciObs ? String(ciObs).trim() : String(ciBase||'').trim().replace(/[0-9]/g,'').trim();
      var ciFull = ciNum + (ciSuf ? ' '+ciSuf : '');

      parsed.push({
        nombre:     nombre,
        ci:         ciFull,
        normNombre: normName(nombre),
        ciNum:      ciNum
      });
    }

    sociosList = parsed;
    // Guardar en tabla socios — primero borrar los anteriores, luego insertar
    toast('Importando ' + parsed.length + ' socios...');
    supa.from('socios').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(function() {
      // Insertar en bloques de 100
      var chunks = [];
      for (var i=0; i<parsed.length; i+=100) chunks.push(parsed.slice(i,i+100));
      var chain = Promise.resolve();
      chunks.forEach(function(chunk) {
        chain = chain.then(function() {
          return supa.from('socios').insert(chunk.map(function(s) {
            return {
              nombre:    s.nombre,
              ci:        s.ci,
              ci_num:    s.ciNum,
              categoria: 'socio',
              activo:    true
            };
          }));
        });
      });
      chain.then(function() {
        sociosUpdateUI(parsed.length);
        toast('Lista de socios guardada: ' + parsed.length + ' socios ✓');
      }).catch(function(err) {
        toast('Error guardando socios: '+err.message, true);
      });
    });
  };
  reader.readAsArrayBuffer(file);
}

function sociosLoadFromFirebase() {
  supa.from('socios').select('*').eq('activo', true).order('nombre').then(function(res) {
    if (res.error || !res.data || !res.data.length) {
      var sc = document.getElementById('socios-count');
      if (sc) sc.textContent = 'No cargada';
      return;
    }
    sociosList = res.data.map(function(s) {
      return {
        nombre:    s.nombre,
        ci:        s.ci,
        ciNum:     s.ci_num || normCI(s.ci||''),
        normNombre: normName(s.nombre||''),
        categoria: s.categoria || 'socio',
        telefono:  s.telefono || ''
      };
    });
    sociosUpdateUI(sociosList.length);
  });
}

function sociosUpdateUI(count) {
  var sc = document.getElementById('socios-count');
  if (sc) { sc.textContent = count + ' socios cargados'; sc.style.color = 'var(--green)'; }
  var rb = document.getElementById('socios-reload-btn');
  if (rb) rb.style.display = 'inline';
  var prev = document.getElementById('socios-preview');
  if (prev) {
    prev.style.display = 'block';
    prev.textContent = 'Primeros 3: ' + sociosList.slice(0,3).map(function(s){ return s.nombre+' ('+s.ci+')'; }).join(' | ');
  }
}

// ── DEFENSA detection ──
function isDefensa(lot) {
  // A lot is a defensa if comprador name or CI matches the propietario
  if (!lot.comprador) return false;
  var propNorm = normName(lot.propietario || '');
  var compNorm = normName(lot.comprador || '');
  var propCI   = normCI(lot.ciPropietario || '');
  var compCI   = normCI(lot.compradorCI || '');

  // CI match (digits only, >= 6 digits)
  if (propCI && compCI && propCI.length >= 6 && compCI.length >= 6) {
    if (propCI === compCI || propCI.includes(compCI) || compCI.includes(propCI)) return true;
  }
  // Name similarity: at least 2 words in common
  if (propNorm && compNorm) {
    var partsP = propNorm.split(' ').filter(function(p){ return p.length > 2; });
    var partsC = compNorm.split(' ').filter(function(p){ return p.length > 2; });
    var matches = partsP.filter(function(p){ return partsC.indexOf(p) >= 0; });
    if (matches.length >= 2) return true;
  }
  return false;
}

// Defensa "efectiva": es defensa si ya está marcada como tal, O si el CI del comprador
// coincide con el CI del propietario del mismo lote. Nos basamos en el CI (no en el nombre)
// para que una misma persona (mismo CI, nombre escrito distinto) no cuente a la vez como
// compra Y como defensa. Si el CI coincide, es defensa y no debe figurar como compra.
function lotEsDefensa(l) {
  if (!l) return false;
  if (l.esDefensa) return true;
  if (!l.comprador) return false;
  var pCI = normCI(l.ciPropietario || '');
  var cCI = normCI(l.compradorCI || '');
  return !!(pCI && cCI && pCI.length >= 6 && cCI.length >= 6 && pCI === cCI);
}

// Guarda en la base que un lote es defensa y su % de comisión, para no volver a preguntar.
function admPersistDefensa(lot, pct) {
  if (!lot || !lot._key || !admRemateId || typeof supa === 'undefined') return;
  try {
    supa.from('lotes').update({ es_defensa: true, defensa_com: pct })
      .eq('remate_id', admRemateId).eq('lote_key', lot._key)
      .then(function(){}, function(){});
  } catch (e) {}
}

function getDefensaComPct(lot) {
  // 0.5% si el propietario ESTÁ en la lista de socios.
  // Devuelve null si NO está en la lista (o no se puede determinar) → el llamador debe PREGUNTAR.
  var esSocio = isSocio(lot.propietario, lot.ciPropietario);
  return esSocio === true ? 0.5 : null;
}

// Resuelve la comisión de una defensa: usa la ya guardada; si está en la lista de socios → 0.5%;
// si no está en la lista y defendió → pregunta (0.5% socio / 1% no socio). Cachea por persona
// (CI o nombre) para no preguntar dos veces por la misma persona en la misma exportación.
function resolveDefensaPct(lot, cache) {
  if (lot.defensaCom != null) return lot.defensaCom;
  var key = normCI(lot.ciPropietario || '') || normName(lot.propietario || '');
  if (cache && key && cache[key] != null) return cache[key];
  var pct = getDefensaComPct(lot); // 0.5 si es socio, null si no está en la lista
  if (pct == null) {
    var esSocio = confirm('🛡 DEFENSA de "' + (lot.propietario || '') + '"' +
      (lot.ciPropietario ? ' (CI: ' + lot.ciPropietario + ')' : '') +
      '\n\nNo está en la lista de socios.\n¿El propietario es SOCIO?\n\n' +
      '• Aceptar = SÍ es socio (comisión 0.5%)\n• Cancelar = NO es socio (comisión 1%)');
    pct = esSocio ? 0.5 : 1;
  }
  if (cache && key) cache[key] = pct;
  return pct;
}

// ── Bank data Firebase persistence ──
function bankLoadFromFirebase() {
  configGet('datosBancarios').then(function(data) {
    if (!data) return;
    ['nombre','cuenta','tipo','titular1','ci1','titular2','ci2'].forEach(function(k) {
      var el = document.getElementById('bank-'+k);
      if (el) el.value = data[k] || '';
    });
    bankUpdateView(data);
    document.getElementById('bank-status').style.display = 'inline';
  });
}

function bankUpdateView(data) {
  document.getElementById('bv-nombre').textContent   = data.nombre   || '—';
  document.getElementById('bv-cuenta').textContent   = data.cuenta   || '—';
  document.getElementById('bv-tipo').textContent     = data.tipo     || '—';
  document.getElementById('bv-titular1').textContent = data.titular1 || '—';
  document.getElementById('bv-ci1').textContent      = data.ci1      || '—';
  document.getElementById('bv-titular2').textContent = data.titular2 || '—';
  document.getElementById('bv-ci2').textContent      = data.ci2      || '—';
}

function bankToggleEdit() {
  document.getElementById('bank-view').style.display  = 'none';
  document.getElementById('bank-form').style.display  = 'flex';
  document.getElementById('bank-edit-btn').style.display   = 'none';
  document.getElementById('bank-save-btn').style.display   = 'inline';
  document.getElementById('bank-cancel-btn').style.display = 'inline';
  document.getElementById('bank-nombre').focus();
}

function bankCancelEdit() {
  document.getElementById('bank-view').style.display  = 'grid';
  document.getElementById('bank-form').style.display  = 'none';
  document.getElementById('bank-edit-btn').style.display   = 'inline';
  document.getElementById('bank-save-btn').style.display   = 'none';
  document.getElementById('bank-cancel-btn').style.display = 'none';
}

function bankSave() {
  var data = getBankData();
  configSet('datosBancarios', data).then(function(ok) {
    if (!ok) { toast('Error guardando datos bancarios', true); return; }
    bankUpdateView(data);
    bankCancelEdit();
    document.getElementById('bank-status').style.display = 'inline';
    toast('Datos bancarios guardados ✓');
  });
}
