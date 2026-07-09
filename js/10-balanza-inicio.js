/* ═══════════════════════════════════════════════
   AGACON — 10-balanza-inicio.js
   Balanza por puerto serie e inicialización del sistema
   ═══════════════════════════════════════════════ */
function balanzaToggle() {
  var panel = document.getElementById('balanza-panel');
  var showing = panel.style.display === 'flex';
  panel.style.display = showing ? 'none' : 'flex';
  panel.style.flexDirection = 'column';
}

async function balanzaConnect() {
  if (!navigator.serial) {
    toast('Web Serial no soportado. Usa Chrome o Edge.', true);
    return;
  }
  try {
    var baud = parseInt(document.getElementById('bal-baud').value) || 9600;
    balPort = await navigator.serial.requestPort();
    await balPort.open({
      baudRate:    baud,
      dataBits:    8,
      stopBits:    1,
      parity:      'none',
      flowControl: 'none'
    });
    balActiva = true;
    document.getElementById('bal-status').textContent      = '● Conectada';
    document.getElementById('bal-status').style.color      = 'var(--green)';
    document.getElementById('bal-connect-btn').style.display    = 'none';
    document.getElementById('bal-disconnect-btn').style.display = 'inline';
    document.getElementById('btn-balanza').style.borderColor    = 'var(--green)';
    document.getElementById('btn-balanza').style.color          = 'var(--green)';
    document.getElementById('bal-status').textContent = '● Conectada — el peso se actualiza en tiempo real';
    document.getElementById('bal-status').style.color = 'var(--green)';
    toast('Balanza conectada ✓');
    balanzaRead();
  } catch(err) {
    toast('Error al conectar: ' + err.message, true);
  }
}

async function balanzaRead() {
  // Read raw bytes - SK330 sends char by char
  balReader = balPort.readable.getReader();
  var textDecoder = new TextDecoder('ascii');
  try {
    while (balActiva) {
      var result = await balReader.read();
      if (result.done) break;
      // Decode bytes to string
      var chunk = textDecoder.decode(result.value);
      balBuffer += chunk;
      balanzaParsear();
    }
  } catch(err) {
    if (balActiva) toast('Error leyendo balanza: ' + err.message, true);
  }
}

function balanzaParsear() {
  // Busca el próximo fin de línea aceptando \r, \n o \r\n
  function nextEnd(buf) {
    for (var i = 0; i < buf.length; i++) {
      var c = buf.charCodeAt(i);
      if (c === 10 || c === 13) { // \n o \r
        return { end: i, skip: (c === 13 && buf.charCodeAt(i + 1) === 10) ? 2 : 1 };
      }
    }
    return { end: -1, skip: 1 };
  }

  var e = nextEnd(balBuffer);
  while (e.end >= 0) {
    var line = balBuffer.substring(0, e.end).trim();
    balBuffer = balBuffer.substring(e.end + e.skip);

    if (line.length > 0) {
      if (line.indexOf('OL') >= 0) {
        // sobrecarga: ignorar
      } else {
        // Extraer el primer número de la línea (tolera prefijos, signos y unidades)
        var m = line.replace(/[^0-9.\-]+/g, ' ').trim().match(/\d+(?:\.\d+)?/);
        var num = m ? parseFloat(m[0]) : NaN;
        if (!isNaN(num) && num >= 0 && num < 99999) {
          balPesoActual = Math.round(num);
          balanzaUpdateUI();
          console.log('[BALANZA] Peso:', balPesoActual, 'kg | linea:', line);
        } else {
          // Llegan datos pero no se reconoce el formato → mostrarlo para diagnosticar
          console.log('[BALANZA] linea NO reconocida:', line);
          var st = document.getElementById('bal-status');
          if (st) { st.textContent = '● Recibiendo (formato no reconocido): ' + line; st.style.color = 'var(--gold)'; }
        }
      }
    }
    e = nextEnd(balBuffer);
  }

  // Si llegan datos pero nunca hay salto de línea, mostrar lo crudo para diagnosticar
  if (balBuffer.length > 80) {
    var raw = balBuffer.slice(-40);
    console.log('[BALANZA] datos sin salto de linea:', raw);
    var st2 = document.getElementById('bal-status');
    if (st2) { st2.textContent = '● Recibiendo datos (sin salto de línea): ' + raw; st2.style.color = 'var(--gold)'; }
    balBuffer = balBuffer.slice(-40);
  }
}

function balanzaUpdateUI() {
  // Mostrar el peso en tiempo real SIEMPRE, aunque todavía no haya un lote cargado
  var pesoField = document.getElementById('f-peso');
  if (pesoField) pesoField.value = balPesoActual;
  var status = document.getElementById('bal-status');
  if (status && balActiva) {
    status.textContent = '● Conectada — Peso: ' + balPesoActual + ' kg';
    status.style.color = 'var(--green)';
  }
  // Actualizar el lote y la pantalla pública sólo si hay un lote activo
  if (lots[cur]) {
    lots[cur].peso = balPesoActual;
    onPesoChange(); // triggers renderPublic which updates localStorage + public screen
  }
}

function balanzaCapturar() {
  if (!balPesoActual) { toast('No hay peso para capturar', true); return; }
  var cant = lots[cur] ? (lots[cur].cantidad || 1) : 1;
  var prom = Math.round(balPesoActual / cant);

  // Fill peso field
  var pesoField = document.getElementById('f-peso');
  if (pesoField) {
    pesoField.value = balPesoActual;
    onPesoChange();
  }
  toast('Peso capturado: ' + balPesoActual + ' kg (Prom: ' + prom + ' kg/animal)');
}

function balanzaReset() {
  balPesoActual = 0;
  balanzaUpdateUI();
}

async function balanzaDisconnect() {
  balActiva = false;
  try {
    if (balReader) { await balReader.cancel(); balReader = null; }
    if (balPort)   { await balPort.close();   balPort   = null; }
  } catch(e) {}
  document.getElementById('bal-status').textContent           = '● Desconectada';
  document.getElementById('bal-status').style.color           = 'var(--muted)';
  document.getElementById('bal-connect-btn').style.display    = 'inline';
  document.getElementById('bal-disconnect-btn').style.display = 'none';
  document.getElementById('btn-balanza').style.borderColor    = '#1a9ad6';
  document.getElementById('btn-balanza').style.color          = '#1a9ad6';
  toast('Balanza desconectada');
}

// Auto-update promedio when navigating lots
var _origRenderOp = typeof renderOp === 'function' ? renderOp : null;

// ════════════════════════════════════════
// Auto-open public screen if URL param present
(function() {
  var params = new URLSearchParams(window.location.search);
  if (params.get('pantalla') === 'publica') {
    // This is the public window - go straight to public and poll localStorage
    document.addEventListener('DOMContentLoaded', function() {
      // Hide menu, show public directly
      document.getElementById('menu-screen').style.display = 'none';
      document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
      var el = document.getElementById('screen-public');
      if (el) el.classList.add('active');
      // Start polling localStorage for operator updates
      setInterval(function() {
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
    });
  }
})();

// Public screen opened via showPublic() button in operator

// Load PINs from Supabase on startup
configGet('pins').then(function(data) {
  if (!data) return;
  _pins.operador    = (data.operador    && String(data.operador).trim())    || '';
  _pins.compradores = (data.compradores && String(data.compradores).trim()) || '';
  _pins.admin       = (data.admin       && String(data.admin).trim())       || '';
  console.log('[AGACON] PINs cargados - op:', !!_pins.operador, 'comp:', !!_pins.compradores, 'adm:', !!_pins.admin);
});
