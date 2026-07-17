/* ═══════════════════════════════════════════════
   AGACON — 11-login.js
   Login con Supabase Auth (email + contraseña).
   El rol de cada usuario vive en sus metadatos
   (user_metadata.rol = 'admin' | 'operador' | 'compradores').
   ═══════════════════════════════════════════════ */

var authUser = null;                    // { email, rol, nombre }
var REMEMBER_KEY = 'agacon_remember';   // persistente (localStorage)
var TAB_KEY      = 'agacon_tab';        // vive solo en esta pestaña (sessionStorage)

// Rol → pantalla del sistema
function routeToRole(rol) {
  if (rol === 'admin')            goTo('admin');
  else if (rol === 'directiva')   goTo('admin');   // ve admin, restringido a Resumen
  else if (rol === 'compradores') goTo('compradores');
  else                            goTo('operador');
  if (rol === 'directiva' && typeof applyDirectivaMode === 'function') {
    setTimeout(applyDirectivaMode, 60);
  }
}

// Pintar el nombre del usuario conectado en las barras superiores
function paintAuthBadges() {
  if (!authUser) return;
  ['op-user-badge', 'adm-user-badge', 'comp-user-badge'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '👤 ' + (authUser.nombre || authUser.email);
  });
}

// Extraer datos útiles del usuario de Supabase Auth
function authUserFrom(u) {
  var meta = (u && u.user_metadata) || {};
  var app  = (u && u.app_metadata)  || {};
  return {
    email:  u.email || '',
    rol:    meta.rol || app.rol || null,
    nombre: meta.nombre || ''
  };
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
  var err = document.getElementById('login-error'); if (err) { err.style.color=''; err.textContent = ''; }
  var pw  = document.getElementById('login-password'); if (pw) pw.value = '';
  var us  = document.getElementById('login-user');
  setTimeout(function() { if (us && !us.value) us.focus(); }, 60);
  try { checkConnection(); } catch (e) {}
}

// Entrar al sistema con un usuario ya autenticado
function enterApp(user) {
  authUser = user;
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
    svg.innerHTML = show
      ? '<path d="M17.94 17.94A10.4 10.4 0 0 1 12 20C5 20 1 12 1 12a19 19 0 0 1 5.06-5.94M9.9 4.24A9.6 9.6 0 0 1 12 4c7 0 11 8 11 8a19 19 0 0 1-2.16 3.19M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>'
      : '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
  inp.focus();
}

// "¿Olvidaste tu contraseña?"
function loginForgot() {
  var msg = 'Contactá al administrador para restablecer tu contraseña.';
  try { toast(msg); } catch (e) {
    var err = document.getElementById('login-error');
    if (err) { err.style.color = '#1B8A4A'; err.textContent = msg;
      setTimeout(function(){ err.style.color = ''; err.textContent = ''; }, 5000); }
  }
}

// Iniciar sesión con Supabase Auth
async function doLogin() {
  var email    = (document.getElementById('login-user').value || '').trim().toLowerCase();
  var password = document.getElementById('login-password').value || '';
  var remEl    = document.getElementById('login-remember');
  var remember = remEl ? remEl.checked : false;
  var errEl    = document.getElementById('login-error');
  var btn      = document.getElementById('login-btn');
  if (errEl) { errEl.style.color = ''; errEl.textContent = ''; }

  if (!email || !password) {
    if (errEl) errEl.textContent = 'Ingresá email y contraseña';
    return;
  }

  btn.disabled = true;
  var prevHTML = btn.innerHTML;
  btn.innerHTML = 'Verificando…';
  try {
    var res = await supa.auth.signInWithPassword({ email: email, password: password });
    if (res.error) {
      var m = String(res.error.message || '');
      if (/invalid login credentials/i.test(m)) {
        if (errEl) errEl.textContent = '❌ Email o contraseña incorrectos';
        var pw = document.getElementById('login-password');
        if (pw) { pw.value = ''; pw.focus(); }
      } else {
        console.error('[AGACON] login error:', res.error);
        if (errEl) errEl.textContent = 'Error de conexión. Intentá de nuevo.';
      }
      return;
    }
    var user = authUserFrom(res.data.user);
    if (!user.rol) {
      // Usuario sin rol asignado en Supabase → no dejar entrar a ciegas
      if (errEl) errEl.textContent = 'Tu usuario no tiene rol asignado. Avisá al administrador.';
      try { await supa.auth.signOut(); } catch (e) {}
      return;
    }
    // "Recordarme": marca persistente; sin marcar, la sesión vale solo en esta pestaña
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, '1');
      else localStorage.removeItem(REMEMBER_KEY);
      sessionStorage.setItem(TAB_KEY, '1');
    } catch (e) {}
    enterApp(user);
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
  try { localStorage.removeItem(REMEMBER_KEY); sessionStorage.removeItem(TAB_KEY); } catch (e) {}
  try { if (typeof stopLotesPolling === 'function') stopLotesPolling(); } catch (e) {}
  try { supa.auth.signOut(); } catch (e) {}
  showLogin();
}

// ════════════════════════════════════════
//  INICIALIZACIÓN
// ════════════════════════════════════════
(function() {
  // La ventana pública (?pantalla=publica) NO pasa por login
  var params = new URLSearchParams(window.location.search);
  if (params.get('pantalla') === 'publica') return;

  async function init() {
    // Reusar el logo desde una imagen ya presente
    var any = document.querySelector('#menu-screen img, .topbar img, .brand-logo');
    var src = any ? any.getAttribute('src') : '';
    if (src) {
      document.querySelectorAll('.js-agacon-logo').forEach(function(img) {
        img.setAttribute('src', src);
      });
    }

    // Restaurar sesión de Supabase si corresponde
    var session = null;
    try {
      var r = await supa.auth.getSession();
      session = r && r.data ? r.data.session : null;
    } catch (e) {}

    if (session && session.user) {
      var remembered = false, sameTab = false;
      try {
        remembered = localStorage.getItem(REMEMBER_KEY) === '1';
        sameTab    = sessionStorage.getItem(TAB_KEY) === '1';
      } catch (e) {}
      var user = authUserFrom(session.user);
      if ((remembered || sameTab) && user.rol) {
        try { sessionStorage.setItem(TAB_KEY, '1'); } catch (e) {}
        var lg = document.getElementById('login-screen');
        if (lg) lg.style.display = 'none';
        enterApp(user);
        return;
      }
      // Sesión guardada pero sin "Recordarme" (o sin rol): cerrarla
      try { await supa.auth.signOut(); } catch (e) {}
    }
    showLogin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
