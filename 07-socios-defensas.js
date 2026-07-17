/* ═══════════════════════════════════════════════
   AGACON — 06-exportacion-excel.js
   Exportación a Excel (completo y plataforma) e impresión
   ═══════════════════════════════════════════════ */
function getBankData() {
  return {
    tipo:     (document.getElementById('bank-tipo')||{}).value||'',
    cuenta:   (document.getElementById('bank-cuenta')||{}).value||'',
    nombre:   (document.getElementById('bank-nombre')||{}).value||'',
    titular1: (document.getElementById('bank-titular1')||{}).value||'',
    ci1:      (document.getElementById('bank-ci1')||{}).value||'',
    titular2: (document.getElementById('bank-titular2')||{}).value||'',
    ci2:      (document.getElementById('bank-ci2')||{}).value||'',
  };
}

// ── SheetJS cell helper ──
function mkcell(v, opts) {
  opts = opts || {};
  var t = typeof v === 'number' ? 'n' : 's';
  if (typeof v === 'string' && v[0] === '=') t = 'f';
  var c = {v: v, t: t};
  if (t === 'f') { c.f = v.slice(1); delete c.v; }
  var s = {};
  var border = {style:'thin', color:{rgb:'AAAAAA'}};
  s.border = {top:border, bottom:border, left:border, right:border};
  s.font   = {name:'Calibri', sz: opts.sz||10, bold:!!opts.bold, color:{rgb: opts.fontColor||'000000'}};
  s.alignment = {vertical:'center', horizontal: opts.align||'left', wrapText:!!opts.wrap};
  if (opts.fill) s.fill = {patternType:'solid', fgColor:{rgb: opts.fill}};
  if (opts.numFmt) c.z = opts.numFmt;
  c.s = s;
  return c;
}

function setCell(ws, r, c, v, opts) {
  var addr = XLSX.utils.encode_cell({r:r, c:c});
  ws[addr] = mkcell(v, opts);
  var ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : {s:{r:r,c:c},e:{r:r,c:c}};
  if (r < ref.s.r) ref.s.r = r;
  if (c < ref.s.c) ref.s.c = c;
  if (r > ref.e.r) ref.e.r = r;
  if (c > ref.e.c) ref.e.c = c;
  ws['!ref'] = XLSX.utils.encode_range(ref);
}

var YELLOW    = 'FFFFCC';
var TOTAL_BG  = 'D9D9D9';
var HDR_BG    = 'D9E1F2';
var GRAND_BG  = 'BDD7EE';
var GREEN_HDR = '1F4E79';
var NUM_FMT   = '#,##0.00';
var NUM_INT   = '#,##0';

function writeColWidths(ws, widths) {
  ws['!cols'] = widths.map(function(w){ return {wch:w}; });
}

function writeHeaders(ws, row, headers) {
  headers.forEach(function(h, i) {
    setCell(ws, row, i, h, {bold:true, fill:HDR_BG, align:'center', wrap:true, sz:10});
  });
}

function writeTitleBlock(ws, year, remateNum, fecha, seccion) {
  setCell(ws, 2, 0, 'REMATES/'+year, {bold:true, sz:11});
  setCell(ws, 3, 0, 'REMATE N° '+remateNum, {bold:true, sz:11});
  setCell(ws, 4, 0, 'FECHA: '+fecha, {bold:true, sz:11});
  setCell(ws, 5, 0, seccion, {bold:true, sz:12});
}

function writeTotalRow(ws, row, startRow, endRow, label, tc, fillBG) {
  var bg = fillBG || TOTAL_BG;
  setCell(ws, row, 0, label, {bold:true, fill:bg, sz:10});
  setCell(ws, row, 1, '', {fill:bg});
  setCell(ws, row, 2, '', {fill:bg});
  setCell(ws, row, 3, '', {fill:bg});
  setCell(ws, row, 4, '=SUM(E'+(startRow+1)+':E'+endRow+')', {bold:true, fill:bg, align:'right', numFmt:NUM_INT});
  setCell(ws, row, 5, '', {fill:bg});
  setCell(ws, row, 6, '=SUM(G'+(startRow+1)+':G'+endRow+')', {bold:true, fill:bg, align:'right', numFmt:NUM_FMT});
  setCell(ws, row, 7, '=SUM(H'+(startRow+1)+':H'+endRow+')', {bold:true, fill:bg, align:'right', numFmt:NUM_FMT});
  setCell(ws, row, 8, '=SUM(I'+(startRow+1)+':I'+endRow+')', {bold:true, fill:YELLOW, align:'right', numFmt:NUM_FMT});
  setCell(ws, row, 9, tc, {bold:true, fill:bg, align:'center', numFmt:'0.00'});
  setCell(ws, row, 10, '=SUM(K'+(startRow+1)+':K'+endRow+')', {bold:true, fill:bg, align:'right', numFmt:NUM_FMT});
}

function writeBankData(ws, row, bank) {
  if (!bank.tipo && !bank.cuenta && !bank.titular1) return;
  row++;
  if (bank.tipo) {
    setCell(ws, row++, 0, bank.tipo, {bold:true, sz:11});
  }
  if (bank.cuenta) {
    setCell(ws, row++, 0, bank.cuenta, {bold:true, sz:11, fontColor:'C00000'});
  }
  if (bank.titular1) {
    setCell(ws, row++, 0, bank.titular1+'    CI. '+bank.ci1, {bold:true, sz:11});
  }
  if (bank.titular2) {
    setCell(ws, row++, 0, bank.titular2+'    CI. '+bank.ci2, {bold:true, sz:11});
  }
}

function buildCompradores(lotes, tc, comPct, fecha, remateNum, bank) {
  var ws = {};
  var year = fecha.split('/')[2] || new Date().getFullYear();
  var COLS = [4,30,12,11,11,8.5,14.8,15,14.5,9.3,16];
  writeColWidths(ws, COLS);
  writeTitleBlock(ws, year, remateNum, fecha, 'COMPRADORES');
  writeHeaders(ws, 6, ['N°','COMPRADOR','CATEGORIA','LOTE','CANTIDAD','P/U','MONTO','COMISION '+comPct+'%','TOTAL MONTO EN $US','T/C '+tc,'TOTAL MONTO EN Bs.']);

  var byComp = {};
  lotes.forEach(function(l){ var k=l.comprador||'SIN COMPRADOR'; if(!byComp[k]) byComp[k]=[]; byComp[k].push(l); });

  var row = 7;
  var totalRefs = [];

  Object.keys(byComp).forEach(function(comp) {
    var rows = byComp[comp];
    var startRow = row;
    var n = 1;
    rows.forEach(function(l) {
      var r1 = row+1;
      setCell(ws, row, 0, n, {align:'center'});
      setCell(ws, row, 1, comp);
      setCell(ws, row, 2, l.categoria||'');
      setCell(ws, row, 3, l.lote||0, {align:'center'});
      setCell(ws, row, 4, l.cantidad||0, {align:'center', numFmt:NUM_INT});
      setCell(ws, row, 5, l.precio||0, {align:'right', numFmt:NUM_INT});
      setCell(ws, row, 6, '=E'+r1+'*F'+r1, {align:'right', numFmt:NUM_FMT});
      setCell(ws, row, 7, '=G'+r1+'*'+comPct+'%', {align:'right', numFmt:NUM_FMT});
      setCell(ws, row, 8, '=G'+r1+'+H'+r1, {bold:true, fill:YELLOW, align:'right', numFmt:NUM_FMT});
      setCell(ws, row, 9, tc, {align:'center', numFmt:'0.00'});
      setCell(ws, row, 10, '=I'+r1+'*J'+r1, {bold:true, align:'right', numFmt:NUM_FMT});
      row++; n++;
    });
    var endRow = row;
    totalRefs.push(row+1);
    writeTotalRow(ws, row, startRow, endRow, 'TOTALES', tc, TOTAL_BG);
    row++;
  });

  // Grand total
  var grandRow = row+1;
  setCell(ws, row, 0, 'TOTAL GENERAL', {bold:true, sz:11, fill:GRAND_BG});
  var sumE=totalRefs.map(function(r){return 'E'+r;}).join('+');
  var sumG=totalRefs.map(function(r){return 'G'+r;}).join('+');
  var sumH=totalRefs.map(function(r){return 'H'+r;}).join('+');
  var sumI=totalRefs.map(function(r){return 'I'+r;}).join('+');
  var sumK=totalRefs.map(function(r){return 'K'+r;}).join('+');
  [1,2,3].forEach(function(c){setCell(ws,row,c,'',{fill:GRAND_BG});});
  setCell(ws,row,4,'='+sumE,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_INT,sz:11});
  setCell(ws,row,5,'',{fill:GRAND_BG});
  setCell(ws,row,6,'='+sumG,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
  setCell(ws,row,7,'='+sumH,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
  setCell(ws,row,8,'='+sumI,{bold:true,fill:YELLOW,align:'right',numFmt:NUM_FMT,sz:11});
  setCell(ws,row,9,tc,{bold:true,fill:GRAND_BG,align:'center',numFmt:'0.00',sz:11});
  setCell(ws,row,10,'='+sumK,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
  row++;
  writeBankData(ws, row, bank);
  ws['!freeze'] = {xSplit:0, ySplit:7};
  return ws;
}

function buildVendedores(lotes, tc, comPct, fecha, remateNum, bank) {
  var ws = {};
  var year = fecha.split('/')[2] || new Date().getFullYear();
  writeColWidths(ws, [4,30,12,11,11,8.5,14.8,15,14.5,9.3,16]);
  writeTitleBlock(ws, year, remateNum, fecha, 'VENDEDOR');
  writeHeaders(ws, 6, ['N°','VENDEDORES','CATEGORIA','LOTE','CANTIDAD','P/U','MONTO','COMISION '+comPct+'%','TOTAL A PAGAR $us','T/C '+tc,'TOTAL A PAGAR Bs.']);

  var byVend = {};
  lotes.forEach(function(l){ var k=l.propietario||'SIN PROPIETARIO'; if(!byVend[k]) byVend[k]=[]; byVend[k].push(l); });

  var row = 7;
  var totalRefs = [];

  Object.keys(byVend).forEach(function(vend) {
    var rows = byVend[vend];
    var startRow = row;
    var n = 1;
    rows.forEach(function(l) {
      var r1 = row+1;
      setCell(ws,row,0,n,{align:'center'});
      setCell(ws,row,1,vend);
      setCell(ws,row,2,l.categoria||'');
      setCell(ws,row,3,l.lote||0,{align:'center'});
      setCell(ws,row,4,l.cantidad||0,{align:'center',numFmt:NUM_INT});
      setCell(ws,row,5,l.precio||0,{align:'right',numFmt:NUM_INT});
      setCell(ws,row,6,'=E'+r1+'*F'+r1,{align:'right',numFmt:NUM_FMT});
      setCell(ws,row,7,'=G'+r1+'*'+comPct+'%',{align:'right',numFmt:NUM_FMT});
      setCell(ws,row,8,'=G'+r1+'-H'+r1,{bold:true,fill:YELLOW,align:'right',numFmt:NUM_FMT});
      setCell(ws,row,9,tc,{align:'center',numFmt:'0.00'});
      setCell(ws,row,10,'=I'+r1+'*J'+r1,{bold:true,align:'right',numFmt:NUM_FMT});
      row++; n++;
    });
    var endRow = row;
    totalRefs.push(row+1);
    // TOTAL row vendedor
    setCell(ws,row,0,'TOTAL',{bold:true,fill:TOTAL_BG,sz:10});
    [1,2,3].forEach(function(c){setCell(ws,row,c,'',{fill:TOTAL_BG});});
    setCell(ws,row,4,'=SUM(E'+(startRow+1)+':E'+endRow+')',{bold:true,fill:TOTAL_BG,align:'right',numFmt:NUM_INT});
    setCell(ws,row,5,'',{fill:TOTAL_BG});
    setCell(ws,row,6,'=SUM(G'+(startRow+1)+':G'+endRow+')',{bold:true,fill:TOTAL_BG,align:'right',numFmt:NUM_FMT});
    setCell(ws,row,7,'=SUM(H'+(startRow+1)+':H'+endRow+')',{bold:true,fill:TOTAL_BG,align:'right',numFmt:NUM_FMT});
    setCell(ws,row,8,'=SUM(I'+(startRow+1)+':I'+endRow+')',{bold:true,fill:YELLOW,align:'right',numFmt:NUM_FMT});
    setCell(ws,row,9,tc,{bold:true,fill:TOTAL_BG,align:'center',numFmt:'0.00'});
    setCell(ws,row,10,'=SUM(K'+(startRow+1)+':K'+endRow+')',{bold:true,fill:TOTAL_BG,align:'right',numFmt:NUM_FMT});
    row++;
  });

  // Grand total
  setCell(ws,row,0,'TOTAL GENERAL',{bold:true,sz:11,fill:GRAND_BG});
  var sumE=totalRefs.map(function(r){return 'E'+r;}).join('+');
  var sumG=totalRefs.map(function(r){return 'G'+r;}).join('+');
  var sumH=totalRefs.map(function(r){return 'H'+r;}).join('+');
  var sumI=totalRefs.map(function(r){return 'I'+r;}).join('+');
  var sumK=totalRefs.map(function(r){return 'K'+r;}).join('+');
  [1,2,3].forEach(function(c){setCell(ws,row,c,'',{fill:GRAND_BG});});
  setCell(ws,row,4,'='+sumE,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_INT,sz:11});
  setCell(ws,row,5,'',{fill:GRAND_BG});
  setCell(ws,row,6,'='+sumG,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
  setCell(ws,row,7,'='+sumH,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
  setCell(ws,row,8,'='+sumI,{bold:true,fill:YELLOW,align:'right',numFmt:NUM_FMT,sz:11});
  setCell(ws,row,9,tc,{bold:true,fill:GRAND_BG,align:'center',numFmt:'0.00',sz:11});
  setCell(ws,row,10,'='+sumK,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
  row++;
  writeBankData(ws, row, bank);
  return ws;
}

function buildDefensas(lotes, tc, fecha, remateNum) {
  var ws = {};
  var year = fecha.split('/')[2] || new Date().getFullYear();
  writeColWidths(ws, [4,30,12,11,11,8.5,14.8,15,14.5,9.3,16]);
  writeTitleBlock(ws, year, remateNum, fecha, 'DEFENSAS');
  writeHeaders(ws, 6, ['N°','DEFENSAS','CATEGORIA','LOTE','CANTIDAD','P/U','MONTO','COMISION 0.5% - 1%','TOTAL A PAGAR $','T/C '+tc,'TOTAL A PAGAR Bs.']);

  var sinComp = lotes.filter(function(l){return !l.comprador;});
  var byDef = {};
  sinComp.forEach(function(l){ var k=l.propietario||'SIN PROPIETARIO'; if(!byDef[k]) byDef[k]=[]; byDef[k].push(l); });

  var row = 7;
  var totalRefs = [];
  var globalN = 1;

  Object.keys(byDef).forEach(function(prop) {
    var rows = byDef[prop];
    var startRow = row;
    rows.forEach(function(l) {
      var r1 = row+1;
      setCell(ws,row,0,globalN,{align:'center'});
      setCell(ws,row,1,prop);
      setCell(ws,row,2,l.categoria||'');
      setCell(ws,row,3,l.lote||0,{align:'center'});
      setCell(ws,row,4,l.cantidad||0,{align:'center',numFmt:NUM_INT});
      setCell(ws,row,5,l.precio||0,{align:'right',numFmt:NUM_INT});
      setCell(ws,row,6,'=E'+r1+'*F'+r1,{align:'right',numFmt:NUM_FMT});
      setCell(ws,row,7,'=G'+r1+'*'+((l.defensaCom!=null?l.defensaCom:0.5))+'%',{align:'right',numFmt:NUM_FMT});
      setCell(ws,row,8,'=H'+r1,{bold:true,fill:YELLOW,align:'right',numFmt:NUM_FMT});
      setCell(ws,row,9,tc,{align:'center',numFmt:'0.00'});
      setCell(ws,row,10,'=I'+r1+'*J'+r1,{bold:true,align:'right',numFmt:NUM_FMT});
      row++; globalN++;
    });
    var endRow = row;
    totalRefs.push(row+1);
    setCell(ws,row,0,'TOTAL',{bold:true,fill:TOTAL_BG});
    [1,2,3].forEach(function(c){setCell(ws,row,c,'',{fill:TOTAL_BG});});
    setCell(ws,row,4,'=SUM(E'+(startRow+1)+':E'+endRow+')',{bold:true,fill:TOTAL_BG,align:'right',numFmt:NUM_INT});
    setCell(ws,row,5,'',{fill:TOTAL_BG});
    setCell(ws,row,6,'=SUM(G'+(startRow+1)+':G'+endRow+')',{bold:true,fill:TOTAL_BG,align:'right',numFmt:NUM_FMT});
    setCell(ws,row,7,'=SUM(H'+(startRow+1)+':H'+endRow+')',{bold:true,fill:TOTAL_BG,align:'right',numFmt:NUM_FMT});
    setCell(ws,row,8,'=SUM(I'+(startRow+1)+':I'+endRow+')',{bold:true,fill:YELLOW,align:'right',numFmt:NUM_FMT});
    setCell(ws,row,9,tc,{bold:true,fill:TOTAL_BG,align:'center',numFmt:'0.00'});
    setCell(ws,row,10,'=SUM(K'+(startRow+1)+':K'+endRow+')',{bold:true,fill:TOTAL_BG,align:'right',numFmt:NUM_FMT});
    row++;
  });

  // Grand total
  setCell(ws,row,0,'TOTAL GENERAL',{bold:true,sz:11,fill:GRAND_BG});
  if (totalRefs.length) {
    var sumE=totalRefs.map(function(r){return 'E'+r;}).join('+');
    var sumG=totalRefs.map(function(r){return 'G'+r;}).join('+');
    var sumH=totalRefs.map(function(r){return 'H'+r;}).join('+');
    var sumI=totalRefs.map(function(r){return 'I'+r;}).join('+');
    var sumK=totalRefs.map(function(r){return 'K'+r;}).join('+');
    [1,2,3].forEach(function(c){setCell(ws,row,c,'',{fill:GRAND_BG});});
    setCell(ws,row,4,'='+sumE,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_INT,sz:11});
    setCell(ws,row,5,'',{fill:GRAND_BG});
    setCell(ws,row,6,'='+sumG,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
    setCell(ws,row,7,'='+sumH,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
    setCell(ws,row,8,'='+sumI,{bold:true,fill:YELLOW,align:'right',numFmt:NUM_FMT,sz:11});
    setCell(ws,row,9,tc,{bold:true,fill:GRAND_BG,align:'center',numFmt:'0.00',sz:11});
    setCell(ws,row,10,'='+sumK,{bold:true,fill:GRAND_BG,align:'right',numFmt:NUM_FMT,sz:11});
  }
  return ws;
}

function buildResumen(lotes, tc, comPct, fecha, remateNum) {
  var ws = {};
  ws['!cols'] = [{wch:35},{wch:22},{wch:15}];
  var year = fecha.split('/')[2] || new Date().getFullYear();
  var monto    = lotes.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var sinComp  = lotes.filter(function(l){return !l.comprador;});
  var dtM      = sinComp.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var cab      = lotes.reduce(function(a,l){return a+(l.cantidad||0);},0);
  var dtMSocio   = sinComp.filter(function(l){return (l.defensaCom!=null?l.defensaCom:0.5)<=0.5;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var dtMNoSocio = sinComp.filter(function(l){return (l.defensaCom!=null?l.defensaCom:0.5)>0.5;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var comDef   = dtMSocio*0.005 + dtMNoSocio*0.01;
  var comTotal = monto*comPct/100*2 + comDef;

  setCell(ws,0,0,'DETALLE DE EGRESOS E INGRESOS',{bold:true,sz:13});
  setCell(ws,1,0,'REMATE DE GANADO EN PIE',{bold:true,sz:12});
  setCell(ws,2,0,fecha,{bold:true,sz:12});
  setCell(ws,3,0,'INGRESOS Y EGRESOS',{bold:true,sz:11});

  var row = 5;
  function secHdr(t) {
    setCell(ws,row,0,t,{bold:true,sz:11,fill:GREEN_HDR,fontColor:'FFFFFF'});
    setCell(ws,row,1,'TOTAL $us',{bold:true,sz:10,fill:GREEN_HDR,fontColor:'FFFFFF',align:'right'});
    setCell(ws,row,2,'TOTAL Bs.',{bold:true,sz:10,fill:GREEN_HDR,fontColor:'FFFFFF',align:'right'});
    row++;
  }
  function item(label, usd, bold) {
    var bg = bold ? YELLOW : null;
    setCell(ws,row,0,label,{bold:!!bold,fill:bg});
    setCell(ws,row,1,usd,{bold:!!bold,fill:bg,align:'right',numFmt:NUM_FMT});
    setCell(ws,row,2,usd*tc,{bold:!!bold,fill:bg,align:'right',numFmt:NUM_FMT});
    row++;
  }

  secHdr('DETALLE DE INGRESOS');
  item('COMISION VENDEDORES '+comPct+'%', monto*comPct/100);
  item('COMISION COMPRADORES '+comPct+'%', monto*comPct/100);
  item('COMISION DEFENSAS SOCIO 0.5%', dtMSocio*0.005);
  item('COMISION DEFENSAS NO SOCIO 1%', dtMNoSocio*0.01);
  item('TOTAL INGRESOS', comTotal, true);
  row++;
  secHdr('ESTADISTICAS');
  item('Monto total operado $us', monto, true);
  item('Total lotes vendidos', lotes.length);
  item('Total cabezas', cab);
  item('Sin comprador (defensas)', sinComp.length);
  item('Tipo de cambio Bs./$us', tc);

  return ws;
}

function admFechaRemate(){
  var sel=document.getElementById('adm-remate-sel');
  var t=(sel&&sel.options[sel.selectedIndex])?sel.options[sel.selectedIndex].text:'';
  var m=t.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  return m ? (m[3]+'/'+m[2]+'/'+m[1]) : new Date().toLocaleDateString('es-BO',{day:'2-digit',month:'2-digit',year:'numeric'});
}

// Imprime el contenido de los Excel (todas sus hojas, cada una en su página).
// tipo: 'completo' (Compradores, Plataforma, Vendedores, Defensas, Resumen) | 'plataforma' (3%/2%/1%)
function admImprimirExcel(tipo) {
  if(!admLotes.length){ toast('No hay datos para imprimir', true); return; }
  var tc  = parseFloat(document.getElementById('adm-tc').value)||6.96;
  var com = (parseFloat(document.getElementById('adm-com').value)||3)/100;
  var comPct=(com*100);
  var selEl = document.getElementById('adm-remate-sel');
  var selTxt= selEl.options[selEl.selectedIndex] ? selEl.options[selEl.selectedIndex].text : 'Remate';
  var fecha = admFechaRemate();
  function money(n){ return '$'+(n||0).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function bs(n){ return 'Bs.'+(n||0).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  var defensas = admLotes.filter(function(l){return lotEsDefensa(l) || !l.comprador;});
  var normales = admLotes.filter(function(l){return !lotEsDefensa(l) && l.comprador;});
  var lotsPlat = normales.filter(function(l){return l.otraPlataforma;});
  var lotsComp = normales.filter(function(l){return !l.otraPlataforma;});

  function sheet(titulo, tablaHTML){
    return '<div class="sheet"><h2>'+esc(titulo)+'</h2>'+tablaHTML+'</div>';
  }
  function tbl(heads, bodyRows){
    return '<table><thead><tr>'+heads.map(function(h){return '<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>'+bodyRows+'</tbody></table>';
  }

  var hojas='';

  // ── Hoja PLATAFORMA (compartida por ambos tipos, con las 3 comisiones) ──
  function hojaPlataforma(pcts){
    if(!lotsPlat.length) return '<p class="empty">No hay compras mediante otra plataforma.</p>';
    var rows='', n=1, tM=0, tots={};
    pcts.forEach(function(p){tots[p]=0;});
    lotsPlat.forEach(function(l){
      var m=(l.precio||0)*(l.cantidad||0); tM+=m;
      var celdas='';
      pcts.forEach(function(p){ var c=m*p/100; tots[p]+=c; celdas+='<td class="r">'+money(c)+'</td>'; });
      rows+='<tr><td>'+n+'</td><td>'+esc(l.comprador)+(l.compradorCI?' <small>(CI: '+esc(l.compradorCI)+')</small>':'')+'</td><td>'+esc(l.categoria)+'</td><td>'+l.lote+'</td><td class="r">'+l.cantidad+'</td><td class="r">'+money(l.precio)+'</td><td class="r">'+money(m)+'</td>'+celdas+'</tr>';
      n++;
    });
    var totCeldas=''; pcts.forEach(function(p){ totCeldas+='<td class="r">'+money(tots[p])+'</td>'; });
    rows+='<tr class="tot"><td colspan="6">TOTALES</td><td class="r">'+money(tM)+'</td>'+totCeldas+'</tr>';
    return tbl(['N°','Comprador','Categoría','Lote','Cant.','P/U','Monto'].concat(pcts.map(function(p){return 'Com '+p+'%';})), rows);
  }

  if (tipo==='plataforma') {
    hojas += sheet('COMPRAS MEDIANTE OTRA PLATAFORMA — 3% total / 2% plataforma / 1% remate', hojaPlataforma([3,2,1]));
  } else {
    // ── COMPRADORES (3%, sin plataforma) ──
    var byComp={};
    lotsComp.forEach(function(l){ var k=(l.comprador||'SIN COMPRADOR').trim()+(l.compradorCI?' — CI: '+l.compradorCI:''); (byComp[k]=byComp[k]||[]).push(l); });
    var rowsC='', gM=0,gC=0,gT=0;
    Object.keys(byComp).forEach(function(k){
      var n=1, sM=0,sC=0,sT=0;
      byComp[k].forEach(function(l){
        var m=(l.precio||0)*(l.cantidad||0), c=m*com, t=m+c; sM+=m;sC+=c;sT+=t;
        rowsC+='<tr><td>'+n+'</td><td>'+esc(k)+'</td><td>'+esc(l.categoria)+'</td><td>'+l.lote+'</td><td class="r">'+l.cantidad+'</td><td class="r">'+money(l.precio)+'</td><td class="r">'+money(m)+'</td><td class="r">'+money(c)+'</td><td class="r">'+money(t)+'</td><td class="r">'+bs(t*tc)+'</td></tr>';
        n++;
      });
      gM+=sM;gC+=sC;gT+=sT;
      rowsC+='<tr class="sub"><td colspan="6">TOTAL — '+esc(k)+'</td><td class="r">'+money(sM)+'</td><td class="r">'+money(sC)+'</td><td class="r">'+money(sT)+'</td><td class="r">'+bs(sT*tc)+'</td></tr>';
    });
    rowsC+='<tr class="tot"><td colspan="6">TOTAL GENERAL</td><td class="r">'+money(gM)+'</td><td class="r">'+money(gC)+'</td><td class="r">'+money(gT)+'</td><td class="r">'+bs(gT*tc)+'</td></tr>';
    hojas += sheet('COMPRADORES — comisión '+comPct+'%', Object.keys(byComp).length?tbl(['N°','Comprador','Categoría','Lote','Cant.','P/U','Monto','Com '+comPct+'%','Total $us','Total Bs.'],rowsC):'<p class="empty">Sin compradores.</p>');

    // ── PLATAFORMA ──
    hojas += sheet('COMPRAS MEDIANTE OTRA PLATAFORMA — 3% / 2% / 1%', hojaPlataforma([3,2,1]));

    // ── VENDEDORES (3%) ──
    var byVend={};
    normales.forEach(function(l){ var k=l.propietario||'SIN PROPIETARIO'; (byVend[k]=byVend[k]||[]).push(l); });
    var rowsV='', gvM=0,gvC=0,gvT=0;
    Object.keys(byVend).forEach(function(k){
      var n=1,sM=0,sC=0,sT=0;
      byVend[k].forEach(function(l){
        var m=(l.precio||0)*(l.cantidad||0), c=m*com, t=m-c; sM+=m;sC+=c;sT+=t;
        rowsV+='<tr><td>'+n+'</td><td>'+esc(k)+'</td><td>'+esc(l.categoria)+'</td><td>'+l.lote+'</td><td class="r">'+l.cantidad+'</td><td class="r">'+money(l.precio)+'</td><td class="r">'+money(m)+'</td><td class="r">'+money(c)+'</td><td class="r">'+money(t)+'</td><td class="r">'+bs(t*tc)+'</td></tr>';
        n++;
      });
      gvM+=sM;gvC+=sC;gvT+=sT;
      rowsV+='<tr class="sub"><td colspan="6">TOTAL — '+esc(k)+'</td><td class="r">'+money(sM)+'</td><td class="r">'+money(sC)+'</td><td class="r">'+money(sT)+'</td><td class="r">'+bs(sT*tc)+'</td></tr>';
    });
    rowsV+='<tr class="tot"><td colspan="6">TOTAL GENERAL</td><td class="r">'+money(gvM)+'</td><td class="r">'+money(gvC)+'</td><td class="r">'+money(gvT)+'</td><td class="r">'+bs(gvT*tc)+'</td></tr>';
    hojas += sheet('VENDEDORES — comisión '+comPct+'% (liq. pagable)', Object.keys(byVend).length?tbl(['N°','Vendedor','Categoría','Lote','Cant.','P/U','Monto','Com '+comPct+'%','Liq. Pagable','Total Bs.'],rowsV):'<p class="empty">Sin vendedores.</p>');

    // ── DEFENSAS (socios 0.5% / no socios 1%) ──
    function bloqueDef(lots,pct,titulo){
      if(!lots.length) return '';
      var rows='',n=1,st=0;
      lots.forEach(function(l){
        var m=(l.precio||0)*(l.cantidad||0), c=m*pct/100; st+=c;
        rows+='<tr><td>'+n+'</td><td>'+esc(l.propietario||'—')+'</td><td>'+esc(l.categoria)+'</td><td>'+l.lote+'</td><td class="r">'+l.cantidad+'</td><td class="r">'+money(l.precio)+'</td><td class="r">'+money(m)+'</td><td class="r">'+money(c)+'</td><td class="r">'+bs(c*tc)+'</td></tr>';
        n++;
      });
      rows='<tr class="secc"><td colspan="9">'+titulo+'</td></tr>'+rows+'<tr class="sub"><td colspan="7">SUBTOTAL '+titulo+'</td><td class="r">'+money(st)+'</td><td class="r">'+bs(st*tc)+'</td></tr>';
      return rows;
    }
    var socios=defensas.filter(function(l){return (l.defensaCom!=null?l.defensaCom:0.5)<=0.5;});
    var noSoc =defensas.filter(function(l){return (l.defensaCom!=null?l.defensaCom:0.5)>0.5;});
    var rowsD=bloqueDef(socios,0.5,'DEFENSAS SOCIOS (0.5%)')+bloqueDef(noSoc,1,'DEFENSAS NO SOCIOS (1%)');
    hojas += sheet('DEFENSAS', rowsD?tbl(['N°','Propietario','Categoría','Lote','Cant.','P/U','Monto','Comisión','Com Bs.'],rowsD):'<p class="empty">Sin defensas.</p>');

    // ── RESUMEN ──
    var mNoPlat=lotsComp.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var mPlat=lotsPlat.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var mVend=mNoPlat+mPlat;
    var mDefS=socios.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var mDefN=noSoc.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var cVend=mVend*com,cComp=mNoPlat*com,cPlat=mPlat*0.01,cDefS=mDefS*0.005,cDefN=mDefN*0.01;
    var totI=cVend+cComp+cPlat+cDefS+cDefN;
    var monto=admLotes.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    function fr(l,v,b){return '<tr'+(b?' class="tot"':'')+'><td>'+l+'</td><td class="r">'+money(v)+'</td><td class="r">'+bs(v*tc)+'</td></tr>';}
    var rowsR=fr('Comisión vendedores '+comPct+'%',cVend)+fr('Comisión compradores '+comPct+'%',cComp)+fr('Comisión compradores plataforma 1% (remate)',cPlat)+fr('Defensa socios 0.5%',cDefS)+fr('Defensa no socios 1%',cDefN)+fr('TOTAL INGRESOS',totI,true)+fr('(2% pagado a la plataforma — no es ingreso)',mPlat*0.02)+fr('Monto total operado',monto,true);
    hojas += sheet('RESUMEN — detalle de ingresos', tbl(['Concepto','$us','Bs.'],rowsR));
  }

  var w=window.open('','_blank');
  if(!w){ toast('Permití las ventanas emergentes para poder imprimir', true); return; }
  w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(selTxt)+'</title><style>'+
    'body{font-family:Arial,Helvetica,sans-serif;margin:20px;color:#000}'+
    'h1{margin:0;font-size:19px;letter-spacing:2px}'+
    '.meta{font-size:11px;color:#444;margin:4px 0 10px}'+
    '.sheet{page-break-after:always}'+
    '.sheet:last-child{page-break-after:auto}'+
    '.sheet h2{font-size:14px;margin:12px 0 6px;border-bottom:2px solid #1F4E79;color:#1F4E79;padding-bottom:3px}'+
    'table{width:100%;border-collapse:collapse;font-size:11px}'+
    'th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}'+
    'th{background:#1F4E79;color:#fff;text-transform:uppercase;font-size:10px}'+
    'td.r{text-align:right;white-space:nowrap}'+
    'tr.sub td{background:#eef3f9;font-weight:bold}'+
    'tr.tot td{background:#FFF2CC;font-weight:bold}'+
    'tr.secc td{background:#1F4E79;color:#fff;font-weight:bold;letter-spacing:1px}'+
    '.empty{font-size:12px;color:#555}'+
    '@page{margin:1cm;size:landscape}'+
    '</style></head><body>'+
    '<h1>AGACON</h1><div class="meta">'+esc(selTxt)+' &nbsp;|&nbsp; Impreso: '+fecha+' &nbsp;|&nbsp; T/C: '+tc+' &nbsp;|&nbsp; Comisión: '+comPct+'%</div>'+
    hojas+'</body></html>');
  w.document.close(); w.focus();
  setTimeout(function(){ try{ w.print(); }catch(e){} }, 400);
}

function admImprimir() {
  var sel = document.getElementById('adm-remate-sel');
  var titulo = (sel && sel.selectedOptions[0]) ? sel.selectedOptions[0].textContent : 'Remate';
  var tc  = document.getElementById('adm-tc').value  || '';
  var com = document.getElementById('adm-com').value || '';

  var activeContent = document.querySelector('#adm-panel-reportes .tab-content.on');
  var activeBtn     = document.querySelector('#adm-panel-reportes .tab.on');
  var tabName = activeBtn ? activeBtn.textContent.trim() : '';
  if (!activeContent) { toast('No hay tabla para imprimir', true); return; }

  var filtroInfo = '';
  var fi = document.getElementById('adm-filter-info');
  if (fi && fi.textContent.trim()) filtroInfo = fi.textContent.trim();

  var tablaHTML = activeContent.innerHTML;
  var fecha = admFechaRemate();

  var w = window.open('', '_blank');
  if (!w) { toast('Permití las ventanas emergentes para poder imprimir', true); return; }
  w.document.write(
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + titulo + ' — ' + tabName + '</title>' +
    '<style>' +
    'body{font-family:Arial,Helvetica,sans-serif;margin:22px;color:#000}' +
    'h1{margin:0;font-size:20px;letter-spacing:2px}' +
    'h2{margin:2px 0 0;font-size:15px;font-weight:600;color:#222}' +
    '.meta{font-size:12px;color:#444;margin:6px 0 14px}' +
    '.tbl-wrap,.tbl-scroll{overflow:visible!important;height:auto!important;max-height:none!important}' +
    'table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}' +
    'th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top}' +
    'th{background:#eee;text-transform:uppercase;font-size:11px;letter-spacing:.5px}' +
    'tr:nth-child(even) td{background:#f7f7f7}' +
    '.subtotal td{background:#e8f0e8!important;font-weight:bold}' +
    '@page{margin:1cm}' +
    '</style></head><body>' +
    '<h1>AGACON</h1>' +
    '<h2>' + titulo + ' — ' + tabName + '</h2>' +
    '<div class="meta">Impreso: ' + fecha + ' &nbsp;|&nbsp; T/C: ' + tc + ' &nbsp;|&nbsp; Comisión: ' + com + '%' +
    (filtroInfo ? ' &nbsp;|&nbsp; ' + filtroInfo : '') + '</div>' +
    tablaHTML +
    '</body></html>'
  );
  w.document.close();
  w.focus();
  setTimeout(function(){ try { w.print(); } catch(e){} }, 350);
}

// Excel de compras "mediante otra plataforma": 3 hojas —
// COM 3% (total cobrado), COM 2% (para la plataforma), COM 1% (queda para el remate)
async function admExportPlataforma() {
  var lots = admLotes.filter(function(l){ return l.otraPlataforma && l.comprador && !lotEsDefensa(l); });
  if(!lots.length){ toast('No hay compras mediante otra plataforma en este remate', true); return; }
  var tc    = parseFloat(document.getElementById('adm-tc').value)||6.96;
  var fecha = admFechaRemate();
  var selEl = document.getElementById('adm-remate-sel');
  var selTxt= selEl.options[selEl.selectedIndex] ? selEl.options[selEl.selectedIndex].text : 'Remate';
  toast('Generando Excel otra plataforma...');
  try {
    var wb = new ExcelJS.Workbook(); wb.creator='AGACON';
    function border(){return {top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'}};}
    function hdrFill(c){return {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+c}};}
    var BLUEBG='1F4E79', YELLOW='FFF2CC';

    function buildSheet(nombre, pct, subtitulo) {
      var ws = wb.addWorksheet(nombre);
      [4,26,14,8,8,10,12,12,12,7,12].forEach(function(w,i){ ws.getColumn(i+1).width=w; });
      ws.mergeCells(1,1,1,11);
      var t1=ws.getCell(1,1); t1.value='AGACON — '+selTxt+' — FECHA: '+fecha;
      t1.font={name:'Calibri',bold:true,size:13,color:{argb:'FF1F4E79'}};
      ws.mergeCells(2,1,2,11);
      var t2=ws.getCell(2,1); t2.value='COMPRAS MEDIANTE OTRA PLATAFORMA — '+subtitulo;
      t2.font={name:'Calibri',bold:true,size:11};
      var hd=['N°','COMPRADOR','CATEGORÍA','LOTE','CANT.','P/U','MONTO','COM '+pct+'%','COM Bs.','T/C','COM Bs. TOTAL'];
      var hr=ws.getRow(4); hr.height=20;
      hd.forEach(function(h,i){ var c=hr.getCell(i+1); c.value=h; c.border=border();
        c.font={name:'Calibri',bold:true,size:10,color:{argb:'FFFFFFFF'}}; c.fill=hdrFill(BLUEBG);
        c.alignment={horizontal:'center',vertical:'middle'}; });
      var row=5, n=1;
      lots.forEach(function(l){
        var r=ws.getRow(row); r.height=18;
        r.getCell(1).value=n; r.getCell(2).value=l.comprador+(l.compradorCI?' (CI: '+l.compradorCI+')':'');
        r.getCell(3).value=l.categoria||''; r.getCell(4).value=l.lote||0;
        r.getCell(5).value=l.cantidad||0; r.getCell(6).value=l.precio||0;
        r.getCell(7).value={formula:'E'+row+'*F'+row};
        r.getCell(8).value={formula:'G'+row+'*'+pct+'%'};
        r.getCell(9).value={formula:'H'+row+'*'+tc};
        r.getCell(10).value=tc;
        r.getCell(11).value={formula:'H'+row+'*J'+row};
        for(var c=1;c<=11;c++){ var cc=r.getCell(c); cc.border=border(); cc.font={name:'Calibri',size:10};
          cc.alignment={horizontal:(c===2||c===3)?'left':'right',vertical:'middle'};
          if(c>=6) cc.numFmt='#,##0.00'; if(c===10) cc.numFmt='0.00'; }
        row++; n++;
      });
      // TOTALES
      var rt=ws.getRow(row); rt.height=20;
      for(var c2=1;c2<=11;c2++){ var ct=rt.getCell(c2); ct.border=border();
        ct.font={name:'Calibri',bold:true,size:11}; ct.fill=hdrFill(YELLOW);
        ct.alignment={horizontal:'right',vertical:'middle'}; ct.numFmt='#,##0.00'; }
      ws.mergeCells(row,1,row,6);
      rt.getCell(1).value='TOTALES'; rt.getCell(1).alignment={horizontal:'left',vertical:'middle'};
      rt.getCell(7).value={formula:'SUM(G5:G'+(row-1)+')'};
      rt.getCell(8).value={formula:'SUM(H5:H'+(row-1)+')'};
      rt.getCell(9).value={formula:'SUM(I5:I'+(row-1)+')'};
      rt.getCell(11).value={formula:'SUM(K5:K'+(row-1)+')'};
      return ws;
    }

    buildSheet('COM 3% TOTAL', 3, 'COMISIÓN TOTAL COBRADA (3%)');
    buildSheet('COM 2% PLATAFORMA', 2, 'PARTE PARA LA PLATAFORMA (2%)');
    buildSheet('COM 1% REMATE', 1, 'PARTE QUE QUEDA PARA EL REMATE (1%)');

    var buf = await wb.xlsx.writeBuffer();
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    a.download='AGACON_otra_plataforma_'+fecha.replace(/\//g,'-')+'.xlsx';
    a.click();
    toast('Excel otra plataforma exportado ✓');
  } catch(e) { console.error(e); toast('Error generando Excel: '+e.message, true); }
}

async function admExportExcel() {
  if(!admLotes.length){toast('No hay datos para exportar',true);return;}
  var tc     = parseFloat(document.getElementById('adm-tc').value)||6.96;
  var comPct = parseFloat(document.getElementById('adm-com').value)||3;
  var bank   = getBankData();
  var fecha  = admFechaRemate();
  var selEl  = document.getElementById('adm-remate-sel');
  var selTxt = selEl.options[selEl.selectedIndex] ? selEl.options[selEl.selectedIndex].text : '';
  var remNum = selTxt.replace(/ *[(][^)]+[)]$/, '').trim() || ('Remate '+fecha);
  // Extract just the number from the remate name e.g. "REMATE N°5 — 2026/05/03" -> "5"
  var remateNumero = (function(){
    var m = remNum.match(/N[°º]?\s*(\d+)/i);
    return m ? m[1] : remNum;
  })();

  toast('Generando Excel...');

  try {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'AGACON';
    wb.created = new Date();

    var YELLOW  = 'FFFFCC';
    var TOTBG   = 'D9D9D9';
    var HDRBG   = 'D9E1F2';
    var GRANDBG = 'BDD7EE';
    var yr = fecha.split('/')[2] || new Date().getFullYear();

    function border() {
      var s = {style:'thin', color:{argb:'FFAAAAAA'}};
      return {top:s,bottom:s,left:s,right:s};
    }

    function hdrFill(color) { return {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+color}}; }

    function setWidths(ws) {
      ws.columns = [
        {width:4},{width:30},{width:12},{width:11},{width:11},
        {width:8.5},{width:14.8},{width:15},{width:14.5},{width:9.3},{width:16}
      ];
    }

    function writeTitle(ws, seccion) {
      [
        [3, 'REMATES/'+yr],
        [4, 'REMATE N° ' + remateNumero],
        [5, 'FECHA: ' + fecha],
        [6, seccion]
      ].forEach(function(item) {
        var r = ws.getRow(item[0]);
        r.getCell(1).value = item[1];
        r.getCell(1).font = {name:'Calibri', bold:true, size: item[0]<6?11:12};
      });
      ws.getRow(7).height = 30;
    }

    function writeHeaders(ws, cols) {
      var r = ws.getRow(7);
      cols.forEach(function(h, i) {
        var c = r.getCell(i+1);
        c.value = h;
        c.font = {name:'Calibri', bold:true, size:10, color:{argb:'FF000000'}};
        c.fill = hdrFill(HDRBG);
        c.border = border();
        c.alignment = {horizontal:'center', vertical:'middle', wrapText:true};
      });
    }

    function dataRow(ws, rowNum, n, name, lot, seller) {
      var r = ws.getRow(rowNum);
      r.height = 18;
      var vals = [n, name, lot.categoria||'', lot.lote||0, lot.cantidad||0, lot.precio||0];
      var aligns = ['center','left','left','center','center','right'];
      vals.forEach(function(v,i) {
        var c = r.getCell(i+1);
        c.value = v; c.border = border();
        c.font = {name:'Calibri', size:10};
        c.alignment = {horizontal:aligns[i], vertical:'middle'};
        if (i>=4) c.numFmt = '#,##0';
      });
      // Monto = E*F
      var cM = r.getCell(7);
      cM.value = {formula: 'E'+rowNum+'*F'+rowNum};
      cM.numFmt = '#,##0.00'; cM.border = border(); cM.font = {name:'Calibri',size:10};
      cM.alignment = {horizontal:'right',vertical:'middle'};
      // Comision
      var cC = r.getCell(8);
      cC.value = {formula: 'G'+rowNum+'*'+comPct+'%'};
      cC.numFmt = '#,##0.00'; cC.border = border(); cC.font = {name:'Calibri',size:10};
      cC.alignment = {horizontal:'right',vertical:'middle'};
      // Total
      var op = seller ? '-' : '+';
      var cT = r.getCell(9);
      cT.value = {formula: 'G'+rowNum+op+'H'+rowNum};
      cT.numFmt = '#,##0.00'; cT.border = border(); cT.fill = hdrFill(YELLOW);
      cT.font = {name:'Calibri',bold:true,size:10}; cT.alignment = {horizontal:'right',vertical:'middle'};
      // TC
      var cTC = r.getCell(10);
      cTC.value = tc; cTC.numFmt = '0.00'; cTC.border = border(); cTC.font = {name:'Calibri',size:10};
      cTC.alignment = {horizontal:'center',vertical:'middle'};
      // Total Bs
      var cBs = r.getCell(11);
      cBs.value = {formula: 'I'+rowNum+'*J'+rowNum};
      cBs.numFmt = '#,##0.00'; cBs.border = border(); cBs.font = {name:'Calibri',bold:true,size:10};
      cBs.alignment = {horizontal:'right',vertical:'middle'};
    }

    function subtotalRow(ws, rowNum, startR, endR, label) {
      var r = ws.getRow(rowNum);
      r.height = 18;
      [1,2,3,4,5,6,7,8,9,10,11].forEach(function(c) {
        var cell = r.getCell(c);
        cell.border = border(); cell.fill = hdrFill(TOTBG);
        cell.font = {name:'Calibri',bold:true,size:10};
        cell.alignment = {horizontal:'right',vertical:'middle'};
      });
      r.getCell(1).value = label||'TOTALES';
      r.getCell(1).alignment = {horizontal:'left',vertical:'middle'};
      r.getCell(5).value  = {formula:'SUM(E'+startR+':E'+endR+')'}; r.getCell(5).numFmt='#,##0';
      r.getCell(7).value  = {formula:'SUM(G'+startR+':G'+endR+')'}; r.getCell(7).numFmt='#,##0.00';
      r.getCell(8).value  = {formula:'SUM(H'+startR+':H'+endR+')'}; r.getCell(8).numFmt='#,##0.00';
      r.getCell(9).value  = {formula:'SUM(I'+startR+':I'+endR+')'}; r.getCell(9).numFmt='#,##0.00';
      r.getCell(9).fill   = hdrFill(YELLOW);
      r.getCell(11).value = {formula:'SUM(K'+startR+':K'+endR+')'}; r.getCell(11).numFmt='#,##0.00';
    }

    function grandTotalRow(ws, rowNum, totalRefs) {
      var r = ws.getRow(rowNum);
      r.height = 20;
      [1,2,3,4,5,6,7,8,9,10,11].forEach(function(c) {
        var cell = r.getCell(c);
        cell.border = border(); cell.fill = hdrFill(GRANDBG);
        cell.font = {name:'Calibri',bold:true,size:11};
        cell.alignment = {horizontal:'right',vertical:'middle'};
      });
      r.getCell(1).value = 'TOTAL GENERAL';
      r.getCell(1).alignment = {horizontal:'left',vertical:'middle'};
      function S(col) { return totalRefs.map(function(r){return col+r;}).join('+'); }
      r.getCell(5).value={formula:'='+S('E')};r.getCell(5).numFmt='#,##0';
      r.getCell(7).value={formula:'='+S('G')};r.getCell(7).numFmt='#,##0.00';
      r.getCell(8).value={formula:'='+S('H')};r.getCell(8).numFmt='#,##0.00';
      r.getCell(9).value={formula:'='+S('I')};r.getCell(9).numFmt='#,##0.00';
      r.getCell(9).fill=hdrFill(YELLOW);
      r.getCell(11).value={formula:'='+S('K')};r.getCell(11).numFmt='#,##0.00';
    }

    function writeBankData(ws, startRow) {
      if (!bank.tipo && !bank.cuenta && !bank.titular1) return;
      var row = startRow + 2;
      var lines = [
        {text: bank.tipo, color: '000000'},
        {text: bank.cuenta, color: 'C00000'},
        {text: bank.titular1 + '    CI. ' + bank.ci1, color: '000000'},
        {text: bank.titular2 + '    CI. ' + bank.ci2, color: '000000'},
      ];
      lines.forEach(function(l) {
        if (l.text && l.text.trim() && l.text.trim() !== 'CI.') {
          var c = ws.getRow(row).getCell(1);
          c.value = l.text;
          c.font = {name:'Calibri', bold:true, size:11, color:{argb:'FF'+l.color}};
          row++;
        }
      });
    }

    function buildSheet(wb, sheetName, byGroup, seller, totLabel, headers) {
      var ws = wb.addWorksheet(sheetName);
      setWidths(ws);
      writeTitle(ws, sheetName === 'VENDEDORES' ? 'VENDEDOR' : sheetName);
      writeHeaders(ws, headers);
      ws.views = [{state:'frozen', ySplit:7}];

      var row = 8;
      var totalRefs = [];
      Object.keys(byGroup).forEach(function(name) {
        var lots = byGroup[name];
        var startRow = row;
        lots.forEach(function(l, i) {
          dataRow(ws, row, i+1, name, l, seller);
          row++;
        });
        totalRefs.push(row);
        subtotalRow(ws, row, startRow, row-1, totLabel);
        row++;
      });
      grandTotalRow(ws, row, totalRefs);
      writeBankData(ws, row);
      return row;
    }

    // Group lotes — excluir defensas de compradores y vendedores (defensa por bandera o por CI)
    var lotesNormales = admLotes.filter(function(l){ return !lotEsDefensa(l); });
    var byComp = {}, byVend = {};
    lotesNormales.forEach(function(l) {
      // Agrupar por nombre+CI para separar personas con mismo nombre (ej: menonitas)
      var nombre = (l.comprador||'SIN COMPRADOR').trim();
      var ci = (l.compradorCI||'').trim();
      var ck = ci ? nombre + ' — CI: ' + ci : nombre;
      var vk = l.propietario||'SIN PROPIETARIO';
      if (!byVend[vk]) byVend[vk]=[];
      byVend[vk].push(l);
      if (l.otraPlataforma) return; // las compras por plataforma van en su propia hoja
      if (!byComp[ck]) byComp[ck]=[];
      byComp[ck].push(l);
    });

    // COMPRADORES sheet
    buildSheet(wb, 'COMPRADORES', byComp, false, 'TOTALES',
      ['N°','COMPRADOR','CATEGORIA','LOTE','CANTIDAD','P/U','MONTO','COMISION '+comPct+'%','TOTAL MONTO EN $US','T/C '+tc,'TOTAL MONTO EN Bs.']
    );

    // PLATAFORMA sheet — compras mediante otra plataforma (3% total / 2% plataforma / 1% remate)
    var lotesPlat = lotesNormales.filter(function(l){ return l.otraPlataforma && l.comprador; });
    if (lotesPlat.length) {
      var wsP = wb.addWorksheet('PLATAFORMA');
      [4,26,14,8,10,10,12,13,13,13].forEach(function(w,i){ wsP.getColumn(i+1).width=w; });
      wsP.mergeCells(1,1,1,10);
      var tP=wsP.getCell(1,1); tP.value='AGACON — REMATE N° '+remateNumero+' — FECHA: '+fecha;
      tP.font={name:'Calibri',bold:true,size:13,color:{argb:'FF1F4E79'}};
      wsP.mergeCells(2,1,2,10);
      var tP2=wsP.getCell(2,1); tP2.value='COMPRAS MEDIANTE OTRA PLATAFORMA';
      tP2.font={name:'Calibri',bold:true,size:11};
      var hdP=['N°','COMPRADOR','CATEGORIA','LOTE','CANT.','P/U','MONTO','COM 3% TOTAL','2% PLATAFORMA','1% REMATE'];
      var hrP=wsP.getRow(4); hrP.height=20;
      hdP.forEach(function(h,i){ var c=hrP.getCell(i+1); c.value=h; c.border=border();
        c.font={name:'Calibri',bold:true,size:10,color:{argb:'FFFFFFFF'}}; c.fill=hdrFill('1F4E79');
        c.alignment={horizontal:'center',vertical:'middle'}; });
      var rowP=5, nP=1;
      lotesPlat.forEach(function(l){
        var rP=wsP.getRow(rowP); rP.height=18;
        rP.getCell(1).value=nP; rP.getCell(2).value=(l.comprador||'')+((l.compradorCI)?' (CI: '+l.compradorCI+')':'');
        rP.getCell(3).value=l.categoria||''; rP.getCell(4).value=l.lote||0;
        rP.getCell(5).value=l.cantidad||0; rP.getCell(6).value=l.precio||0;
        rP.getCell(7).value={formula:'E'+rowP+'*F'+rowP};
        rP.getCell(8).value={formula:'G'+rowP+'*3%'};
        rP.getCell(9).value={formula:'G'+rowP+'*2%'};
        rP.getCell(10).value={formula:'G'+rowP+'*1%'};
        for(var cP=1;cP<=10;cP++){ var ccP=rP.getCell(cP); ccP.border=border(); ccP.font={name:'Calibri',size:10};
          ccP.alignment={horizontal:(cP===2||cP===3)?'left':'right',vertical:'middle'};
          if(cP>=6) ccP.numFmt='#,##0.00'; }
        rowP++; nP++;
      });
      var rtP=wsP.getRow(rowP); rtP.height=20;
      for(var cT=1;cT<=10;cT++){ var ctP=rtP.getCell(cT); ctP.border=border();
        ctP.font={name:'Calibri',bold:true,size:11}; ctP.fill=hdrFill(YELLOW);
        ctP.alignment={horizontal:'right',vertical:'middle'}; ctP.numFmt='#,##0.00'; }
      wsP.mergeCells(rowP,1,rowP,6);
      rtP.getCell(1).value='TOTALES'; rtP.getCell(1).alignment={horizontal:'left',vertical:'middle'};
      ['G','H','I','J'].forEach(function(col,i){ rtP.getCell(7+i).value={formula:'SUM('+col+'5:'+col+(rowP-1)+')'}; });
    }

    // VENDEDORES sheet
    buildSheet(wb, 'VENDEDORES', byVend, true, 'TOTAL',
      ['N°','VENDEDORES','CATEGORIA','LOTE','CANTIDAD','P/U','MONTO','COMISION '+comPct+'%','TOTAL A PAGAR $us','T/C '+tc,'TOTAL A PAGAR Bs.']
    );

    // DEFENSAS sheet — separar socio (0.5%) y no socio (1%) — defensa por bandera o por CI
    var sinComp = admLotes.filter(function(l){return lotEsDefensa(l) || !l.comprador;});
    // Resolver comisión de cada defensa: socio → 0.5%; si no está en la lista → preguntar (una vez por persona).
    // Si se resuelve por primera vez, se guarda en la base para no volver a preguntar en el futuro.
    var defensaCache = {};
    sinComp.forEach(function(l){
      if(!lotEsDefensa(l)) return;
      var yaGuardada = (l.defensaCom != null);
      var pct = resolveDefensaPct(l, defensaCache);
      l.esDefensa = true; l.defensaCom = pct;
      if(!yaGuardada) admPersistDefensa(l, pct);
    });
    var byDefSocio = {}, byDefNoSocio = {};
    sinComp.forEach(function(l){
      var k = l.propietario||'SIN PROPIETARIO';
      var pct = l.defensaCom || 0.5;
      if (pct <= 0.5) {
        if(!byDefSocio[k]) byDefSocio[k]=[];
        byDefSocio[k].push(l);
      } else {
        if(!byDefNoSocio[k]) byDefNoSocio[k]=[];
        byDefNoSocio[k].push(l);
      }
    });
    var byDef = {}; // combined for backward compat
    sinComp.forEach(function(l){
      var k = l.propietario||'SIN PROPIETARIO';
      if(!byDef[k]) byDef[k]=[];
      byDef[k].push(l);
    });
    var wsDef = wb.addWorksheet('DEFENSAS');
    setWidths(wsDef);
    writeTitle(wsDef, 'DEFENSAS');
    writeHeaders(wsDef, ['N°','DEFENSAS','CATEGORIA','LOTE','CANTIDAD','P/U','MONTO','COMISION 0.5% - 1%','TOTAL A PAGAR $','T/C '+tc,'TOTAL A PAGAR Bs.']);
    wsDef.views = [{state:'frozen',ySplit:7}];
    var rowD=8, totD=[], gnD=1;
    function defSeccion(titulo, grupos){
      if(!Object.keys(grupos).length) return;
      wsDef.mergeCells(rowD,1,rowD,11);
      var hS=wsDef.getRow(rowD).getCell(1);
      hS.value=titulo; hS.font={name:'Calibri',bold:true,size:11,color:{argb:'FFFFFFFF'}};
      hS.fill=hdrFill('1F4E79'); hS.border=border();
      rowD++;
      Object.keys(grupos).forEach(function(prop) {
        var lots=grupos[prop], sD=rowD;
        lots.forEach(function(l) {
          var r=wsDef.getRow(rowD); r.height=18;
          r.getCell(1).value=gnD; r.getCell(2).value=prop; r.getCell(3).value=l.categoria||'';
          r.getCell(4).value=l.lote||0; r.getCell(5).value=l.cantidad||0; r.getCell(6).value=l.precio||0;
          [1,2,3,4,5,6].forEach(function(c){
            r.getCell(c).border=border(); r.getCell(c).font={name:'Calibri',size:10};
            r.getCell(c).alignment={horizontal:c<=2?'left':c<=3?'left':'center',vertical:'middle'};
          });
          r.getCell(5).numFmt='#,##0'; r.getCell(6).numFmt='#,##0';
          r.getCell(6).alignment={horizontal:'right',vertical:'middle'};
          var defPct = (l.defensaCom||0.5);
          [[7,'E'+rowD+'*F'+rowD],[8,'G'+rowD+'*'+defPct+'%'],[9,'H'+rowD],[11,'I'+rowD+'*J'+rowD]].forEach(function(fc){
            var cell=r.getCell(fc[0]); cell.value={formula:fc[1]}; cell.numFmt='#,##0.00';
            cell.border=border(); cell.font={name:'Calibri',size:10};
            cell.alignment={horizontal:'right',vertical:'middle'};
            if(fc[0]===9){cell.fill=hdrFill(YELLOW);cell.font={name:'Calibri',bold:true,size:10};}
            if(fc[0]===11){cell.font={name:'Calibri',bold:true,size:10};}
          });
          r.getCell(10).value=tc; r.getCell(10).numFmt='0.00'; r.getCell(10).border=border();
          r.getCell(10).font={name:'Calibri',size:10}; r.getCell(10).alignment={horizontal:'center',vertical:'middle'};
          rowD++; gnD++;
        });
        totD.push(rowD); subtotalRow(wsDef,rowD,sD,rowD-1,'TOTAL'); rowD++;
      });
    }
    defSeccion('DEFENSAS SOCIOS (0.5%)',   byDefSocio);
    defSeccion('DEFENSAS NO SOCIOS (1%)',  byDefNoSocio);
    if(totD.length) grandTotalRow(wsDef,rowD,totD);

    // RESUMEN sheet
    var wsRes = wb.addWorksheet('RESUMEN');
    wsRes.columns = [{width:38},{width:20},{width:18}];
    var r1 = wsRes.getRow(1); r1.getCell(1).value='ASOCIACION DE GANADEROS DE CONCEPCION - AGACON';
    r1.getCell(1).font={name:'Calibri',bold:true,size:14};
    var r2 = wsRes.getRow(2); r2.getCell(1).value='REMATE N° '+remateNumero+' — FECHA: '+fecha;
    r2.getCell(1).font={name:'Calibri',bold:true,size:12};
    var monto=admLotes.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var dtM=sinComp.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var cab=admLotes.reduce(function(a,l){return a+(l.cantidad||0);},0);
    function resHdr(rowN,title) {
      [1,2,3].forEach(function(c){
        var cell=wsRes.getRow(rowN).getCell(c);
        cell.fill=hdrFill('1F4E79'); cell.font={name:'Calibri',bold:true,size:11,color:{argb:'FFFFFFFF'}};
        cell.border=border();
      });
      wsRes.getRow(rowN).getCell(1).value=title;
      wsRes.getRow(rowN).getCell(2).value='TOTAL $us'; wsRes.getRow(rowN).getCell(2).alignment={horizontal:'right',vertical:'middle'};
      wsRes.getRow(rowN).getCell(3).value='TOTAL Bs.'; wsRes.getRow(rowN).getCell(3).alignment={horizontal:'right',vertical:'middle'};
    }
    function resItem(rowN,label,usd,bold) {
      var bg=bold?YELLOW:null;
      [1,2,3].forEach(function(c){
        var cell=wsRes.getRow(rowN).getCell(c);
        cell.border=border(); cell.font={name:'Calibri',bold:!!bold,size:10};
        if(bg) cell.fill=hdrFill(bg);
      });
      wsRes.getRow(rowN).getCell(1).value=label;
      wsRes.getRow(rowN).getCell(2).value=Math.round(usd*100)/100; wsRes.getRow(rowN).getCell(2).numFmt='#,##0.00'; wsRes.getRow(rowN).getCell(2).alignment={horizontal:'right',vertical:'middle'};
      wsRes.getRow(rowN).getCell(3).value=Math.round(usd*tc*100)/100; wsRes.getRow(rowN).getCell(3).numFmt='#,##0.00'; wsRes.getRow(rowN).getCell(3).alignment={horizontal:'right',vertical:'middle'};
    }
    // Calcular montos de defensa por tipo
    var dtMSocio   = sinComp.filter(function(l){return (l.defensaCom||0.5)<=0.5;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var dtMNoSocio = sinComp.filter(function(l){return (l.defensaCom||0.5)>0.5;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var comDefSocio   = dtMSocio * 0.005;
    var comDefNoSocio = dtMNoSocio * 0.01;
    var montoNoPlat = lotesNormales.filter(function(l){return !l.otraPlataforma;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var montoPlat   = lotesNormales.filter(function(l){return  l.otraPlataforma;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
    var montoNormal = montoNoPlat + montoPlat;
    var comIngresosFinal = montoNormal*comPct/100 + montoNoPlat*comPct/100 + montoPlat*0.01 + comDefSocio + comDefNoSocio;

    // Vendedor mayor cantidad
    var vendCab = {};
    admLotes.forEach(function(l){
      var v=l.propietario||'SIN PROPIETARIO';
      vendCab[v]=(vendCab[v]||0)+(l.cantidad||0);
    });
    var topVend = Object.keys(vendCab).sort(function(a,b){return vendCab[b]-vendCab[a];})[0]||'—';

    // Comprador mayor cantidad (excluir defensas)
    var compCab = {};
    lotesNormales.forEach(function(l){
      if(!l.comprador) return;
      var ci = (l.compradorCI||'').trim();
      var nombre = (l.comprador||'').trim();
      var ck = ci ? nombre+' (CI: '+ci+')' : nombre;
      compCab[ck]=(compCab[ck]||0)+(l.cantidad||0);
    });
    var topComp = Object.keys(compCab).sort(function(a,b){return compCab[b]-compCab[a];})[0]||'—';

    resHdr(4,'DETALLE DE INGRESOS');
    resItem(5,'COMISION VENDEDORES '+comPct+'%', montoNormal*comPct/100);
    resItem(6,'COMISION COMPRADORES '+comPct+'%', montoNoPlat*comPct/100);
    resItem(7,'COMISION COMPRADORES PLATAFORMA 1% (REMATE)', montoPlat*0.01);
    resItem(8,'DEFENSA SOCIO 0.5%',   comDefSocio);
    resItem(9,'DEFENSA NO SOCIO 1%',  comDefNoSocio);
    resItem(10,'TOTAL INGRESOS', comIngresosFinal, true);
    resItem(11,'(2% pagado a la plataforma — no es ingreso)', montoPlat*0.02);
    resHdr(13,'ESTADISTICAS');
    resItem(14,'Monto total operado $us', monto, true);
    wsRes.getRow(15).getCell(1).value='Total lotes';   wsRes.getRow(15).getCell(2).value=admLotes.length;
    wsRes.getRow(16).getCell(1).value='Total cabezas'; wsRes.getRow(16).getCell(2).value=cab;
    wsRes.getRow(17).getCell(1).value='Sin comprador / Defensa'; wsRes.getRow(17).getCell(2).value=sinComp.length;
    // Estilos estadisticas extra
    [15,16,17].forEach(function(rn){
      [1,2,3].forEach(function(c){
        wsRes.getRow(rn).getCell(c).border=border();
        wsRes.getRow(rn).getCell(c).font={name:'Calibri',size:10};
      });
    });
    resHdr(19,'DESTACADOS');
    wsRes.getRow(20).getCell(1).value='Vendedor mayor cantidad bovina';
    wsRes.getRow(20).getCell(2).value=topVend;
    wsRes.getRow(20).getCell(3).value=vendCab[topVend]+' cab.';
    wsRes.getRow(21).getCell(1).value='Comprador mayor cantidad bovina';
    wsRes.getRow(21).getCell(2).value=topComp;
    wsRes.getRow(21).getCell(3).value=(compCab[topComp]||0)+' cab.';
    [20,21].forEach(function(rn){
      [1,2,3].forEach(function(c){
        wsRes.getRow(rn).getCell(c).border=border();
        wsRes.getRow(rn).getCell(c).font={name:'Calibri',bold:true,size:10};
      });
      wsRes.getRow(rn).getCell(2).alignment={horizontal:'left',vertical:'middle'};
      wsRes.getRow(rn).getCell(3).alignment={horizontal:'center',vertical:'middle'};
    });


    // Download
    var buf = await wb.xlsx.writeBuffer();;
    var blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url; a.download='AGACON_REMATE_'+fecha.split('/').join('-')+'.xlsx';
    a.click(); URL.revokeObjectURL(url);
    toast('Excel exportado con formato completo ✓');

  } catch(err) {
    console.error(err);
    toast('Error: '+err.message, true);
  }
}


/* ═══════════════════════════════════════════════
   LISTA DE PARTICIPANTES (Excel) — agrupada por nombre.
   Columnas: lotes comprados / vendidos / defendidos.
   Sirve como base de control para imprimir los
   reportes individuales de cada participante.
   ═══════════════════════════════════════════════ */
async function admExportParticipantes() {
  if(!admLotes.length){ toast('No hay datos para exportar', true); return; }
  var selEl = document.getElementById('adm-remate-sel');
  var selTxt= selEl.options[selEl.selectedIndex] ? selEl.options[selEl.selectedIndex].text : 'Remate';
  var fecha = admFechaRemate();

  // Agrupar por nombre normalizado (mayúsculas, sin espacios dobles)
  var parts = {}; // clave → {nombre, ci, compro, vendio, defendio}
  function P(nombre, ci){
    var k = String(nombre||'').trim().toUpperCase().replace(/\s+/g,' ');
    if(!k) return null;
    if(!parts[k]) parts[k] = { nombre:k, ci:'', compro:0, vendio:0, defendio:0 };
    if(ci && !parts[k].ci) parts[k].ci = ci;
    return parts[k];
  }
  admLotes.forEach(function(l){
    // Se cuenta 1 por LOTE (no la cantidad de animales)
    if(lotEsDefensa(l)){
      var d = P(l.propietario, l.ciPropietario);
      if(d) d.defendio += 1;
    } else if(l.comprador){
      var c = P(l.comprador, l.compradorCI);
      if(c) c.compro += 1;
      var v = P(l.propietario, l.ciPropietario);
      if(v) v.vendio += 1;
    }
  });
  var keys = Object.keys(parts).sort();
  if(!keys.length){ toast('No hay participantes para listar', true); return; }

  toast('Generando Excel...');
  try {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'AGACON';
    var logoImgId = null;
    try {
      if (typeof AGACON_LOGO_REPORTE === 'string' && AGACON_LOGO_REPORTE.indexOf('base64,') !== -1) {
        logoImgId = wb.addImage({ base64: AGACON_LOGO_REPORTE.split('base64,')[1], extension: 'png' });
      }
    } catch(e) {}

    var ws = wb.addWorksheet('PARTICIPANTES');
    ws.columns=[{width:5},{width:40},{width:15},{width:11},{width:11},{width:12}];
    ws.pageSetup = { orientation:'portrait', fitToPage:true, fitToWidth:1, fitToHeight:0,
      margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.2,footer:0.2} };

    function hdrFill(c){ return {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+c}}; }
    function border(){ var s={style:'thin',color:{argb:'FFAAAAAA'}}; return {top:s,bottom:s,left:s,right:s}; }

    // Título + logo
    ws.getRow(1).height=18; ws.getRow(2).height=18; ws.getRow(3).height=18;
    if(logoImgId!==null) ws.addImage(logoImgId,{tl:{col:4.5,row:0.1},ext:{width:86,height:66},editAs:'oneCell'});
    ws.getRow(1).getCell(1).value='AGACON — '+selTxt;
    ws.getRow(1).getCell(1).font={name:'Calibri',bold:true,size:12};
    ws.getRow(2).getCell(1).value='LISTA DE PARTICIPANTES — lotes comprados, vendidos y defendidos';
    ws.getRow(2).getCell(1).font={name:'Calibri',bold:true,size:11,color:{argb:'FF1B4D2E'}};
    ws.getRow(3).getCell(1).value='Generado: '+fecha;
    ws.getRow(3).getCell(1).font={name:'Calibri',size:10,color:{argb:'FF777777'}};

    // Encabezados
    var hr=ws.getRow(5); hr.height=22;
    ['N°','PARTICIPANTE','CI','L. COMPRA','L. VENTA','L. DEFENSA'].forEach(function(h,i){
      var c=hr.getCell(i+1); c.value=h;
      c.font={name:'Calibri',bold:true,size:10,color:{argb:'FF1B4D2E'}};
      c.fill=hdrFill('DDEBE2'); c.border=border();
      c.alignment={horizontal:i<2?'left':'center',vertical:'middle',wrapText:true};
    });

    // Filas
    var R=6, tC=0, tV=0, tD=0;
    keys.forEach(function(k,idx){
      var p=parts[k]; tC+=p.compro; tV+=p.vendio; tD+=p.defendio;
      var r=ws.getRow(R);
      var vals=[idx+1, p.nombre, p.ci||'—', p.compro||'—', p.vendio||'—', p.defendio||'—'];
      vals.forEach(function(v,i){
        var c=r.getCell(i+1); c.value=v; c.border=border();
        c.font={name:'Calibri',size:10};
        c.alignment={horizontal:i<2?'left':'center',vertical:'middle'};
      });
      R++;
    });

    // Totales
    var rt=ws.getRow(R); rt.height=18;
    ws.mergeCells(R,1,R,2);
    var ct=rt.getCell(1); ct.value='TOTALES — '+keys.length+' participantes';
    ct.font={name:'Calibri',bold:true,size:10}; ct.fill=hdrFill('FFE699'); ct.border=border();
    ct.alignment={horizontal:'right',vertical:'middle'};
    [['',3],[tC,4],[tV,5],[tD,6]].forEach(function(pair){
      var c=rt.getCell(pair[1]); if(pair[0]!=='') c.value=pair[0];
      c.fill=hdrFill('FFE699'); c.border=border();
      c.font={name:'Calibri',bold:true,size:10};
      c.alignment={horizontal:'center',vertical:'middle'};
    });

    var buf = await wb.xlsx.writeBuffer();
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    a.download='AGACON_participantes_'+fecha.replace(/\//g,'-')+'.xlsx';
    a.click();
    toast('Excel de participantes generado ✓');
  } catch(e) {
    console.error('[AGACON] participantes:', e);
    toast('Error generando el Excel', true);
  }
}
