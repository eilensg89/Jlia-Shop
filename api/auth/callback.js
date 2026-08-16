function parseCookies(header='') {
  return Object.fromEntries(header.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{
    const i=v.indexOf('=');
    return i<0 ? [v,''] : [decodeURIComponent(v.slice(0,i)), decodeURIComponent(v.slice(i+1))];
  }));
}

function render(status, content) {
  // Flujo principal: misma pestaña. Es más estable en iPhone/Android y evita
  // depender de window.opener, que los navegadores móviles pueden perder.
  const payload = JSON.stringify(content).replace(/</g, '\\u003c');
  const safeStatus = JSON.stringify(status);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jlia Shop CMS</title></head><body><script>
  (function(){
    var status=${safeStatus};
    var data=${payload};
    if(status === 'success' && data && data.token){
      try {
        sessionStorage.setItem('jlias_token', data.token);
        window.location.replace('/admin/');
        return;
      } catch(e) {}
    }
    var text = status === 'success'
      ? 'Autorización completada. Regresando al administrador…'
      : 'No se pudo iniciar sesión con GitHub. Regresa al administrador e inténtalo nuevamente.';
    document.body.textContent = text;
    if(status !== 'success'){
      setTimeout(function(){ window.location.replace('/admin/'); }, 1800);
    }
  })();
  </script></body></html>`;
}

module.exports = async (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const code = req.query && req.query.code;
  const returnedState = req.query && req.query.state;
  const cookies = parseCookies(req.headers.cookie || '');
  const expectedState = cookies.jlias_oauth_state;

  res.setHeader('Set-Cookie', 'jlias_oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

  if (!clientId || !clientSecret) {
    res.statusCode = 500;
    return res.end('Faltan GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET en Vercel.');
  }
  if (!code) {
    res.statusCode = 400;
    return res.end('GitHub no devolvió código de autorización.');
  }
  if (!expectedState || !returnedState || expectedState !== returnedState) {
    res.statusCode = 400;
    return res.end('Estado OAuth inválido o expirado. Vuelve a iniciar sesión desde /admin/.');
  }

  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const redirectUri = `${proto}://${host}/api/auth/callback`;
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept':'application/json', 'Content-Type':'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
    });
    const data = await response.json();
    if (!data.access_token) throw new Error(data.error_description || data.error || 'No se recibió token');
    res.statusCode = 200;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(render('success', { token: data.access_token, provider: 'github' }));
  } catch (err) {
    res.statusCode = 200;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(render('error', { message: String(err && err.message || err) }));
  }
};
