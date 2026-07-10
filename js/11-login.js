/* ═══════════════════════════════════════════════
   AGACON — 11-login.js
   Login con usuarios (tabla Supabase) — reemplaza el menú.
   Cada usuario entra directo a su módulo según su rol.
   ═══════════════════════════════════════════════ */

var AUTH_KEY = 'agacon_auth';
var authUser = null;   // { usuario, rol, nombre }

// ── Persistencia de sesión ──
// Con "Recordarme" se usa localStorage (sobrevive a cerrar el navegador);
// sin marcar, sessionStorage (dura solo mientras la pestaña esté abierta).
function saveAuth(user, remember) {
  try {
    var raw = JSON.stringify(user);
    if (remember) { localStorage.setItem(AUTH_KEY, raw); sessionStorage.removeItem(AUTH_KEY); }
    else          { sessionStorage.setItem(AUTH_KEY, raw); localStorage.removeItem(AUTH_KEY); }
  } catch (e) {}
}
function readAuth() {
  try {
    var raw = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function clearAuth() {
  try { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
}

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
function enterApp(user, remember) {
  authUser = user;
  saveAuth(user, remember);
  var lg = document.getElementById('login-screen');
  if (lg) lg.style.display = 'none';
  paintAuthBadges();
  routeToRole(user.rol);
}

// Mostrar / ocultar la contraseña
function toggleLoginPassword() {
  var inp = document.getElementById('login-password');
  var svg = document.getElementById('login-eye-svg');
  if (!inp) return;
  var show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  if (svg) {
    // ojo abierto vs ojo tachado
    svg.innerHTML = show
      ? '<path d="M17.94 17.94A10.4 10.4 0 0 1 12 20C5 20 1 12 1 12a19 19 0 0 1 5.06-5.94M9.9 4.24A9.6 9.6 0 0 1 12 4c7 0 11 8 11 8a19 19 0 0 1-2.16 3.19M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>'
      : '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
  inp.focus();
}

// "¿Olvidaste tu contraseña?"
function loginForgot() {
  var msg = 'Para restablecer tu contraseña, contactá al administrador del sistema.';
  try { toast(msg); } catch (e) {
    var err = document.getElementById('login-error');
    if (err) { err.style.color = '#1B8A4A'; err.textContent = msg;
      setTimeout(function(){ err.style.color = ''; err.textContent = ''; }, 5000); }
  }
}

// Verificar credenciales contra Supabase (función RPC agacon_login)
async function doLogin() {
  var usuario  = (document.getElementById('login-user').value || '').trim();
  var password = document.getElementById('login-password').value || '';
  var remEl    = document.getElementById('login-remember');
  var remember = remEl ? remEl.checked : false;
  var errEl    = document.getElementById('login-error');
  var btn      = document.getElementById('login-btn');
  if (errEl) { errEl.style.color = ''; errEl.textContent = ''; }

  if (!usuario || !password) {
    if (errEl) errEl.textContent = 'Ingresá usuario y contraseña';
    return;
  }

  btn.disabled = true;
  var prevHTML = btn.innerHTML;
  btn.innerHTML = 'Verificando…';
  try {
    var res = await supa.rpc('agacon_login', { p_usuario: usuario, p_password: password });
    if (res.error) {
      console.error('[AGACON] login error:', res.error);
      if (errEl) errEl.textContent = 'Error de conexión. Intentá de nuevo.';
    } else if (res.data && res.data.length > 0) {
      var row = res.data[0];
      enterApp({ usuario: usuario, rol: row.rol, nombre: row.nombre || usuario }, remember);
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
    btn.innerHTML = prevHTML;
  }
}

// Cerrar sesión → volver al login
function logout() {
  authUser = null;
  clearAuth();
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
    if (src) {
      document.querySelectorAll('.js-agacon-logo').forEach(function(img) {
        img.setAttribute('src', src);
      });
    }

    // Restaurar sesión si existe
    var saved = readAuth();
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
