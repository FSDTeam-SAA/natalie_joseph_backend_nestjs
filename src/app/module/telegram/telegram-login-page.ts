export const telegramLoginPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Meet Elysia · Connect account</title>
<script nonce="__NONCE__" src="https://telegram.org/js/telegram-web-app.js"></script>
<style nonce="__NONCE__">
:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:18px 18px;background:var(--tg-theme-bg-color,#101321);color:var(--tg-theme-text-color,#f8f8fc);font:16px/1.5 system-ui,sans-serif}main{max-width:430px;margin:0 auto}.brand{color:var(--tg-theme-hint-color,#bcb8ce);letter-spacing:2px;font-size:12px}h1{font-size:24px;line-height:1.2;margin:12px 0 8px}p{color:var(--tg-theme-hint-color,#bcb8ce)}label{display:block;margin:12px 0 6px}input{width:100%;padding:12px;border:1px solid #8887;border-radius:12px;background:var(--tg-theme-secondary-bg-color,#1c2032);color:inherit;font:inherit}button,.link{display:block;width:100%;padding:12px;margin-top:12px;border:0;border-radius:12px;background:var(--tg-theme-button-color,#7966df);color:var(--tg-theme-button-text-color,#fff);font:600 16px system-ui;text-align:center;text-decoration:none;cursor:pointer}button:disabled{opacity:.5;cursor:wait}.secondary{background:transparent;color:var(--tg-theme-link-color,#b8aaff);border:1px solid #8887}small{display:block;margin-top:14px;color:var(--tg-theme-hint-color,#bcb8ce)}#notice{padding:12px 0;white-space:pre-line}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #b8aaff;outline-offset:3px}[hidden]{display:none!important}
#notice:empty{display:none}#transfer{padding:10px;border:1px solid #8887;border-radius:12px;font-size:14px}#transfer input{width:auto;margin-right:8px}#transfer p{margin:6px 0}small{font-size:12px}
</style></head><body><main>
<div class="brand">MEET ELYSIA</div><h1 id="heading">Connect your account</h1>
<p id="intro">Log in with your Meet Elysia email and password to connect this companion.</p>
<div id="notice" role="status" aria-live="polite">Loading…</div>
<form id="login" hidden>
<div id="transfer" hidden><p>This account is connected to another Telegram account. Switching will disconnect that account from this companion. Your subscription and credits will stay with your Meet Elysia account.</p><label><input id="confirmTransfer" type="checkbox"> I want to use this Telegram account instead.</label><p>Enter your password again to confirm.</p><button id="cancelTransfer" type="button" class="secondary">Cancel</button></div>
<label for="email">Email</label><input id="email" type="email" autocomplete="username" maxlength="254" required>
<label for="password">Password</label><input id="password" type="password" autocomplete="current-password" maxlength="256" required>
<button id="submit" type="submit">Log In &amp; Connect</button>
</form>
<a id="register" class="link secondary" hidden>Create Account</a>
<a id="forgot" class="link secondary" hidden>Forgot Password</a>
<a id="purchase" class="link" hidden></a>
<button id="refresh" class="secondary" hidden>Check subscription &amp; credits</button>
<button id="back" hidden>Return to chat</button>
<small>Your Meet Elysia password is used only to log in. It is never sent as a chat message.</small>
</main><script nonce="__NONCE__">
const el = id => document.getElementById(id);
const tg = window.Telegram && window.Telegram.WebApp;
const companionId = new URLSearchParams(location.search).get('companionId');
const initData = tg && tg.initData;
let settings;
let transferring = false;
const endpoint = '/api/v1/telegram/app/';
const notice = text => { el('notice').textContent = text; };
async function request(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(endpoint + path + '/' + encodeURIComponent(companionId), {
      method: body ? 'POST' : 'GET', headers: body ? {'Content-Type':'application/json'} : {},
      body: body ? JSON.stringify(body) : undefined, cache:'no-store', credentials:'omit', signal:controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Unable to connect. Please try again.');
    return data.data;
  } catch(error) {
    if (error.name === 'AbortError') throw new Error('The request took too long. Tap Check again or reopen Log In to check your connection.');
    throw error;
  } finally {clearTimeout(timer);}
}
function link(id, url) {
  const node = el(id);
  if (!url) {
    node.hidden = id !== 'register';
    node.href = '#';
    node.onclick = event => {event.preventDefault();notice('Registration is not configured yet. Please contact Meet Elysia support.');};
    return;
  }
  node.href = url; node.hidden = false;
  node.onclick = event => { event.preventDefault(); tg.openLink(url); };
}
function show(state) {
  transferring = Boolean(state.transferRequired);
  el('transfer').hidden = !transferring;
  el('confirmTransfer').checked = false;
  el('confirmTransfer').required = transferring;
  el('email').readOnly = transferring;
  el('submit').textContent = transferring ? 'Confirm & Connect' : 'Log In & Connect';
  el('login').hidden = state.linked;
  el('register').hidden = state.linked || transferring;
  el('forgot').hidden = state.linked || !settings.forgotPasswordUrl;
  el('refresh').hidden = !state.linked;
  el('back').hidden = !state.linked;
  el('purchase').hidden = true;
  if (!state.linked) {notice(transferring ? 'Confirm changing your Telegram connection.' : '');return;}
  el('password').value = '';
  el('intro').textContent = 'Your account is connected to ' + settings.companionName + '.';
  if (state.state === 'ready') notice('Connected! Available credits: ' + state.totalCredits + '. Return to chat to send a message.');
  else {
    const subscription = state.state === 'subscription_required';
    notice(subscription ? 'An active subscription is required to chat.' : 'Your credits have run out. Buy credits to continue chatting.');
    el('purchase').textContent = subscription ? 'Subscribe / Renew' : 'Buy Credits';
    link('purchase', state.actionUrl);
    if (!state.actionUrl) notice('Your account is connected, but the ' + (subscription ? 'subscription' : 'credit purchase') + ' page is not available yet. Please contact support.');
  }
}
el('login').onsubmit = async event => {
  event.preventDefault(); el('submit').disabled = true; notice('Connecting…');
  const password = el('password').value;
  try {show(await request('login', {initData,email:el('email').value.trim(),password,confirmTransfer:transferring && el('confirmTransfer').checked}));}
  catch(error) {notice(error.message);}
  finally {el('password').value='';el('submit').disabled=false;}
};
el('cancelTransfer').onclick = () => {el('password').value='';show({linked:false});};
el('refresh').onclick = async () => {
  el('refresh').disabled=true; notice('Checking…');
  try {show(await request('status',{initData}));} catch(error) {notice(error.message);}
  finally {el('refresh').disabled=false;}
};
el('back').onclick = () => {tg.close();};
(async () => {
  if (!initData || !companionId) {notice('Open this page using the Log In button inside your companion’s Telegram chat.');return;}
  tg.ready();
  try {
    settings = await request('settings');
    el('heading').textContent = 'Connect with ' + settings.companionName;
    link('register', settings.registerUrl);link('forgot', settings.forgotPasswordUrl);
    const state = await request('status',{initData});
    show(state);
  } catch(error) {notice(error.message);}
})();
</script></body></html>`;
