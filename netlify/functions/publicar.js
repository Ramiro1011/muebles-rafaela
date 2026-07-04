// Netlify Function — dispara el rebuild del catálogo (Publicar cambios).
// Valida el ID token de Firebase del admin server-side antes de tocar el
// build hook real, así la URL del hook nunca queda expuesta en el cliente.

import admin from 'firebase-admin';

let app;
function getAdminApp() {
  if (app) return app;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return app;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.NETLIFY_BUILD_HOOK_URL) {
    console.error('Faltan las variables de entorno FIREBASE_SERVICE_ACCOUNT o NETLIFY_BUILD_HOOK_URL');
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuración incompleta del servidor.' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Falta el token de autenticación.' }) };
  }

  try {
    await getAdminApp().auth().verifyIdToken(token);
  } catch (err) {
    console.error('Token inválido:', err.message);
    return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida o expirada.' }) };
  }

  try {
    const res = await fetch(process.env.NETLIFY_BUILD_HOOK_URL, { method: 'POST' });
    if (!res.ok) throw new Error(`Build hook respondió ${res.status}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('Error al disparar el build hook:', err);
    return { statusCode: 502, body: JSON.stringify({ error: 'No se pudo disparar el rebuild.' }) };
  }
};
