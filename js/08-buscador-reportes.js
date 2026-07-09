/* ═══════════════════════════════════════════════
   AGACON — 08-buscador-reportes.js
   Buscador por persona y Excel individual (estado de cuenta)
   ═══════════════════════════════════════════════ */
// ── Admin filter by comprador/vendedor nombre o CI con autocomplete ──
var admFilterText = '';
var admFilterCI   = '';

function admBuildSuggestions(query) {
  var sug = document.getElementById('adm-suggestions');
  if (!sug) return;
  var queryTrimmed = (query||'').trim();
  if (!queryTrimmed || queryTrimmed.length < 2) { sug.style.display='none'; return; }
  if (!admLotes.length) {
    var inp2 = document.getElementById('adm-filter-comp');
    var rect2 = inp2 ? inp2.getBoundingClientRect() : null;
    if (rect2) { sug.style.top=(rect2.bottom+4)+'px'; sug.style.left=rect2.left+'px'; sug.style.width=Math.max(rect2.width,320)+'px'; }
    sug.innerHTML = '<div style="padding:.7rem 1rem;color:var(--muted);font-size:.85rem;">⚠ Primero seleccioná un remate</div>';
    sug.style.display = 'block';
    return;
  }
  // Normalizar: quitar acentos y pasar a mayusculas para comparacion robusta
  function normQ(str) {
    return String(str||'').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ').trim();
  }
  var q = normQ(queryTrimmed);
  if (!q || q.length < 2) { sug.style.display='none'; return; }

  // Recopilar personas fusionando por similitud de nombre o CI
  var personasMap = {};

  function palabrasComunes(a, b) {
    var pa = a.split(' ').filter(function(w){ return w.length > 2; });
    var pb = b.split(' ').filter(function(w){ return w.length > 2; });
    return pa.filter(function(w){ return pb.indexOf(w) >= 0; }).length;
  }

  function buscarPersonaExistente(normNom, ciNum) {
    var keys = Object.keys(personasMap);
    for (var i=0; i<keys.length; i++) {
      var p = personasMap[keys[i]];
      // Mismo CI numérico
      if (ciNum && p.ciNum && ciNum === p.ciNum) return keys[i];
      // Nombre muy similar (2+ palabras en común)
      if (palabrasComunes(normNom, p.normNombre) >= 2) return keys[i];
    }
    return null;
  }

  admLotes.forEach(function(l) {
    // Como COMPRADOR
    if (l.comprador && l.comprador.trim()) {
      var ci    = (l.compradorCI||'').trim();
      var ciNum = ci.replace(/[^0-9]/g,'');
      var nom   = l.comprador.trim();
      var norm  = normQ(nom);
      var found = buscarPersonaExistente(norm, ciNum);
      if (found) {
        // Fusionar: si el encontrado no tiene CI y este sí, actualizar
        if (ciNum && !personasMap[found].ciNum) {
          personasMap[found].ci    = ci;
          personasMap[found].ciNum = ciNum;
          personasMap[found].nombre = nom; // nombre con CI es más confiable
        }
        if (personasMap[found].roles.indexOf('comprador')<0) personasMap[found].roles.push('comprador');
      } else {
        var k = norm + '||' + ciNum;
        personasMap[k] = {nombre: nom, ci: ci, ciNum: ciNum, roles: ['comprador'], normNombre: norm};
      }
    }
    // Como PROPIETARIO/VENDEDOR o DEFENSA
    if (l.propietario && l.propietario.trim()) {
      var nom2  = l.propietario.trim();
      var norm2 = normQ(nom2);
      var rol   = lotEsDefensa(l) ? 'defensa' : 'vendedor';
      var found2 = buscarPersonaExistente(norm2, '');
      if (found2) {
        if (personasMap[found2].roles.indexOf(rol)<0) personasMap[found2].roles.push(rol);
      } else {
        var k2 = norm2 + '||PROP';
        personasMap[k2] = {nombre: nom2, ci: '', ciNum: '', roles: [rol], normNombre: norm2};
      }
    }
  });

  // Filtrar usando normalizacion
  var allPersonas = Object.values(personasMap);
  var matches = allPersonas.filter(function(p) {
    if (!q) return false;
    var matchNom = p.normNombre.includes(q);
    var ciClean  = p.ci.replace(/[^0-9]/g,'');
    var qClean   = q.replace(/[^0-9]/g,'');
    var matchCI  = ciClean && qClean && ciClean.includes(qClean);
    return matchNom || matchCI;
  }).slice(0, 10);

  if (!matches.length) { sug.style.display='none'; return; }

  // Position dropdown below the input
  var inp = document.getElementById('adm-filter-comp');
  if (inp) {
    var rect = inp.getBoundingClientRect();
    sug.style.top  = (rect.bottom + 4) + 'px';
    sug.style.left = rect.left + 'px';
    sug.style.width = Math.max(rect.width, 320) + 'px';
  }
  sug.innerHTML = '';
  matches.forEach(function(p) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:.55rem .9rem;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center;gap:.5rem;';
    var roleColors = {comprador:'#f39c12', vendedor:'#2ecc71', defensa:'#e67e22'};
    var roleLabels = p.roles.map(function(r){
      return '<span style="font-size:.6rem;padding:.1rem .35rem;border-radius:3px;background:'+roleColors[r]+';color:#000;font-weight:700;">'+r.toUpperCase()+'</span>';
    }).join(' ');
    div.innerHTML =
      '<div>'+
        '<div style="font-weight:600;font-size:.9rem;color:#fff">'+p.nombre+'</div>'+
        '<div style="font-size:.72rem;color:'+(p.ci?'var(--muted)':'#444')+'">'+(p.ci?'CI: '+p.ci:'Sin CI registrado')+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:.25rem;flex-wrap:wrap;flex-shrink:0;max-width:140px;justify-content:flex-end;">'+roleLabels+'</div>';
    div.onmouseenter = function(){ this.style.background='rgba(255,255,255,.08)'; };
    div.onmouseleave = function(){ this.style.background=''; };
    (function(persona){
      div.onclick = function() {
        document.getElementById('adm-filter-comp').value = persona.nombre;
        var ciEl = document.getElementById('adm-filter-ci');
        if (ciEl) ciEl.value = persona.ci || '';
        sug.style.display = 'none';
        admFilterText = persona.nombre.toUpperCase();
        admFilterCI   = (persona.ci||'').replace(/[^0-9]/g,'');
        admApplyFilter();
      };
    })(p);
    sug.appendChild(div);
  });
  sug.style.display = 'block';
}

function admApplyFilter() {
  var info = document.getElementById('adm-filter-info');
  var btn  = document.getElementById('btn-export-single');
  var hasFilter = admFilterText || admFilterCI;
  if (hasFilter) {
    var matches = admGetFilteredLotes();
    var asComp = matches.filter(function(l){ return admFilterText && (l.comprador||'').toUpperCase().includes(admFilterText); }).length;
    var asProp = matches.filter(function(l){ return admFilterText && (l.propietario||'').toUpperCase().includes(admFilterText); }).length;
    var parts = [];
    if (asComp) parts.push(asComp+' como comprador');
    if (asProp) parts.push(asProp+' como vendedor/defensa');
    info.textContent = matches.length + ' lote(s)' + (parts.length?' ('+parts.join(', ')+')':'');
    info.style.color = matches.length ? 'var(--green)' : 'var(--red)';
    btn.style.display = matches.length ? 'inline-flex' : 'none';
  } else {
    info.textContent = '';
    btn.style.display = 'none';
  }
  admRecalc();
}

function admFilterChanged() {
  admFilterText = (document.getElementById('adm-filter-comp').value||'').trim().toUpperCase();
  var ciEl = document.getElementById('adm-filter-ci');
  admFilterCI = ciEl ? ciEl.value.trim().replace(/[^0-9]/g,'') : '';
  var inputVal = (document.getElementById('adm-filter-comp').value||'').trim();
  admBuildSuggestions(inputVal);
  admApplyFilter();
}

function admClearFilter() {
  document.getElementById('adm-filter-comp').value = '';
  var ciEl = document.getElementById('adm-filter-ci');
  if (ciEl) ciEl.value = '';
  admFilterText = '';
  admFilterCI   = '';
  var sug = document.getElementById('adm-suggestions');
  if (sug) sug.style.display = 'none';
  document.getElementById('adm-filter-info').textContent = '';
  document.getElementById('btn-export-single').style.display = 'none';
  admRecalc();
}

// Close suggestions when clicking outside
document.addEventListener('click', function(e) {
  var sug = document.getElementById('adm-suggestions');
  var inp = document.getElementById('adm-filter-comp');
  if (sug && inp && !inp.contains(e.target) && !sug.contains(e.target)) {
    sug.style.display = 'none';
  }
});

function normForFilter(str) {
  return String(str||'').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s+/g,' ').trim();
}

function nombresSimilares(a, b) {
  // True si comparten 2+ palabras de mas de 2 letras
  var pa = normForFilter(a).split(' ').filter(function(w){ return w.length > 2; });
  var pb = normForFilter(b).split(' ').filter(function(w){ return w.length > 2; });
  return pa.filter(function(w){ return pb.indexOf(w) >= 0; }).length >= 2;
}

function admGetFilteredLotes() {
  if (!admFilterText && !admFilterCI) return admLotes;

  // Extraer palabras clave del nombre buscado (mas de 2 letras)
  var palabrasBuscadas = normForFilter(admFilterText).split(' ').filter(function(w){ return w.length > 2; });

  function propietarioMatcheaPersona(lote) {
    // Si el lote tiene CI de propietario y buscamos con CI: se decide SOLO por CI.
    // Un CI distinto = OTRA persona, aunque el nombre se parezca (hermanos, etc.)
    if (admFilterCI && lote.ciPropietario) {
      var ciPropNum = lote.ciPropietario.replace(/[^0-9]/g,'');
      if (ciPropNum && ciPropNum.length >= 6) return ciPropNum === admFilterCI;
    }
    // Fallback por nombre SOLO si el lote no tiene CI de propietario:
    // un nombre debe CONTENER completamente al otro (2+ palabras)
    if (!lote.propietario) return false;
    var normProp = normForFilter(lote.propietario).split(' ').filter(function(w){ return w.length > 2; });
    if (normProp.length<2 || palabrasBuscadas.length<2) return false;
    var aEnB = palabrasBuscadas.every(function(w){ return normProp.indexOf(w) >= 0; });
    var bEnA = normProp.every(function(w){ return palabrasBuscadas.indexOf(w) >= 0; });
    return aEnB || bEnA;
  }

  return admLotes.filter(function(l){
    var ciLote = (l.compradorCI||'').replace(/[^0-9]/g,'');

    if (admFilterText && admFilterCI) {
      // Vino del dropdown con nombre+CI
      // Comprador: CI exacto
      var matchComp = ciLote === admFilterCI;
      // Propietario/defensa: CI exacto o similitud de nombre
      var matchProp = propietarioMatcheaPersona(l);
      return matchComp || matchProp;
    } else if (admFilterCI) {
      return ciLote === admFilterCI;
    } else {
      return (l.comprador||'').toUpperCase().includes(admFilterText) ||
             (l.propietario||'').toUpperCase().includes(admFilterText);
    }
  });
}

async function admExportSingle() {
  var lotesFiltrados = admGetFilteredLotes();
  if (!lotesFiltrados.length) { toast('No hay lotes para esta persona', true); return; }
  var tc     = parseFloat(document.getElementById('adm-tc').value)||6.96;
  var comPct = parseFloat(document.getElementById('adm-com').value)||3;
  var bank   = getBankData();
  var fecha  = admFechaRemate();
  var selEl  = document.getElementById('adm-remate-sel');
  var selTxt = selEl.options[selEl.selectedIndex] ? selEl.options[selEl.selectedIndex].text : '';
  var remateNumeroSingle = (function(){ var m=selTxt.match(/N[°º]?\s*(\d+)/i); return m?m[1]:selTxt.replace(/ *[(][^)]+[)]$/,'').trim(); })();

  // Identificar la persona buscada — usar el texto del buscador como fuente de verdad
  // El nombre buscado determina quién es la persona, no el primer lote encontrado
  var personaNombre, personaCI;
  var queryNombre = admFilterText; // ya está en UPPERCASE

  // Buscar el nombre exacto/mejor match entre compradores y propietarios
  var matchComoComp = admLotes.find(function(l){
    return l.comprador && l.comprador.toUpperCase().includes(queryNombre);
  });
  var matchComoProp = admLotes.find(function(l){
    return l.propietario && l.propietario.toUpperCase().includes(queryNombre);
  });

  if (queryNombre) {
    // Preferir el nombre tal como aparece en los datos (capitalización original)
    if (matchComoComp && matchComoComp.comprador.toUpperCase() === queryNombre) {
      personaNombre = matchComoComp.comprador;
      personaCI     = matchComoComp.compradorCI || admFilterCI;
    } else if (matchComoProp && matchComoProp.propietario.toUpperCase() === queryNombre) {
      personaNombre = matchComoProp.propietario;
      personaCI     = admFilterCI;
    } else if (matchComoComp) {
      personaNombre = matchComoComp.comprador;
      personaCI     = matchComoComp.compradorCI || admFilterCI;
    } else if (matchComoProp) {
      personaNombre = matchComoProp.propietario;
      personaCI     = admFilterCI;
    } else {
      personaNombre = admFilterText;
      personaCI     = admFilterCI;
    }
  } else {
    // Si solo hay CI, buscar por CI
    var matchCI = admLotes.find(function(l){
      return l.compradorCI && l.compradorCI.replace(/[^0-9]/g,'').includes(admFilterCI);
    });
    personaNombre = matchCI ? matchCI.comprador : admFilterText;
    personaCI     = matchCI ? matchCI.compradorCI : admFilterCI;
  }

  var nombreUpper = personaNombre.toUpperCase();

  // ── Definir el emparejamiento por persona ANTES de usarlo ──
  // Se empareja por CI (si está) y, si no, por nombre: un nombre debe CONTENER al otro (2+ palabras).
  // Así "JEAN PAUL TORO" ⊂ "JEAN PAUL TORO LEDEZMA" empareja (misma persona), pero
  // "...HAGE DANIEL" vs "...HAGE FRANK WILLIAM" NO (hermanos con nombres propios distintos).
  var personaCINum = (personaCI || admFilterCI || '').replace(/[^0-9]/g,'');
  var palabrasPersona = normForFilter(personaNombre||'').split(' ').filter(function(w){ return w.length>2; });
  function nombreContiene(a, b){ return a.length>=2 && a.every(function(w){ return b.indexOf(w)>=0; }); }
  function matchNombre(palabras){
    if(!palabras.length || !palabrasPersona.length) return false;
    return nombreContiene(palabras, palabrasPersona) || nombreContiene(palabrasPersona, palabras);
  }
  function esPropietarioPersona(l){
    if (personaCINum && personaCINum.length>=6 && l.ciPropietario){
      var pc = String(l.ciPropietario).replace(/[^0-9]/g,'');
      if (pc && pc.length>=6) return pc===personaCINum; // ambos con CI: solo CI decide
    }
    return matchNombre(normForFilter(l.propietario||'').split(' ').filter(function(w){ return w.length>2; }));
  }
  function esCompradorPersona(l){
    if(!l.comprador) return false;
    if (personaCINum && personaCINum.length>=6 && l.compradorCI){
      var cc = String(l.compradorCI).replace(/[^0-9]/g,'');
      if (cc && cc.length>=6) return cc===personaCINum;
    }
    return matchNombre(normForFilter(l.comprador||'').split(' ').filter(function(w){ return w.length>2; }));
  }

  // Compras: la persona es el COMPRADOR del lote
  var lotesCompras = admLotes.filter(function(l){ return !lotEsDefensa(l) && esCompradorPersona(l); });
  // Ventas: la persona es el PROPIETARIO y no es defensa
  var lotesVentas = admLotes.filter(function(l){ return !lotEsDefensa(l) && esPropietarioPersona(l); });
  // Defensas: la persona es el PROPIETARIO y es defensa
  var lotesDefensas = admLotes.filter(function(l){ return lotEsDefensa(l) && esPropietarioPersona(l); });
  // Resolver comisión de cada defensa: socio → 0.5%; si no está en la lista → preguntar (una vez por persona).
  // Si se resuelve por primera vez, se guarda en la base para no volver a preguntar.
  var defensaCache = {};
  lotesDefensas.forEach(function(l){
    var yaGuardada = (l.defensaCom != null);
    var pct = resolveDefensaPct(l, defensaCache);
    l.esDefensa = true; l.defensaCom = pct;
    if(!yaGuardada) admPersistDefensa(l, pct);
  });

  toast('Generando Excel para ' + personaNombre + '...');

  try {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'AGACON';
    var yr = fecha.split('/')[2] || new Date().getFullYear();
    var YELLOW='FFFFCC', TOTBG='D9D9D9', HDRBG='D9E1F2', GRANDBG='BDD7EE';

    function border() { var s={style:'thin',color:{argb:'FFAAAAAA'}}; return {top:s,bottom:s,left:s,right:s}; }
    function hdrFill(c) { return {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+c}}; }
    function setW(ws) { ws.columns=[{width:5},{width:30},{width:12},{width:10},{width:10},{width:10},{width:14},{width:14},{width:15},{width:9},{width:16}]; }

    function writePersonaTitulo(ws, seccion) {
      ws.getRow(1).getCell(1).value = 'AGACON — REMATE N° '+remateNumeroSingle+' — FECHA: '+fecha;
      ws.getRow(1).getCell(1).font = {name:'Calibri',bold:true,size:12};
      ws.getRow(2).getCell(1).value = 'PERSONA: '+personaNombre.toUpperCase()+(personaCI?' — CI: '+personaCI:'');
      ws.getRow(2).getCell(1).font = {name:'Calibri',bold:true,size:12,color:{argb:'FF1F4E79'}};
      ws.getRow(3).getCell(1).value = seccion;
      ws.getRow(3).getCell(1).font = {name:'Calibri',bold:true,size:11};
      ws.getRow(4).height = 6;
      // Headers row 5
      var cols = seccion==='COMPRAS'
        ? ['N°','PROPIETARIO','CATEGORÍA','LOTE','CANT.','P/U','MONTO','COM '+comPct+'%','LIQ. A PAGAR $us','T/C','LIQ. A PAGAR Bs.']
        : seccion==='VENTAS'
        ? ['N°','COMPRADOR','CATEGORÍA','LOTE','CANT.','P/U','MONTO','COM '+comPct+'%','LIQ. A COBRAR $us','T/C','LIQ. A COBRAR Bs.']
        : ['N°','CATEGORÍA','LOTE','CANT.','P/U','MONTO','COM %','TOTAL COM. $us','TOTAL COM. Bs.','',''];
      var hr=ws.getRow(5); hr.height=28;
      cols.forEach(function(h,i){
        var c=hr.getCell(i+1); c.value=h;
        c.font={name:'Calibri',bold:true,size:10}; c.fill=hdrFill(HDRBG);
        c.border=border(); c.alignment={horizontal:'center',vertical:'middle',wrapText:true};
      });
      ws.views=[{state:'frozen',ySplit:5}];
    }

    function writeDataRow(ws, rowN, cells) {
      var r=ws.getRow(rowN); r.height=17;
      cells.forEach(function(v,i){
        var c=r.getCell(i+1);
        if(v!==null && typeof v==='object' && v.formula) c.value=v; else c.value=v;
        c.font={name:'Calibri',size:10}; c.border=border();
        if(i>=4) { c.numFmt='#,##0.00'; c.alignment={horizontal:'right',vertical:'middle'}; }
        else { c.alignment={horizontal:i===1?'left':'center',vertical:'middle'}; }
      });
    }

    function writeTotRow(ws, rowN, nCols, startR, endR, tcVal) {
      var r=ws.getRow(rowN); r.height=20;
      for(var i=1;i<=nCols;i++){
        var c=r.getCell(i); c.border=border();
        c.font={name:'Calibri',bold:true,size:11}; c.fill=hdrFill(GRANDBG);
        c.alignment={horizontal:'right',vertical:'middle'};
      }
      r.getCell(1).value='TOTALES'; r.getCell(1).alignment={horizontal:'left',vertical:'middle'};
      r.getCell(5).value={formula:'SUM(E'+startR+':E'+endR+')'}; r.getCell(5).numFmt='#,##0';
      r.getCell(7).value={formula:'SUM(G'+startR+':G'+endR+')'}; r.getCell(7).numFmt='#,##0.00';
      r.getCell(8).value={formula:'SUM(H'+startR+':H'+endR+')'}; r.getCell(8).numFmt='#,##0.00';
      r.getCell(9).value={formula:'SUM(I'+startR+':I'+endR+')'}; r.getCell(9).numFmt='#,##0.00'; r.getCell(9).fill=hdrFill(YELLOW);
      if(tcVal){ r.getCell(10).value=tcVal; r.getCell(10).numFmt='0.00'; }
      r.getCell(11).value={formula:'SUM(K'+startR+':K'+endR+')'}; r.getCell(11).numFmt='#,##0.00';
    }

    // ── HOJA COMPRAS ──
    // Funcion reutilizable para escribir datos bancarios en cualquier hoja
    function writeBankToSheet(ws, startRow) {
      if (!bank.tipo && !bank.cuenta && !bank.titular1) return;
      var r = startRow + 2;
      ws.mergeCells(r,1,r,11);
      ws.getRow(r).getCell(1).value = bank.tipo||'';
      ws.getRow(r).getCell(1).font = {name:'Calibri',bold:true,size:11};
      r++;
      if (bank.cuenta) {
        ws.mergeCells(r,1,r,11);
        ws.getRow(r).getCell(1).value = bank.cuenta;
        ws.getRow(r).getCell(1).font = {name:'Calibri',bold:true,size:11,color:{argb:'FFC00000'}};
        r++;
      }
      if (bank.titular1) {
        ws.mergeCells(r,1,r,11);
        ws.getRow(r).getCell(1).value = bank.titular1 + (bank.ci1 ? '    CI. '+bank.ci1 : '');
        ws.getRow(r).getCell(1).font = {name:'Calibri',size:10};
        r++;
      }
      if (bank.titular2 && bank.titular2.trim()) {
        ws.mergeCells(r,1,r,11);
        ws.getRow(r).getCell(1).value = bank.titular2 + (bank.ci2 ? '    CI. '+bank.ci2 : '');
        ws.getRow(r).getCell(1).font = {name:'Calibri',size:10};
      }
    }

    // ── HOJA COMPRAS ──
    var totalCompra = 0;
    if (lotesCompras.length) {
      var wsC = wb.addWorksheet('COMPRAS'); setW(wsC);
      writePersonaTitulo(wsC, 'COMPRAS');
      var row=6, start=6, n=1;
      lotesCompras.forEach(function(l){
        var monto=(l.precio||0)*(l.cantidad||0), com=monto*comPct/100, liq=monto+com;
        totalCompra+=liq;
        writeDataRow(wsC, row, [n, l.propietario||'—', l.categoria||'', l.lote, l.cantidad, l.precio||0, monto, com, liq, tc, liq*tc]);
        row++; n++;
      });
      writeTotRow(wsC, row, 11, start, row-1, tc);
      writeBankToSheet(wsC, row);
    }

    // ── HOJA VENTAS ──
    var totalVenta = 0;
    if (lotesVentas.length) {
      var wsV = wb.addWorksheet('VENTAS'); setW(wsV);
      writePersonaTitulo(wsV, 'VENTAS');
      var row=6, start=6, n=1;
      lotesVentas.forEach(function(l){
        var monto=(l.precio||0)*(l.cantidad||0), com=monto*comPct/100, liq=monto-com;
        totalVenta+=liq;
        writeDataRow(wsV, row, [n, l.comprador||'SIN COMPRADOR', l.categoria||'', l.lote, l.cantidad, l.precio||0, monto, com, liq, tc, liq*tc]);
        row++; n++;
      });
      writeTotRow(wsV, row, 11, start, row-1, tc);
      writeBankToSheet(wsV, row);
    }

    // ── HOJA DEFENSAS ──
    var totalDefCom = 0;
    if (lotesDefensas.length) {
      var wsD = wb.addWorksheet('DEFENSAS'); setW(wsD);
      writePersonaTitulo(wsD, 'DEFENSAS');
      var row=6, n=1;
      lotesDefensas.forEach(function(l){
        var monto=(l.precio||0)*(l.cantidad||0), pct=l.defensaCom||0.5, com=monto*pct/100;
        totalDefCom+=com;
        var r=wsD.getRow(row); r.height=17;
        [n, l.categoria||'', l.lote, l.cantidad, l.precio||0, monto, pct+'%', com, com*tc].forEach(function(v,i){
          var c=r.getCell(i+1); c.value=v; c.font={name:'Calibri',size:10}; c.border=border();
          if(i>=5){c.numFmt='#,##0.00';c.alignment={horizontal:'right',vertical:'middle'};}
          else{c.alignment={horizontal:i===1?'left':'center',vertical:'middle'};}
        });
        row++; n++;
      });
      // Fila de TOTALES de la hoja DEFENSAS (suma de comisiones $us y Bs.)
      var endDef = row - 1;
      var rtD = wsD.getRow(row); rtD.height=20;
      for (var cD=1; cD<=9; cD++){
        var ccD=rtD.getCell(cD); ccD.border=border();
        ccD.font={name:'Calibri',bold:true,size:11}; ccD.fill=hdrFill(GRANDBG);
        ccD.alignment={horizontal:'right',vertical:'middle'};
      }
      wsD.mergeCells(row,1,row,3);
      rtD.getCell(1).value='TOTALES'; rtD.getCell(1).alignment={horizontal:'left',vertical:'middle'};
      rtD.getCell(4).value={formula:'SUM(D6:D'+endDef+')'}; rtD.getCell(4).numFmt='#,##0';
      rtD.getCell(6).value={formula:'SUM(F6:F'+endDef+')'}; rtD.getCell(6).numFmt='#,##0.00';
      rtD.getCell(8).value={formula:'SUM(H6:H'+endDef+')'}; rtD.getCell(8).numFmt='#,##0.00';
      rtD.getCell(9).value={formula:'SUM(I6:I'+endDef+')'}; rtD.getCell(9).numFmt='#,##0.00'; rtD.getCell(9).fill=hdrFill(YELLOW);
      row++;
      writeBankToSheet(wsD, row);
    }

    // ── HOJA ESTADO DE CUENTA ──
    var wsEC = wb.addWorksheet('ESTADO DE CUENTA');
    wsEC.columns=[{width:30},{width:20},{width:20}];
    var ecR=1;
    function ecLine(rowN, label, usd, bold, bg) {
      var r=wsEC.getRow(rowN); r.height=18;
      [1,2,3].forEach(function(i){
        var c=r.getCell(i); c.border=border(); c.font={name:'Calibri',bold:!!bold,size:11};
        if(bg) c.fill=hdrFill(bg);
      });
      r.getCell(1).value=label; r.getCell(1).alignment={horizontal:'left',vertical:'middle'};
      if(usd!==undefined){
        r.getCell(2).value=Math.round(usd*100)/100; r.getCell(2).numFmt='#,##0.00'; r.getCell(2).alignment={horizontal:'right',vertical:'middle'};
        r.getCell(3).value=Math.round(usd*tc*100)/100; r.getCell(3).numFmt='#,##0.00'; r.getCell(3).alignment={horizontal:'right',vertical:'middle'};
      }
    }
    function ecHdrLine(rowN, title, bg) {
      var r=wsEC.getRow(rowN); r.height=20;
      wsEC.mergeCells(rowN,1,rowN,3);
      var c=r.getCell(1); c.value=title; c.font={name:'Calibri',bold:true,size:12,color:{argb:'FFFFFFFF'}};
      c.fill=hdrFill(bg||'1F4E79'); c.border=border(); c.alignment={horizontal:'left',vertical:'middle'};
    }

    // Estado de cuenta con detalle por lote
    wsEC.columns=[{width:5},{width:30},{width:14},{width:8},{width:10},{width:14},{width:14},{width:15},{width:15}];

    function ecSectionHdr(rowN, title, bg) {
      var r=wsEC.getRow(rowN); r.height=20;
      wsEC.mergeCells(rowN,1,rowN,9);
      var c=r.getCell(1); c.value=title;
      c.font={name:'Calibri',bold:true,size:11,color:{argb:'FFFFFFFF'}};
      c.fill=hdrFill(bg||'1F4E79'); c.border=border();
      c.alignment={horizontal:'left',vertical:'middle'};
    }
    function ecColHdr(rowN, cols) {
      var r=wsEC.getRow(rowN); r.height=16;
      cols.forEach(function(h,i){
        var c=r.getCell(i+1); c.value=h;
        c.font={name:'Calibri',bold:true,size:9}; c.fill=hdrFill(HDRBG);
        c.border=border(); c.alignment={horizontal:i<=1?'left':'center',vertical:'middle',wrapText:true};
      });
    }
    function ecLoteRow(rowN, cells, bg) {
      var r=wsEC.getRow(rowN); r.height=15;
      cells.forEach(function(v,i){
        var c=r.getCell(i+1); c.value=v; c.font={name:'Calibri',size:10};
        c.border=border(); if(bg) c.fill=hdrFill(bg);
        if(i>=4){c.numFmt='#,##0.00';c.alignment={horizontal:'right',vertical:'middle'};}
        else{c.alignment={horizontal:i<=1?'left':'center',vertical:'middle'};}
      });
    }
    function ecSubtotalRow(rowN, label, usd, bg) {
      var r=wsEC.getRow(rowN); r.height=16;
      wsEC.mergeCells(rowN,1,rowN,6);
      var cl=r.getCell(1); cl.value=label;
      cl.font={name:'Calibri',bold:true,size:10}; cl.fill=hdrFill(bg||TOTBG);
      cl.border=border(); cl.alignment={horizontal:'right',vertical:'middle'};
      [7,8,9].forEach(function(ci){
        var c=r.getCell(ci); c.fill=hdrFill(bg||TOTBG); c.border=border();
        c.font={name:'Calibri',bold:true,size:10}; c.numFmt='#,##0.00';
        c.alignment={horizontal:'right',vertical:'middle'};
      });
      r.getCell(8).value=Math.round(usd*100)/100;
      r.getCell(9).value=Math.round(usd*tc*100)/100;
    }

    // Título persona
    ecHdrLine(ecR, 'ESTADO DE CUENTA — '+personaNombre.toUpperCase()+(personaCI?' (CI: '+personaCI+')':''), '1F4E79'); ecR++;
    var rt=wsEC.getRow(ecR); rt.getCell(1).value='Remate N° '+remateNumeroSingle+' — Fecha: '+fecha;
    rt.getCell(1).font={name:'Calibri',bold:true,size:11}; wsEC.mergeCells(ecR,1,ecR,9); ecR+=2;

    // ── COMPRAS detalle ──
    if(lotesCompras.length){
      ecSectionHdr(ecR,'🛒  COMPRAS — lo que debe pagar','2E75B6'); ecR++;
      ecColHdr(ecR,['N°','PROPIETARIO','CATEGORÍA','LOTE','CANT.','P/U $us','MONTO $us','LIQ. PAGAR $us','LIQ. PAGAR Bs.']); ecR++;
      lotesCompras.forEach(function(l,i){
        var m=(l.precio||0)*(l.cantidad||0),c=m*comPct/100,liq=m+c;
        ecLoteRow(ecR,[i+1,l.propietario||'—',l.categoria||'',l.lote,l.cantidad,l.precio||0,m,liq,liq*tc],'FFFFFF');
        ecR++;
      });
      ecSubtotalRow(ecR,'SUBTOTAL COMPRAS (a pagar)',totalCompra,'BDD7EE'); ecR+=2;
    }

    // ── VENTAS detalle ──
    if(lotesVentas.length){
      ecSectionHdr(ecR,'🏷  VENTAS — lo que debe cobrar','375623'); ecR++;
      ecColHdr(ecR,['N°','COMPRADOR','CATEGORÍA','LOTE','CANT.','P/U $us','MONTO $us','LIQ. COBRAR $us','LIQ. COBRAR Bs.']); ecR++;
      lotesVentas.forEach(function(l,i){
        var m=(l.precio||0)*(l.cantidad||0),c=m*comPct/100,liq=m-c;
        ecLoteRow(ecR,[i+1,l.comprador||'SIN COMPRADOR',l.categoria||'',l.lote,l.cantidad,l.precio||0,m,liq,liq*tc],'FFFFFF');
        ecR++;
      });
      ecSubtotalRow(ecR,'SUBTOTAL VENTAS (a cobrar)',totalVenta,'E2EFDA'); ecR+=2;
    }

    // ── DEFENSAS detalle ──
    if(lotesDefensas.length){
      ecSectionHdr(ecR,'🛡  DEFENSAS — propios animales (solo comisión)','C55A11'); ecR++;
      ecColHdr(ecR,['N°','CATEGORÍA','RAZA','LOTE','CANT.','P/U $us','MONTO $us','COM. $us','COM. Bs.']); ecR++;
      lotesDefensas.forEach(function(l,i){
        var m=(l.precio||0)*(l.cantidad||0),pct=l.defensaCom||0.5,com=m*pct/100;
        ecLoteRow(ecR,[i+1,l.categoria||'—',l.raza||'—',l.lote,l.cantidad,l.precio||0,m,com,com*tc],'FFFFFF');
        ecR++;
      });
      ecSubtotalRow(ecR,'SUBTOTAL DEFENSA (comisión a pagar)',totalDefCom,'FCE4D6'); ecR+=2;
    }

    // ── SALDO NETO ──
    var saldo=totalVenta-totalCompra-totalDefCom;
    var saldoPos=saldo>=0;
    wsEC.mergeCells(ecR,1,ecR,7);
    var rSaldo=wsEC.getRow(ecR); rSaldo.height=22;
    rSaldo.getCell(1).value=saldoPos?'✅  SALDO A FAVOR — le deben':'❌  SALDO A PAGAR — debe';
    rSaldo.getCell(1).font={name:'Calibri',bold:true,size:12};
    rSaldo.getCell(1).fill=hdrFill(saldoPos?'E2EFDA':'FCE4D6');
    rSaldo.getCell(1).border=border(); rSaldo.getCell(1).alignment={horizontal:'right',vertical:'middle'};
    [8,9].forEach(function(ci){
      var c=rSaldo.getCell(ci); c.fill=hdrFill(saldoPos?'E2EFDA':'FCE4D6');
      c.border=border(); c.font={name:'Calibri',bold:true,size:13};
      c.numFmt='#,##0.00'; c.alignment={horizontal:'right',vertical:'middle'};
    });
    rSaldo.getCell(8).value=Math.round(Math.abs(saldo)*100)/100;
    rSaldo.getCell(9).value=Math.round(Math.abs(saldo)*tc*100)/100;
    ecR+=2;

    // ── DATOS BANCARIOS ──
    if(bank.tipo||bank.cuenta||bank.titular1){
      ecSectionHdr(ecR,'DATOS BANCARIOS PARA TRANSFERENCIA','375623'); ecR++;
      var bankLines=[
        {t:bank.tipo, bold:false, color:'000000'},
        {t:bank.cuenta, bold:true, color:'C00000'},
        {t:bank.titular1+(bank.ci1?'    CI. '+bank.ci1:''), bold:false, color:'000000'},
        {t:bank.titular2+(bank.ci2?'    CI. '+bank.ci2:''), bold:false, color:'000000'}
      ];
      bankLines.forEach(function(l){
        if(!l.t||!l.t.trim()||l.t.trim()==='CI.') return;
        wsEC.mergeCells(ecR,1,ecR,9);
        var c=wsEC.getRow(ecR).getCell(1);
        c.value=l.t; c.font={name:'Calibri',bold:l.bold,size:11,color:{argb:'FF'+l.color}};
        c.border=border(); c.alignment={horizontal:'left',vertical:'middle'};
        ecR++;
      });
    }

    var buf = await wb.xlsx.writeBuffer();
    var blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href=url;
    a.download='AGACON_'+personaNombre.replace(/[^A-Za-z0-9]/g,'_').slice(0,25)+'_'+fecha.replace(/[/]/g,'-')+'.xlsx';
    a.click(); URL.revokeObjectURL(url);
    toast('Excel de '+personaNombre+' exportado ✓');
  } catch(err) {
    console.error(err);
    toast('Error: '+err.message, true);
  }
}

function admExportCSV(tipo) {
  var tc=parseFloat(document.getElementById('adm-tc').value)||6.96;
  var com=parseFloat(document.getElementById('adm-com').value)/100||0.03;
  var rows=tipo==='compradores'?
    [['COMPRADOR','CATEGORIA','LOTE','CANTIDAD','P/U','MONTO','COMISION','TOTAL']].concat(admLotes.map(function(l){var m=(l.precio||0)*(l.cantidad||0),c=m*com;return [l.comprador||'SIN COMPRADOR',l.categoria,l.lote,l.cantidad,l.precio||0,m,c.toFixed(2),(m+c).toFixed(2)];})):
    [['VENDEDOR','CATEGORIA','LOTE','CANTIDAD','P/U','MONTO','COMISION','TOTAL']].concat(admLotes.map(function(l){var m=(l.precio||0)*(l.cantidad||0),c=m*com;return [l.propietario||'—',l.categoria,l.lote,l.cantidad,l.precio||0,m,c.toFixed(2),(m-c).toFixed(2)];}));
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([rows.map(function(r){return r.join(',');}).join('\n')],{type:'text/csv'}));
  a.download='AGACON_'+tipo.toUpperCase()+'.csv';a.click();toast('CSV exportado');
}

// ════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════