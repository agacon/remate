/* AGACON — resumen.js — tarjetas y gráficos del panel Resumen */

  // ── Config Supabase (misma base que el index) ──
  var SUPA_URL = 'https://uybelqzyrhdhvbncypwf.supabase.co';
  var SUPA_KEY = 'sb_publishable_3PzMEHMnRa3Ag68xeUwysQ_CS4ymo8N';
  var supa = supabase.createClient(SUPA_URL, SUPA_KEY);

  // ── Parámetros recibidos por URL ──
  var P = new URLSearchParams(location.search);
  var remateId = P.get('remate') || '';
  var tc  = parseFloat(P.get('tc'))  || 6.96;
  var com = (parseFloat(P.get('com')) || 3) / 100;

  function fmt(n){ return (n||0).toLocaleString('es-BO'); }
  function setT(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; }
  function showErr(msg){ var e=document.getElementById('err'); e.style.display='block'; e.textContent=msg; }

  function render(lotes){
    var cab   = lotes.reduce(function(a,l){ return a+(+l.cantidad||0); },0);
    var monto = lotes.reduce(function(a,l){ return a+(+l.precio||0)*(+l.cantidad||0); },0);
    var sinComp = lotes.filter(function(l){ return !l.comprador; }).length;

    setT('as-lotes', lotes.length);
    setT('as-cabezas', cab);
    setT('as-monto', '$'+fmt(monto));
    setT('as-sincomp', sinComp);

    renderPie(lotes);
    var totalIngresos = renderBars(lotes); // total de comisiones que queda para el remate
    setT('as-comision', '$'+totalIngresos.toFixed(0));
  }

  // Detección de defensa: bandera o CI comprador = CI propietario (misma regla que el index)
  function esDefensa(l){
    if (l.es_defensa) return true;
    if (!l.comprador) return false;
    var p=String(l.ci_propietario||'').replace(/[^0-9]/g,'');
    var c=String(l.comprador_ci||'').replace(/[^0-9]/g,'');
    return !!(p && c && p.length>=6 && c.length>=6 && p===c);
  }

  function renderBars(lotes){
    var barsEl = document.getElementById('bars');
    var totEl  = document.getElementById('bars-total');
    var emptyEl= document.getElementById('bars-empty');

    var ing = { compra:0, venta:0, plataforma:0, defSocio:0, defNoSocio:0 };
    lotes.forEach(function(l){
      var m=(+l.precio||0)*(+l.cantidad||0);
      if(!m) return;
      if (esDefensa(l)) {
        // Defensa: solo paga la comisión de defensa (0.5% socio / 1% no socio)
        var pct = (l.defensa_com!=null ? +l.defensa_com : 0.5);
        if (pct === 0.5) ing.defSocio    += m*0.005;
        else             ing.defNoSocio  += m*0.01;
      } else if (l.comprador) {
        ing.venta += m*com; // lado vendedor siempre com%
        if (l.otra_plataforma) ing.plataforma += m*0.01; // remate se queda con 1%
        else                   ing.compra     += m*com;
      }
    });

    var items = [
      { name:'Compras ('+(com*100).toFixed(0)+'%)',      val:ing.compra,     color:'#2E75B6' },
      { name:'Ventas ('+(com*100).toFixed(0)+'%)',       val:ing.venta,      color:'#1B8A4A' },
      { name:'Otra plataforma (1%)',                     val:ing.plataforma, color:'#7E57C2' },
      { name:'Defensa socios (0.5%)',                    val:ing.defSocio,   color:'#B0750A' },
      { name:'Defensa no socios (1%)',                   val:ing.defNoSocio, color:'#C0392B' }
    ];
    var total = items.reduce(function(a,c){ return a+c.val; },0);
    var max   = Math.max.apply(null, items.map(function(c){ return c.val; }));

    if (!total) { barsEl.innerHTML=''; totEl.textContent='$0'; emptyEl.style.display='block'; return 0; }
    emptyEl.style.display='none';

    barsEl.innerHTML = items.map(function(c){
      var w = max ? (c.val/max*100) : 0;
      return '<div class="bar-row">' +
             '<span class="bar-name">'+c.name+'</span>' +
             '<div class="bar-track"><div class="bar-fill" style="width:'+w.toFixed(1)+'%;background:'+c.color+'"></div></div>' +
             '<span class="bar-val">$'+c.val.toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2})+'</span>' +
             '</div>';
    }).join('');
    totEl.textContent = '$'+total.toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
    return total;
  }

  var PALETTE = ['#2E75B6','#1B8A4A','#B0750A','#C0392B','#7E57C2','#00897B','#EF6C00','#5C6BC0','#D81B60','#8D6E63','#039BE5','#7CB342'];

  function renderPie(lotes){
    var pie = document.getElementById('pie');
    var legend = document.getElementById('legend');
    var emptyEl = document.getElementById('chart-empty');

    // Agrupar por categoría: cantidad de LOTES y monto generado por cada una
    var byCat = {};
    lotes.forEach(function(l){
      var cat = (l.categoria || '').toString().trim() || 'Sin categoría';
      if(!byCat[cat]) byCat[cat] = { lotes:0, monto:0 };
      byCat[cat].lotes += 1;
      byCat[cat].monto += (+l.precio||0)*(+l.cantidad||0);
    });
    var cats = Object.keys(byCat)
      .map(function(k){ return { name:k, val:byCat[k].lotes, monto:byCat[k].monto }; })
      .filter(function(c){ return c.val > 0; })
      .sort(function(a,b){ return b.val - a.val; });
    var total = cats.reduce(function(a,c){ return a + c.val; }, 0);

    if (!total) {
      pie.style.display = 'none';
      legend.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    pie.style.display = 'block';
    emptyEl.style.display = 'none';

    var acc = 0, stops = [], legHtml = '';
    cats.forEach(function(c, i){
      var color = PALETTE[i % PALETTE.length];
      var pct = c.val / total * 100;
      var start = acc, end = acc + pct; acc = end;
      // último segmento cierra en 100 para evitar huecos por redondeo
      if (i === cats.length - 1) end = 100;
      stops.push(color + ' ' + start.toFixed(3) + '% ' + end.toFixed(3) + '%');
      legHtml += '<div class="leg-item">' +
                 '<span class="leg-swatch" style="background:' + color + '"></span>' +
                 '<span class="leg-name">' + c.name.toLowerCase() + '</span>' +
                 '<span class="leg-val">' + pct.toFixed(1) + '% · ' + c.val + ' lote' + (c.val !== 1 ? 's' : '') + ' · $' + fmt(c.monto) + '</span>' +
                 '</div>';
    });
    pie.style.background = 'conic-gradient(' + stops.join(',') + ')';
    legend.innerHTML = legHtml;
  }

  function load(){
    if(!remateId){ showErr('No se recibió el remate. Seleccioná un remate en la barra de arriba.'); return; }
    supa.from('lotes').select('*').eq('remate_id', remateId).then(function(res){
      if(res.error){ showErr('Error al cargar: '+res.error.message); return; }
      document.getElementById('err').style.display='none';
      var lotes = (res.data||[]).filter(function(l){ return l.saved; });
      render(lotes);
    });
  }

  load();
  setInterval(load, 5000); // auto-actualiza cada 5 s
