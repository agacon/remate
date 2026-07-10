/* ═══════════════════════════════════════════════
   AGACON — 11-login.js
   Login con usuarios (tabla Supabase) — reemplaza el menú.
   Cada usuario entra directo a su módulo según su rol.
   ═══════════════════════════════════════════════ */

var AUTH_KEY = 'agacon_auth';
var authUser = null;   // { usuario, rol, nombre }

// Rol → pantalla del sistema
function routeToRole(rol) {
  if (rol === 'admin')            goTo('admin');
  else if (rol === 'compradores') goTo('compradores');
  else                            goTo('operador');
}

// Pintar el nombre del usuario conectado en las barras superiores (si hay hueco)
function paintAuthBadges() {
  if (!authUser) return;
  ['op-user-badge', 'adm-user-badge', 'comp-user-badge'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '👤 ' + (authUser.nombre || authUser.usuario);
  });
}

// Mostrar la pantalla de login (oculta menú y todas las pantallas)
function showLogin() {
  var menu = document.getElementById('menu-screen');
  if (menu) menu.style.display = 'none';
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  if (typeof publicPollInterval !== 'undefined' && publicPollInterval) {
    clearInterval(publicPollInterval); publicPollInterval = null;
  }
  var lg = document.getElementById('login-screen');
  if (lg) lg.style.display = 'flex';
  var err = document.getElementById('login-error'); if (err) err.textContent = '';
  var pw  = document.getElementById('login-password'); if (pw) pw.value = '';
  var us  = document.getElementById('login-user');
  setTimeout(function() { if (us && !us.value) us.focus(); }, 60);
  try { checkConnection(); } catch (e) {}
}

// Entrar al sistema con un usuario ya verificado
function enterApp(user) {
  authUser = user;
  try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(user)); } catch (e) {}
  var lg = document.getElementById('login-screen');
  if (lg) lg.style.display = 'none';
  paintAuthBadges();
  routeToRole(user.rol);
}

// Verificar credenciales contra Supabase (función RPC agacon_login)
async function doLogin() {
  var usuario  = (document.getElementById('login-user').value || '').trim();
  var password = document.getElementById('login-password').value || '';
  var errEl    = document.getElementById('login-error');
  var btn      = document.getElementById('login-btn');
  if (errEl) errEl.textContent = '';

  if (!usuario || !password) {
    if (errEl) errEl.textContent = 'Ingresá usuario y contraseña';
    return;
  }

  btn.disabled = true;
  var prevTxt = btn.textContent;
  btn.textContent = 'Verificando…';
  try {
    var res = await supa.rpc('agacon_login', { p_usuario: usuario, p_password: password });
    if (res.error) {
      console.error('[AGACON] login error:', res.error);
      if (errEl) errEl.textContent = 'Error de conexión. Intentá de nuevo.';
    } else if (res.data && res.data.length > 0) {
      var row = res.data[0];
      enterApp({ usuario: usuario, rol: row.rol, nombre: row.nombre || usuario });
    } else {
      if (errEl) errEl.textContent = '❌ Usuario o contraseña incorrectos';
      var pw = document.getElementById('login-password');
      if (pw) { pw.value = ''; pw.focus(); }
    }
  } catch (e) {
    console.error('[AGACON] login exception:', e);
    if (errEl) errEl.textContent = 'Error inesperado. Intentá de nuevo.';
  } finally {
    btn.disabled = false;
    btn.textContent = prevTxt;
  }
}

// Cerrar sesión → volver al login
function logout() {
  authUser = null;
  try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
  try { if (typeof stopLotesPolling === 'function') stopLotesPolling(); } catch (e) {}
  showLogin();
}

// ════════════════════════════════════════
//  INICIALIZACIÓN
// ════════════════════════════════════════
(function() {
  // La ventana pública (?pantalla=publica) NO pasa por login
  var params = new URLSearchParams(window.location.search);
  if (params.get('pantalla') === 'publica') return;

  function init() {
    // Reusar el logo desde una imagen ya presente (evita duplicar el base64)
    var any = document.querySelector('#menu-screen img, .topbar img, .brand-logo');
    var src = any ? any.getAttribute('src') : '';
    var lim = document.getElementById('login-logo-img');
    if (lim && src) lim.setAttribute('src', src);

    // Restaurar sesión si existe (sobrevive a un refresh de la pestaña)
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); } catch (e) {}
    if (saved && saved.rol) {
      authUser = saved;
      var lg = document.getElementById('login-screen');
      if (lg) lg.style.display = 'none';
      paintAuthBadges();
      routeToRole(saved.rol);
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
