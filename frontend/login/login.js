'use strict';

/* Standalone entry screen. No existing page or backend file needs to change.
 * Served automatically by backend/server.js at /login/.
 * Keep the same origin as the API: the current backend does not enable CORS.
 * The feed reads this same sessionStorage key. Change afterAuth to use another page.
 */
const LOGIN_CONFIG = Object.freeze({
  apiBase: '/api/auth',
  afterAuth: '../index.html',
  tokenKey: 'broncocircle-token',
  timeoutMs: 15000
});

(() => {
  const byId = id => document.getElementById(id);
  const welcome = byId('welcome-view');
  const credentials = byId('credentials-view');
  const form = byId('auth-form');
  const emailInput = byId('email');
  const passwordInput = byId('password');
  const submitButton = byId('submit-button');
  const submitLabel = byId('submit-label');
  const backButton = byId('back-button');
  const switchButton = byId('switch-mode');
  const showButton = byId('show-password');
  const errorMessage = byId('form-error');
  const statusMessage = byId('form-status');
  let mode = 'login';
  let busy = false;

  function clearMessages() {
    errorMessage.hidden = statusMessage.hidden = true;
    errorMessage.textContent = statusMessage.textContent = '';
    emailInput.removeAttribute('aria-invalid');
    passwordInput.removeAttribute('aria-invalid');
  }

  function showError(message) {
    statusMessage.hidden = true;
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  function hidePassword() {
    passwordInput.type = 'password';
    showButton.textContent = 'Show';
    showButton.setAttribute('aria-label', 'Show password');
    showButton.setAttribute('aria-pressed', 'false');
  }

  function showMode(nextMode) {
    if (busy) return;
    mode = nextMode;
    const signingUp = mode === 'signup';
    welcome.hidden = true;
    credentials.hidden = false;
    backButton.hidden = false;
    document.querySelector('.auth-card').setAttribute('aria-labelledby', 'form-title');
    byId('form-title').textContent = signingUp ? 'Sign up' : 'Log in';
    byId('form-intro').textContent = signingUp ? 'A new circle starts with you.' : 'Welcome back to your circle.';
    submitLabel.textContent = signingUp ? 'Create account' : 'Log in';
    byId('switch-copy').textContent = signingUp ? 'Already have an account?' : 'New here?';
    switchButton.textContent = signingUp ? 'Log in' : 'Sign up';
    byId('password-hint').hidden = !signingUp;
    if (signingUp) passwordInput.setAttribute('aria-describedby', 'password-hint');
    else passwordInput.removeAttribute('aria-describedby');
    passwordInput.autocomplete = signingUp ? 'new-password' : 'current-password';
    passwordInput.placeholder = signingUp ? 'At least 8 characters' : 'Your password';
    passwordInput.value = '';
    hidePassword();
    clearMessages();
    document.title = `${signingUp ? 'Sign up' : 'Log in'} · BroncoCircle`;
    byId('form-title').focus({ preventScroll:true });
  }

  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    [emailInput,passwordInput,submitButton,backButton,switchButton,showButton].forEach(control => { control.disabled = value; });
    document.querySelector('.spinner').hidden = !value;
    submitLabel.textContent = value ? (mode === 'signup' ? 'Creating account…' : 'Logging in…') : (mode === 'signup' ? 'Create account' : 'Log in');
  }

  function validate() {
    emailInput.value = emailInput.value.trim();
    if (!emailInput.validity.valid) {
      emailInput.setAttribute('aria-invalid','true');
      showError('Enter a valid email address.');
      emailInput.focus();
      return false;
    }
    if (passwordInput.value.length < 8 || passwordInput.value.length > 128) {
      passwordInput.setAttribute('aria-invalid','true');
      showError('Your password must have 8–128 characters.');
      passwordInput.focus();
      return false;
    }
    return true;
  }

  function messageFor(status) {
    if (status === 409) return 'That email already has an account. Try logging in.';
    if (status === 401) return 'Your email or password doesn’t match. Please try again.';
    if (status === 400) return 'Check your email and password, then try again.';
    if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (status === 404 || status === 405) return 'The sign-in service isn’t available at this address. Open this page through the BroncoCircle server.';
    return 'We couldn’t connect to your account. Please try again shortly.';
  }

  byId('choose-login').addEventListener('click', () => showMode('login'));
  byId('choose-signup').addEventListener('click', () => showMode('signup'));
  switchButton.addEventListener('click', () => showMode(mode === 'signup' ? 'login' : 'signup'));
  backButton.addEventListener('click', () => {
    if (busy) return;
    form.reset();
    hidePassword();
    clearMessages();
    welcome.hidden = false;
    credentials.hidden = backButton.hidden = true;
    document.querySelector('.auth-card').setAttribute('aria-labelledby','page-title');
    document.title = 'Welcome · BroncoCircle';
    byId('page-title').focus({ preventScroll:true });
  });
  showButton.addEventListener('click', () => {
    const showing = passwordInput.type === 'password';
    passwordInput.type = showing ? 'text' : 'password';
    showButton.textContent = showing ? 'Hide' : 'Show';
    showButton.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
    showButton.setAttribute('aria-pressed',String(showing));
  });
  [emailInput,passwordInput].forEach(input => input.addEventListener('input', clearMessages));
  window.addEventListener('pageshow', event => {
    if(event.persisted){setBusy(false);clearMessages();hidePassword();passwordInput.value='';}
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    clearMessages();
    if (!validate()) return;
    if (location.protocol === 'file:') {
      showError('Open http://localhost:3000/login/ to connect to the sign-in service.');
      return;
    }

    const email = emailInput.value.trim().toLowerCase();
    const payload = { email, password:passwordInput.value };
    if (mode === 'signup') {
      // The existing signup API requires a name. No extra form field is needed.
      // The separate profile-setup page collects the student's chosen profile name.
      payload.name = email.slice(0,email.indexOf('@')).slice(0,100);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),LOGIN_CONFIG.timeoutMs);
    setBusy(true);
    let authenticated = false;
    try {
      const response = await fetch(`${LOGIN_CONFIG.apiBase}/${mode}`, {
        method:'POST',
        headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify(payload),
        signal:controller.signal,
        cache:'no-store',
        credentials:'same-origin'
      });
      if (!response.ok) throw new Error(messageFor(response.status));
      let session;
      try { session = await response.json(); }
      catch { throw new Error('The sign-in service returned an incomplete response. Please try again.'); }
      if (typeof session.token !== 'string' || !/^[a-f0-9]{64}$/i.test(session.token)) {
        throw new Error('The sign-in service returned an incomplete response. Please try again.');
      }
      try { sessionStorage.setItem(LOGIN_CONFIG.tokenKey,session.token); }
      catch { throw new Error('You’re signed in, but this browser couldn’t save your session. Allow session storage, then log in again.'); }
      authenticated = true;
      passwordInput.value = '';
      statusMessage.textContent = 'You’re in. Opening your campus…';
      statusMessage.hidden = false;
      location.assign(new URL(LOGIN_CONFIG.afterAuth,location.href).href);
    } catch (error) {
      const message = error.name === 'AbortError' ? 'The sign-in service took too long. Please try again.' : error instanceof TypeError ? 'We couldn’t reach BroncoCircle. Check your connection and try again.' : error.message;
      showError(message);
    } finally {
      clearTimeout(timer);
      if (!authenticated) setBusy(false);
    }
  });
})();
