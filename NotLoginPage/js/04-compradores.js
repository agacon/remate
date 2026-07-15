/* ═══════════════════════════════════════════════
   AGACON — 04-compradores.js
   Asignación de compradores, filtros por columna, lote manual, defensa manual
   ═══════════════════════════════════════════════ */
function compLoadRematesList() {
  supa.from('remates').select('*').order('creado_en', {ascending: false}).then(function(res) {
    var data = res.data || [];
    var sel = document.getElementById('comp-remate-sel');
    sel.innerHTML = '<option value="">— Seleccionar remate —</option>';
    if (!data.length) { toast('No hay remates en Supabase', true); return; }
    data.forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r.id;
      var hora = r.creado_en ? new Date(r.creado_en).toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'}) : '';
      opt.textContent = (r.nombre || ('Remate '+(r.fecha||'')+' '+hora));
      sel.appendChild(opt);
    });
    var saved = localStorage.getItem('agacon_remateId');
    if (saved && data.find(function(r){return r.id===saved;})) { sel.value = saved; compLoadRemate(saved); }
  });
}

var _compPoller = null;
function compLoadRemate(remId) {
  if (!remId) return;
  compRemateId = remId;
  localStorage.setItem('agacon_remateId', remId);
  if (_compPoller) clearInterval(_compPoller);
  function fetchAndRender() {
    supaGetLotes(remId).then(function(lotes) {
      compLotes = lotes.filter(function(l){return l.saved;});
      compRenderTable();
      compUpdateStats();
    });
  }
  fetchAndRender();
  _compPoller = setInterval(fetchAndRender, 3000);
}

// Filtros por columna (lupita en cada título de la tabla)
var compColFilters = {};
function compToggleColFilter(field){
  var inp=document.getElementById('cf-'+field);
  var lupa=inp ? inp.parentNode.querySelector('.th-lupa') : null;
  if(!inp) return;
  var visible = inp.style.display!=='none' && inp.style.display!=='';
  if(visible){
    inp.style.display='none'; inp.value=''; if(lupa) lupa.classList.remove('on');
    delete compColFilters[field]; compRenderTable();
  } else {
    inp.style.display='block'; if(lupa) lupa.classList.add('on'); inp.focus();
  }
}
function compSetColFilter(field, val){
  val=(val||'').trim().toLowerCase();
  if(val) compColFilters[field]=val; else delete compColFilters[field];
  compRenderTable();
}

function compRenderTable() {
  var tbody=document.getElementById('comp-tbody');
  var rows=compLotes.filter(function(l){return l.saved;});
  if(compFilterMode==='pendientes') rows=rows.filter(function(l){return !l.comprador;});
  if(compFilterMode==='asignados')  rows=rows.filter(function(l){return !!l.comprador;});
  // Filtros por columna (lupita en cada título)
  Object.keys(compColFilters).forEach(function(field){
    var q=compColFilters[field];
    rows=rows.filter(function(l){
      var v=(l[field]!=null ? String(l[field]) : '').toLowerCase();
      if(field==='lote') return v===q;      // lote: coincidencia exacta
      return v.indexOf(q)>=0;               // resto: contiene
    });
  });
  // Mostrar el más nuevo primero: orden decreciente (los lotes nuevos aparecen arriba)
  rows.sort(function(a,b){ return (Number(b.orden)||0) - (Number(a.orden)||0); });
  tbody.innerHTML='';
  if(!rows.length){
    var tr=document.createElement('tr');
    var td=document.createElement('td');
    td.colSpan=12;td.style.cssText='text-align:center;color:#888;padding:2rem';
    td.textContent='No hay lotes con este filtro';
    tr.appendChild(td);tbody.appendChild(tr);return;
  }
  var fontSize = 'font-size:.8rem';
  var fontBig  = 'font-size:.9rem;font-weight:700';
  rows.forEach(function(l){
    var total=(l.precio||0)*(l.cantidad||0);
    var hasBuyer=!!l.comprador;
    var tr=document.createElement('tr');
    tr.className=hasBuyer?'done':'pend';
    if(l.esDefensa) tr.classList.add('row-defensa');
    function cell(text,style){var td=document.createElement('td');td.textContent=text;if(style)td.style.cssText=style;return td;}
    var dispMonto    = l.montoTotal   || total;
    var dispCom      = l.comision     || parseFloat((total*0.03).toFixed(2));
    var dispTotalCom = l.totalConCom  || parseFloat((total*1.03).toFixed(2));

    // Orden
    tr.appendChild(cell(l.orden, fontSize+';color:#aaa'));
    // Lote
    tr.appendChild(cell(l.lote, fontBig+';font-size:.95rem'));
    // Propietario (con CI abajo, igual que el comprador)
    var tdProp=document.createElement('td');
    tdProp.style.cssText=fontSize;
    tdProp.textContent=l.propietario||'—';
    if(l.ciPropietario){var brP=document.createElement('br');var smP=document.createElement('small');smP.style.cssText='color:#888;font-size:.66rem';smP.textContent='CI: '+l.ciPropietario;tdProp.appendChild(brP);tdProp.appendChild(smP);}
    if(l.esDefensa){var brD=document.createElement('br');var tag=document.createElement('span');tag.className='tag-defensa';tag.textContent='🛡 DEFENSA';tdProp.appendChild(brD);tdProp.appendChild(tag);}
    tr.appendChild(tdProp);
    // Cantidad
    tr.appendChild(cell(l.cantidad, fontBig+';text-align:center'));
    // Categoria
    tr.appendChild(cell(l.categoria, fontSize+';font-weight:600'));
    // Raza
    tr.appendChild(cell(l.raza||'—', fontSize+';color:#555'));
    // Precio unitario
    tr.appendChild(cell('$us '+(l.precio||0), fontBig+';color:#1a2333'));
    // Total
    tr.appendChild(cell('$us '+dispMonto.toLocaleString(), fontBig+';color:#4a4a4a'));
    // Comision 3%
    tr.appendChild(cell('$us '+dispCom.toFixed(2), fontSize+';color:#555'));
    // Liq. Pagable
    tr.appendChild(cell('$us '+dispTotalCom.toFixed(2), fontBig+';color:#1a2333'));
    // Comprador
    var tdBuyer=document.createElement('td');
    tdBuyer.style.cssText=fontSize+';color:'+(hasBuyer?'#1a2333':'#f39c12');
    tdBuyer.textContent=hasBuyer?l.comprador:'—';
    if(l.compradorCI){var br=document.createElement('br');var small=document.createElement('small');small.style.cssText='color:#888;font-size:.66rem';small.textContent='CI: '+l.compradorCI;tdBuyer.appendChild(br);tdBuyer.appendChild(small);}
    tr.appendChild(tdBuyer);
    // Accion
    var tdBtn=document.createElement('td');
    tdBtn.style.whiteSpace='nowrap';
    var btn=document.createElement('button');
    btn.className='btn-asign'+(hasBuyer?' btn-edit':'');
    btn.textContent=hasBuyer?'Editar':'+ Asignar';
    (function(key){btn.onclick=function(){compOpenModal(key);};})(l._key);
    tdBtn.appendChild(btn);
    // Editar el lote completo (propietario, precio, etc.)
    var btnL=document.createElement('button');
    btnL.className='btn-asign btn-edit';
    btnL.style.cssText='margin-left:.3rem;background:#5B667A';
    btnL.textContent='✎ Lote';
    btnL.title='Editar todos los datos del lote';
    (function(key){btnL.onclick=function(){compOpenEditarLote(key);};})(l._key);
    tdBtn.appendChild(btnL);
    tr.appendChild(tdBtn);
    tbody.appendChild(tr);
  });
}

function compUpdateStats() {
  var saved=compLotes.filter(function(l){return l.saved;});
  var monto=saved.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  setText('cst-tot',compLotes.length);
  setText('cst-vend',saved.length);
  setText('cst-sinc',saved.filter(function(l){return !l.comprador;}).length);
  setText('cst-monto','$'+monto.toLocaleString());
}

function compSetFilter(mode,btn) {
  compFilterMode=mode;
  document.querySelectorAll('.fbtn').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  compRenderTable();
}

function compSearchSocio(mode) {
  var query = (mode==='ci'
    ? document.getElementById('mc-search-ci').value
    : document.getElementById('mc-search-nombre').value
  ).trim();
  var sug = document.getElementById('mc-suggestions');
  if (!query || query.length < 2) { sug.style.display='none'; return; }

  // Si la lista local está vacía, buscar en Supabase directamente
  if (!sociosList.length) {
    var col = mode==='ci' ? 'ci_num' : 'nombre';
    supa.from('socios').select('*').ilike(col, '%'+query+'%').eq('activo',true).limit(8).then(function(res) {
      if (!res.data || !res.data.length) { sug.style.display='none'; return; }
      var mapped = res.data.map(function(s){
        return {nombre:s.nombre, ci:s.ci, ciNum:s.ci_num||'', categoria:s.categoria||'socio', telefono:s.telefono||''};
      });
      compRenderSuggestions(mapped, sug);
    });
    return;
  }

  // Buscar en lista local
  var q = query.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  var matches = sociosList.filter(function(s) {
    if (mode==='ci') {
      return (s.ciNum||'').includes(q) || (s.ci||'').toUpperCase().includes(q);
    } else {
      var norm = (s.normNombre||'').normalize('NFD').replace(/[̀-ͯ]/g,'');
      return norm.includes(q);
    }
  }).slice(0,8);

  compRenderSuggestions(matches, sug);
}

function compRenderSuggestions(matches, sug) {
  if (!matches.length) { sug.style.display='none'; return; }
  sug.innerHTML = '';
  matches.forEach(function(s) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:.55rem .9rem;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:.5rem;';
    var esSocio = (s.categoria||'socio') === 'socio';
    var badge = '<span style="font-size:.58rem;padding:.1rem .4rem;border-radius:3px;background:'+(esSocio?'#2ecc71':'#e74c3c')+';color:#fff;font-weight:700;">'+(esSocio?'SOCIO':'NO SOCIO')+'</span>';
    div.innerHTML =
      '<div>'+
        '<div style="font-weight:700;font-size:.92rem;color:#fff">'+s.nombre+'</div>'+
        '<div style="font-size:.72rem;color:var(--muted)">CI: '+(s.ci||'—')+(s.telefono?' · Tel: '+s.telefono:'')+'</div>'+
      '</div>'+
      '<div>'+badge+'</div>';
    div.onmouseenter = function(){ this.style.background='rgba(255,255,255,.07)'; };
    div.onmouseleave = function(){ this.style.background=''; };
    (function(socio){
      div.onclick = function() {
        document.getElementById('mc-nombre').value = socio.nombre;
        document.getElementById('mc-ci').value = socio.ciNum || socio.ci;
        if (document.getElementById('mc-tel')) document.getElementById('mc-tel').value = socio.telefono||'';
        document.getElementById('mc-search-nombre').value = '';
        document.getElementById('mc-search-ci').value = '';
        sug.style.display = 'none';
      };
    })(s);
    sug.appendChild(div);
  });
  sug.style.display = 'block';
}

// ── Añadir lote manual (para lotes rematados después de cerrar el operador) ──
var compEditLotKey = null; // si tiene valor, el modal está EDITANDO ese lote
function compOpenNuevoLote() {
  if (!compRemateId) { toast('Primero seleccioná un remate', true); return; }
  compEditLotKey = null;
  document.getElementById('nl-title').textContent = '＋ Añadir lote manual';
  ['nl-lote','nl-cantidad','nl-propietario','nl-ci-prop','nl-categoria','nl-raza','nl-precio','nl-estancia','nl-comprador','nl-ci-comp'].forEach(function(id){
    var e=document.getElementById(id); if(e) e.value='';
  });
  // Sugerir el próximo número de lote y orden
  var maxLote=0; compLotes.forEach(function(l){ var n=parseInt(l.lote,10); if(!isNaN(n)&&n>maxLote) maxLote=n; });
  document.getElementById('nl-lote').value = maxLote+1;
  openModal('m-nuevo-lote');
}

// Editar TODOS los datos de un lote existente (propietario, categoría, precio, comprador...)
function compOpenEditarLote(lotKey) {
  var lot = compLotes.find(function(l){ return l._key===lotKey; });
  if (!lot) { toast('Lote no encontrado', true); return; }
  compEditLotKey = lotKey;
  document.getElementById('nl-title').textContent = '✎ Editar lote '+(lot.lote||'');
  document.getElementById('nl-lote').value        = lot.lote||'';
  document.getElementById('nl-cantidad').value    = lot.cantidad||'';
  document.getElementById('nl-propietario').value = lot.propietario||'';
  document.getElementById('nl-ci-prop').value     = lot.ciPropietario||'';
  document.getElementById('nl-categoria').value   = lot.categoria||'';
  document.getElementById('nl-raza').value        = lot.raza||'';
  document.getElementById('nl-precio').value      = lot.precio||'';
  document.getElementById('nl-estancia').value    = lot.estancia||'';
  document.getElementById('nl-comprador').value   = lot.comprador||'';
  document.getElementById('nl-ci-comp').value     = lot.compradorCI||'';
  openModal('m-nuevo-lote');
}

async function compGuardarNuevoLote() {
  var lote      = parseInt(document.getElementById('nl-lote').value,10);
  var cantidad  = parseInt(document.getElementById('nl-cantidad').value,10);
  var propietario = document.getElementById('nl-propietario').value.trim();
  var ciProp    = document.getElementById('nl-ci-prop').value.trim();
  var categoria = document.getElementById('nl-categoria').value.trim().toUpperCase();
  var raza      = document.getElementById('nl-raza').value.trim().toUpperCase();
  var precio    = parseFloat(document.getElementById('nl-precio').value);
  var estancia  = document.getElementById('nl-estancia').value.trim();
  var comprador = document.getElementById('nl-comprador').value.trim();
  var ciComp    = document.getElementById('nl-ci-comp').value.trim();

  // Caso especial (registro manual): SOLO se exige propietario y precio.
  // Sin CI, sin categoría, sin restricciones extra. Lo demás se completa solo.
  if (!propietario || isNaN(precio) || precio<=0) {
    toast('Faltan datos: propietario y precio son necesarios', true); return;
  }
  if (!cantidad || cantidad<1) cantidad = 1;
  if (!categoria) categoria = 'SIN CATEGORÍA';
  if (!lote || lote<1) {
    // Asignar automáticamente el siguiente número de lote disponible
    var mx=0; compLotes.forEach(function(l){ var n=parseInt(l.lote,10); if(!isNaN(n)&&n>mx) mx=n; });
    lote = mx+1;
  }
  // ── MODO EDICIÓN: actualizar el lote existente por su clave original ──
  if (compEditLotKey) {
    var lotOrig = compLotes.find(function(l){ return l._key===compEditLotKey; });
    if (!lotOrig) { toast('Lote no encontrado', true); return; }
    var upd = {
      lote: lote, propietario: propietario, ci_propietario: ciProp, estancia: estancia,
      cantidad: cantidad, categoria: categoria, raza: raza, precio: precio,
      monto_total: precio*cantidad, comision: precio*cantidad*0.03,
      total_con_com: precio*cantidad*1.03,
      comprador: comprador, comprador_ci: ciComp
    };
    // Re-evaluar defensa con los datos editados (misma regla de siempre)
    if (comprador) {
      var lotTest = { propietario:propietario, ciPropietario:ciProp, comprador:comprador, compradorCI:ciComp };
      var esDefE = isDefensa(lotTest);
      upd.es_defensa = esDefE;
      if (esDefE) {
        var pctE = (lotOrig.esDefensa && lotOrig.defensaCom!=null) ? lotOrig.defensaCom : getDefensaComPct(lotTest);
        if (pctE == null) {
          var respE = confirm('🛡 DEFENSA de "'+propietario+'"\n\n¿El propietario es SOCIO?\n\n• Aceptar = SÍ es socio (comisión 0.5%)\n• Cancelar = NO es socio (comisión 1%)');
          pctE = respE ? 0.5 : 1;
        }
        upd.defensa_com = pctE;
      } else { upd.defensa_com = null; }
    } else { upd.es_defensa = false; upd.defensa_com = null; }

    var resE = await supa.from('lotes').update(upd)
      .eq('remate_id', compRemateId).eq('lote_key', compEditLotKey);
    if (resE.error) { toast('Error actualizando el lote', true); return; }
    compEditLotKey = null;
    closeModal('m-nuevo-lote');
    toast('Lote '+lote+' actualizado ✓');
    compLoadRemate(compRemateId);
    return;
  }

  // Evitar duplicar número de lote en el remate
  var yaExiste = compLotes.some(function(l){ return String(l.lote)===String(lote); });
  if (yaExiste && !confirm('Ya existe un lote N° '+lote+' en este remate. ¿Guardar igual?')) return;

  // Orden: siguiente al mayor existente (así aparece arriba en la tabla)
  var maxOrden=0; compLotes.forEach(function(l){ if((+l.orden||0)>maxOrden) maxOrden=+l.orden; });

  var nuevo = {
    orden: maxOrden+1, lote: lote,
    propietario: propietario, ciPropietario: ciProp, estancia: estancia,
    cantidad: cantidad, categoria: categoria, raza: raza,
    edad:'', obs:'MANUAL', precio: precio, peso: 0, saved: true,
    montoTotal: precio*cantidad, comision: precio*cantidad*0.03,
    totalConCom: precio*cantidad*1.03,
    comprador: comprador, compradorCI: ciComp, compradorTel: ''
  };

  // Defensa por CI (misma regla de siempre) + comisión socio/no socio
  if (comprador) {
    var esDef = isDefensa(nuevo);
    nuevo.esDefensa = esDef;
    if (esDef) {
      var pct = getDefensaComPct(nuevo);
      if (pct == null) {
        var esSocioResp = confirm('🛡 DEFENSA de "'+propietario+'"\n\n¿El propietario es SOCIO?\n\n• Aceptar = SÍ es socio (comisión 0.5%)\n• Cancelar = NO es socio (comisión 1%)');
        pct = esSocioResp ? 0.5 : 1;
      }
      nuevo.defensaCom = pct;
    }
  }

  var ok = await supaUpsertLote(compRemateId, nuevo);
  if (!ok) { toast('Error guardando el lote en la base', true); return; }
  closeModal('m-nuevo-lote');
  toast('Lote '+lote+' añadido ✓');
  compLoadRemate(compRemateId); // recargar la tabla
}

function compOpenModal(lotKey) {
  var lot=compLotes.find(function(l){return l._key===lotKey;});
  if(!lot) return;
  compCurrentLotKey=lotKey;
  document.getElementById('m-comp-info').textContent='Lote '+lot.lote+' — '+lot.categoria+' | '+lot.cantidad+' cab. | Propietario: '+(lot.propietario||'—')+' | Precio: $'+(lot.precio||0);
  document.getElementById('mc-nombre').value=lot.comprador||'';
  document.getElementById('mc-ci').value=lot.compradorCI||'';
  document.getElementById('mc-tel').value=lot.compradorTel||'';
  // Estado de defensa manual: reflejar lo ya guardado en el lote
  var cbDef=document.getElementById('mc-defensa');
  cbDef.checked = !!lot.esDefensa;
  document.getElementById('mc-defensa-com').value = (lot.defensaCom!=null ? String(lot.defensaCom) : '0.5');
  compToggleDefensa();
  document.getElementById('mc-plataforma').checked = !!lot.otraPlataforma;
  document.getElementById('mc-search-nombre').value='';
  document.getElementById('mc-search-ci').value='';
  document.getElementById('mc-suggestions').style.display='none';
  openModal('m-comp-buyer');
  setTimeout(function(){document.getElementById('mc-search-nombre').focus();},100);
}

// Muestra/oculta el selector de comisión al marcar "defensa manual".
// Si el lote aún no tiene comisión guardada, sugiere el % según si el propietario es socio.
function compToggleDefensa() {
  var cb=document.getElementById('mc-defensa');
  var box=document.getElementById('mc-defensa-pct');
  if(!cb||!box) return;
  box.style.display = cb.checked ? 'block' : 'none';
  if (cb.checked) {
    var lot = compLotes.find(function(l){ return l._key===compCurrentLotKey; });
    if (lot && lot.defensaCom==null && typeof isSocio==='function') {
      var socio = isSocio(lot.propietario, lot.ciPropietario);
      var sel = document.getElementById('mc-defensa-com');
      if (socio===true) sel.value='0.5';
      else if (socio===false) sel.value='1';
    }
  }
}

function compSaveComprador() {
  var nombre=document.getElementById('mc-nombre').value.trim();
  var ci    =document.getElementById('mc-ci').value.trim();
  var tel   =document.getElementById('mc-tel').value.trim();
  if(!nombre){toast('Ingresa el nombre',true);return;}

  // Check defensa: buyer matches seller
  var lot = compLotes.find(function(l){ return l._key===compCurrentLotKey; });
  var testLot = lot ? Object.assign({},lot,{comprador:nombre,compradorCI:ci}) : null;

  var defensaManual = document.getElementById('mc-defensa').checked;
  var esDefensa, comPct;

  if (defensaManual) {
    // Defensa forzada por el usuario: se toma el % elegido, sin preguntar y sin importar el CI
    esDefensa = true;
    comPct = parseFloat(document.getElementById('mc-defensa-com').value) || 0.5;
  } else {
    // Detección automática por CI / nombre
    esDefensa = testLot ? isDefensa(testLot) : false;
    comPct = esDefensa ? getDefensaComPct(lot) : null;
    // Si es defensa pero no se pudo determinar socio/no socio, preguntar al usuario
    if (esDefensa && comPct === null) {
      var esSocioResp = confirm('🛡 DEFENSA de "'+(lot.propietario||'')+'"\n\n¿El propietario es SOCIO?\n\n• Aceptar = SÍ es socio (comisión 0.5%)\n• Cancelar = NO es socio (comisión 1%)');
      comPct = esSocioResp ? 0.5 : 1;
    }
  }

  var otraPlat = document.getElementById('mc-plataforma').checked;

  var update = {comprador:nombre, compradorCI:ci, compradorTel:tel,
    esDefensa: esDefensa, defensaCom: esDefensa ? comPct : null, otraPlataforma: otraPlat};

  supa.from('lotes').update({
    comprador:    nombre,
    comprador_ci: ci,
    comprador_tel:tel,
    es_defensa:   esDefensa,
    defensa_com:  esDefensa ? comPct : null,
    otra_plataforma: otraPlat
  }).eq('remate_id', compRemateId).eq('lote_key', compCurrentLotKey).then(function(res) {
    if (res.error) { toast('Error guardando comprador'+(String(res.error.message||'').indexOf('otra_plataforma')>=0?' — falta la columna otra_plataforma en la base':''), true); return; }
  });
  closeModal('m-comp-buyer');

  if (esDefensa) {
    toast('🛡 DEFENSA registrada — ' + (comPct===0.5 ? 'SOCIO (0.5%)' : 'NO SOCIO (1%)'));
  } else {
    toast('Comprador asignado ✓');
  }
}

// ════════════════════════════════════════
//  ADMIN MODULE
// ════════════════════════════════════════
var admLotes=[], admRemateId=null;

var admRematesTC = {};
// Guarda en la base el tipo de cambio editado del remate seleccionado