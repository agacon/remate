/* ═══════════════════════════════════════════════
   AGACON — 05-administracion.js
   Módulo Administración: remates, T/C, pestañas y tablas de reportes
   ═══════════════════════════════════════════════ */
function admSaveRemateTC() {
  if (!admRemateId) return;
  var tc = parseFloat(document.getElementById('adm-tc').value);
  if (isNaN(tc) || tc <= 0) return;
  admRematesTC[admRemateId] = tc;
  supa.from('remates').update({ tc: tc }).eq('id', admRemateId).then(function(res){
    if (res && res.error) { toast('No se pudo guardar el T/C del remate', true); }
    else { toast('T/C del remate actualizado a ' + tc); }
  }, function(){});
}
function admLoadRematesList() {
  supa.from('remates').select('*').order('creado_en', {ascending: false}).then(function(res) {
    var data = res.data || [];
    var sel = document.getElementById('adm-remate-sel');
    sel.innerHTML = '<option value="">— Seleccionar remate —</option>';
    if (!data.length) return;
    admRematesTC = {};
    data.forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = (r.nombre || ('Remate '+(r.fecha||'')));
      sel.appendChild(opt);
      if (r.tc != null) admRematesTC[r.id] = r.tc;
      admRematesMon[r.id] = r.moneda || ((r.nombre||'').indexOf('(Bs.)') >= 0 ? 'BOB' : 'USD');
    });
    var saved = localStorage.getItem('agacon_remateId');
    if (saved && data.find(function(r){return r.id===saved;})) { sel.value = saved; admLoadRemate(saved); }
  });
}

var _admPoller = null;
function admUpdateResumenFrame() {
  var f = document.getElementById('resumen-frame');
  if (!f || !admRemateId) return;
  var tc  = parseFloat(document.getElementById('adm-tc').value) || 9.80;
  var com = parseFloat(document.getElementById('adm-com').value) || 3;
  var url = 'resumen.html?remate=' + encodeURIComponent(admRemateId) + '&tc=' + tc + '&com=' + com + '&mon=' + (admRematesMon[admRemateId] || admMoneda || 'USD');
  var abs = new URL(url, window.location.href).href;
  // Sólo recargar el iframe si cambió el remate/tc/comisión (evita parpadeo)
  if (f.getAttribute('data-loaded') !== abs) { f.src = url; f.setAttribute('data-loaded', abs); }
}
function admLoadRemate(id) {
  if (!id) return;
  admRemateId = id;
  admMoneda = admRematesMon[id] || 'USD';
  var esBob = admMoneda === 'BOB';
  // Encabezados de tablas según moneda (la columna de conversión a Bs. solo aplica en $us)
  var hTot = document.getElementById('adm-h-comp-tot');
  if (hTot) hTot.textContent = 'Total ' + (esBob ? 'Bs.' : '$us');
  var hBsC = document.getElementById('adm-h-comp-bs');
  if (hBsC) hBsC.style.display = esBob ? 'none' : '';
  var hBsV = document.getElementById('adm-h-vend-bs');
  if (hBsV) hBsV.style.display = esBob ? 'none' : '';
  // En remates en Bs. el T/C no interviene en los cálculos: se atenúa como referencia
  var tcWrap = document.getElementById('adm-tc');
  if (tcWrap) { tcWrap.style.opacity = esBob ? '.35' : '1'; tcWrap.title = esBob ? 'Este remate es en Bs.: el T/C no se aplica' : ''; }
  // Cargar el tipo de cambio guardado de ese remate (si lo tiene)
  if (admRematesTC[id] != null) {
    var tcInp = document.getElementById('adm-tc');
    if (tcInp) tcInp.value = admRematesTC[id];
  }
  admUpdateResumenFrame();
  if (_admPoller) clearInterval(_admPoller);
  function fetchAndRender() {
    supaGetLotes(id).then(function(lotes) {
      admLotes = lotes.filter(function(l){return l.saved;});
      admRecalc();
    });
  }
  fetchAndRender();
  _admPoller = setInterval(fetchAndRender, 5000);
}

function admRecalc() {
  var tc=parseFloat(document.getElementById('adm-tc').value)||6.96;
  var com=parseFloat(document.getElementById('adm-com').value)/100||0.03;
  var cab=admLotes.reduce(function(a,l){return a+(l.cantidad||0);},0);
  var monto=admLotes.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var sinComp=admLotes.filter(function(l){return !l.comprador;}).length;
  setText('as-lotes',admLotes.length);setText('as-cabezas',cab);
  setText('as-monto',admS()+monto.toLocaleString());
  setText('as-comision',admS()+(monto*com*2).toFixed(0));
  setText('as-sincomp',sinComp);
  admRenderCompradores(tc,com);
  admRenderPlataforma(tc);
  admRenderVendedores(tc,com);
  admRenderDefensas();
  admRenderResumen(tc,com);
}

function admRenderCompradores(tc,com) {
  var byComp={};
  // Agrupar por nombre+CI para distinguir menonitas
  admLotes.forEach(function(l){
    if(lotEsDefensa(l)) return; // una defensa no cuenta como compra (se muestra en su pestaña)
    if(l.otraPlataforma) return; // las compras por plataforma van en su propia pestaña
    var nombre=(l.comprador||'SIN COMPRADOR').trim();
    var ci=(l.compradorCI||'').trim();
    var k=ci?nombre+'||'+ci:nombre;
    if(!byComp[k])byComp[k]=[];
    byComp[k].push(l);
  });
  var tbody=document.getElementById('adm-tbody-comp');tbody.innerHTML='';
  Object.entries(byComp).forEach(function(entry){
    var key=entry[0],rows=entry[1],n=1,stM=0,stC=0,stT=0,stCant=0;
    var comp=rows[0].comprador||'SIN COMPRADOR';
    var ci=rows[0].compradorCI||'';
    rows.forEach(function(l){
      var m=(l.precio||0)*(l.cantidad||0),c=m*com,t=m+c;
      stM+=m;stC+=c;stT+=t;stCant+=l.cantidad||0;
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+n+'</td><td>'+comp+'</td><td style="color:var(--muted);font-size:.85rem">'+ci+'</td><td>'+l.categoria+'</td><td>'+l.lote+'</td><td>'+l.cantidad+'</td><td>'+admS()+(l.precio||0)+'</td><td>'+admS()+m.toLocaleString()+'</td><td style="color:var(--gold)">'+admS()+c.toFixed(2)+'</td><td style="font-weight:700;color:var(--green)">'+admS()+t.toFixed(2)+'</td>'+admBsCell(t,tc);
      tbody.appendChild(tr);n++;
    });
    var tr=document.createElement('tr');tr.className='subtotal';
    tr.innerHTML='<td colspan="3">TOTAL — '+comp+(ci?' (CI: '+ci+')':'')+'</td><td></td><td>'+stCant+'</td><td>—</td><td>'+admS()+stM.toLocaleString()+'</td><td>'+admS()+stC.toFixed(2)+'</td><td>'+admS()+stT.toFixed(2)+'</td>'+admBsCell(stT,tc);
    tbody.appendChild(tr);
  });
}

// Pestaña Plataforma: compras "mediante otra plataforma" — 3% total, 2% plataforma, 1% remate
function admRenderPlataforma(tc) {
  var tbody=document.getElementById('adm-tbody-plat'); if(!tbody) return;
  tbody.innerHTML='';
  var lots=admLotes.filter(function(l){ return l.otraPlataforma && l.comprador && !lotEsDefensa(l); });
  if(!lots.length){var tr0=document.createElement('tr');var td0=document.createElement('td');td0.colSpan=11;td0.style.cssText='text-align:center;color:#888;padding:1.5rem';td0.textContent='No hay compras mediante otra plataforma';tr0.appendChild(td0);tbody.appendChild(tr0);return;}
  var n=1, tM=0, t3=0, t2=0, t1=0;
  lots.forEach(function(l){
    var m=(l.precio||0)*(l.cantidad||0), c3=m*0.03, c2=m*0.02, c1=m*0.01;
    tM+=m; t3+=c3; t2+=c2; t1+=c1;
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+n+'</td><td>'+(l.comprador||'—')+'</td><td style="color:var(--muted);font-size:.85rem">'+(l.compradorCI||'')+'</td><td>'+l.categoria+'</td><td>'+l.lote+'</td><td>'+l.cantidad+'</td><td>'+admS()+(l.precio||0)+'</td><td>'+admS()+m.toLocaleString()+'</td><td style="color:var(--gold)">'+admS()+c3.toFixed(2)+'</td><td style="color:var(--red2)">'+admS()+c2.toFixed(2)+'</td><td style="font-weight:700">'+admS()+c1.toFixed(2)+'</td>';
    tbody.appendChild(tr); n++;
  });
  var trT=document.createElement('tr');trT.className='subtotal';
  trT.innerHTML='<td colspan="7">TOTALES</td><td>'+admS()+tM.toLocaleString()+'</td><td>'+admS()+t3.toFixed(2)+'</td><td>'+admS()+t2.toFixed(2)+'</td><td>'+admS()+t1.toFixed(2)+'</td>';
  tbody.appendChild(trT);
}

function admRenderVendedores(tc,com) {
  var byVend={};
  admLotes.forEach(function(l){var k=l.propietario||'SIN PROP';if(!byVend[k])byVend[k]=[];byVend[k].push(l);});
  var tbody=document.getElementById('adm-tbody-vend');tbody.innerHTML='';
  Object.entries(byVend).forEach(function(entry){
    var vend=entry[0],rows=entry[1],n=1,stM=0,stC=0,stT=0,stCant=0;
    rows.forEach(function(l){
      var m=(l.precio||0)*(l.cantidad||0),c=m*com,t=m-c;
      stM+=m;stC+=c;stT+=t;stCant+=l.cantidad||0;
      var tr=document.createElement('tr');
      var ciComp=l.compradorCI?'<small style="color:var(--muted)">'+l.compradorCI+'</small>':'<small style="color:#555">—</small>';
      tr.innerHTML='<td>'+n+'</td><td>'+vend+'</td><td>'+ciComp+'</td><td>'+l.categoria+'</td><td>'+l.lote+'</td><td>'+l.cantidad+'</td><td>'+admS()+(l.precio||0)+'</td><td>'+admS()+m.toLocaleString()+'</td><td style="color:var(--red2)">'+admS()+c.toFixed(2)+'</td><td style="font-weight:700;color:var(--green)">'+admS()+t.toFixed(2)+'</td>'+admBsCell(t,tc);
      tbody.appendChild(tr);n++;
    });
    var tr=document.createElement('tr');tr.className='subtotal';
    tr.innerHTML='<td colspan="3">TOTAL — '+vend+'</td><td></td><td>'+stCant+'</td><td>—</td><td>'+admS()+stM.toLocaleString()+'</td><td>'+admS()+stC.toFixed(2)+'</td><td>'+admS()+stT.toFixed(2)+'</td>'+admBsCell(stT,tc);
    tbody.appendChild(tr);
  });
}

function admRenderDefensas() {
  // Defensas = lotes marcados como defensa (bandera o por CI) O sin comprador
  var sinComp=admLotes.filter(function(l){return lotEsDefensa(l) || !l.comprador;});
  var tbody=document.getElementById('adm-tbody-def');tbody.innerHTML='';
  if(!sinComp.length){var tr=document.createElement('tr');var td=document.createElement('td');td.colSpan=8;td.style.cssText='text-align:center;color:#888;padding:1.5rem';td.textContent='No hay defensas';tr.appendChild(td);tbody.appendChild(tr);return;}
  var socios   = sinComp.filter(function(l){return (l.defensaCom!=null?l.defensaCom:0.5) <= 0.5;});
  var noSocios = sinComp.filter(function(l){return (l.defensaCom!=null?l.defensaCom:0.5) >  0.5;});
  function seccion(titulo, lots, pct){
    if(!lots.length) return;
    var trH=document.createElement('tr');
    trH.innerHTML='<td colspan="8" style="background:#1F4E79;color:#fff;font-weight:800;letter-spacing:1px;padding:.45rem .7rem">'+titulo+'</td>';
    tbody.appendChild(trH);
    var st=0, n=1;
    lots.forEach(function(l){
      var m=(l.precio||0)*(l.cantidad||0), c=m*(pct/100); st+=c;
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+n+'</td><td>'+(l.propietario||'—')+'</td><td>'+l.categoria+'</td><td>'+l.lote+'</td><td>'+l.cantidad+'</td><td>'+admS()+(l.precio||0)+'</td><td>'+admS()+m.toLocaleString()+'</td><td style="color:var(--gold)">'+pct+'% — '+admS()+c.toFixed(2)+'</td>';
      tbody.appendChild(tr); n++;
    });
    var trS=document.createElement('tr');trS.className='subtotal';
    trS.innerHTML='<td colspan="7">SUBTOTAL '+titulo+'</td><td>'+admS()+st.toFixed(2)+'</td>';
    tbody.appendChild(trS);
  }
  seccion('DEFENSAS SOCIOS (0.5%)', socios, 0.5);
  seccion('DEFENSAS NO SOCIOS (1%)', noSocios, 1);
}

function admRenderResumen(tc,com) {
  var defensas = admLotes.filter(function(l){return lotEsDefensa(l) || !l.comprador;});
  var normales = admLotes.filter(function(l){return !lotEsDefensa(l) && l.comprador;});
  var monto    = admLotes.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var mNoPlat  = normales.filter(function(l){return !l.otraPlataforma;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var mPlat    = normales.filter(function(l){return  l.otraPlataforma;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var mVend    = normales.reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var mDefSoc  = defensas.filter(function(l){return (l.defensaCom!=null?l.defensaCom:0.5)<=0.5;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var mDefNo   = defensas.filter(function(l){return (l.defensaCom!=null?l.defensaCom:0.5)>0.5;}).reduce(function(a,l){return a+(l.precio||0)*(l.cantidad||0);},0);
  var cVend=mVend*com, cComp=mNoPlat*com, cPlat=mPlat*0.01, cDefS=mDefSoc*0.005, cDefN=mDefNo*0.01;
  var totalIng = cVend+cComp+cPlat+cDefS+cDefN;
  function fila(lbl,usd,estilo){return '<tr'+(estilo?' style="'+estilo+'"':'')+'><td>'+lbl+'</td><td style="text-align:right;color:var(--gold)'+(estilo?';color:var(--green);font-weight:900':'')+'">'+admS()+usd.toFixed(2)+'</td></tr>';}
  document.getElementById('adm-resumen').innerHTML=
    '<table style="width:100%">'+
    '<tr><td>Monto total operado</td><td style="text-align:right;color:var(--gold);font-weight:700">'+admS()+monto.toLocaleString()+'</td></tr>'+
    fila('Comisión compradores ('+(com*100).toFixed(1)+'%)', cComp)+
    fila('Comisión compradores plataforma (1% remate)', cPlat)+
    fila('Comisión vendedores ('+(com*100).toFixed(1)+'%)', cVend)+
    fila('Defensa socios (0.5%)', cDefS)+
    fila('Defensa no socios (1%)', cDefN)+
    fila('TOTAL INGRESOS COMISIONES '+(admMoneda==='BOB'?'Bs.':'$us'), totalIng, 'border-top:1px solid var(--border);font-weight:900')+
    (admMoneda==='BOB' ? '' : '<tr><td>TOTAL INGRESOS COMISIONES Bs.</td><td style="text-align:right;color:var(--green);font-weight:900">Bs.'+Math.round(totalIng*tc).toLocaleString()+'</td></tr>')+
    '<tr><td style="padding-top:.6rem;color:var(--muted);font-size:.78rem">Nota: el 2% de las compras por plataforma ('+admS()+(mPlat*0.02).toFixed(2)+') va a la plataforma y no cuenta como ingreso.</td><td></td></tr>'+
    '<tr><td>Lotes vendidos</td><td style="text-align:right">'+admLotes.length+'</td></tr>'+
    '<tr><td>Total cabezas</td><td style="text-align:right">'+admLotes.reduce(function(a,l){return a+(l.cantidad||0);},0)+'</td></tr>'+
    '<tr><td>Sin comprador / Defensa</td><td style="text-align:right;color:var(--red)">'+defensas.length+'</td></tr>'+
    (admMoneda==='BOB' ? '' : '<tr><td>Tipo de cambio</td><td style="text-align:right">Bs.'+tc+'/$us</td></tr>')+
    '</table>';
}

function admShowTab(tab,btn) {
  document.querySelectorAll('.tab-content').forEach(function(t){t.classList.remove('on');});
  document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
  document.getElementById('adm-tab-'+tab).classList.add('on');
  btn.classList.add('on');
}
