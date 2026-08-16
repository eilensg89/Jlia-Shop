const REPO = 'eilensg89/Jlia-Shop-CMS-Prueba';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Método no permitido.' }));
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Falta configurar VERCEL_DEPLOY_HOOK en Vercel.' }));
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Sesión de GitHub no válida.' }));
  }

  try {
    // Verifica que quien pide publicar realmente tiene permiso de escritura en el repo.
    const check = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!check.ok) throw new Error('No se pudo verificar el acceso al repositorio.');
    const repo = await check.json();
    if (!repo.permissions || !repo.permissions.push) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Esta cuenta no tiene permiso para publicar cambios.' }));
    }

    const deploy = await fetch(hook, { method: 'POST' });
    if (!deploy.ok) {
      const txt = await deploy.text();
      throw new Error(`Vercel rechazó la publicación: ${deploy.status} ${txt}`);
    }
    const data = await deploy.json().catch(() => ({}));
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, deployment: data }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err && err.message || err) }));
  }
};
