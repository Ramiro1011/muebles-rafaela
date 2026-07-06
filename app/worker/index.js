// Worker de Cloudflare (Workers Builds) — sirve los assets estáticos del
// build de SvelteKit y atiende /api/publicar (dispara el rebuild del
// catálogo, botón "Publicar cambios"). El resto de las rutas se delegan al
// binding ASSETS (ver wrangler.jsonc: run_worker_first solo cubre /api/*,
// así que las demás ni siquiera pasan por acá).
//
// Valida el ID token de Firebase del admin contra las claves públicas (JWKS)
// de Google antes de tocar el Deploy Hook real, así la URL del hook nunca
// queda expuesta en el cliente. No usa firebase-admin: el runtime de
// Workers (V8 isolates) no es Node.js, y firebase-admin depende de módulos
// nativos (gRPC, net) que ahí no son confiables.

import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwks;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/publicar') {
      if (request.method !== 'POST') {
        return json({ error: 'Method Not Allowed' }, 405);
      }
      return handlePublicar(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handlePublicar(request, env) {
  if (!env.FIREBASE_PROJECT_ID || !env.CF_DEPLOY_HOOK_URL) {
    console.error('Faltan las variables de entorno FIREBASE_PROJECT_ID o CF_DEPLOY_HOOK_URL');
    return json({ error: 'Configuración incompleta del servidor.' }, 500);
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return json({ error: 'Falta el token de autenticación.' }, 401);
  }

  try {
    jwks ??= createRemoteJWKSet(new URL(JWKS_URL));
    await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
    });
  } catch (err) {
    console.error('Token inválido:', err.message);
    return json({ error: 'Sesión inválida o expirada.' }, 401);
  }

  try {
    const res = await fetch(env.CF_DEPLOY_HOOK_URL, { method: 'POST' });
    if (!res.ok) throw new Error(`Deploy hook respondió ${res.status}`);
    return json({ ok: true }, 200);
  } catch (err) {
    console.error('Error al disparar el deploy hook:', err);
    return json({ error: 'No se pudo disparar el rebuild.' }, 502);
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
