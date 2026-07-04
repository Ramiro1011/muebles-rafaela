// Genera app/static/catalogo.json a partir de Firestore, para que la vista
// pública lo sirva desde el CDN de Netlify en vez de leer Firestore en vivo.
// Corre antes de "build" y "dev" (ver "prebuild"/"predev" en package.json).
//
// En Netlify (build real) es fatal si falta la credencial: nunca deployar
// con un catálogo vacío o desactualizado en silencio. En dev local es
// tolerante: si falta la credencial, avisa y deja lo que ya haya (o escribe
// un catálogo vacío la primera vez), para no romper "cloná y npm run dev".

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url)); // app/scripts
const APP_DIR = join(__dirname, '..');
const STATIC_DIR = join(APP_DIR, 'static');
const OUTPUT_FILE = join(STATIC_DIR, 'catalogo.json');
const ES_NETLIFY = process.env.NETLIFY === 'true';

function catalogoVacio() {
  return {
    generadoEn: new Date().toISOString(),
    productos: [],
    categorias: [],
    config: { landing: {}, nosotros: {}, contacto: {} },
  };
}

function escribir(catalogo) {
  if (!existsSync(STATIC_DIR)) mkdirSync(STATIC_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(catalogo), 'utf-8');
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  if (ES_NETLIFY) {
    console.error('Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio). Abortando build.');
    process.exit(1);
  }
  console.warn('FIREBASE_SERVICE_ACCOUNT no está seteada — se omite la generación de catalogo.json.');
  if (!existsSync(OUTPUT_FILE)) {
    console.warn('No existe static/catalogo.json todavía — se crea uno vacío para que "npm run dev" no falle.');
    escribir(catalogoVacio());
  }
  process.exit(0);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function leerColeccionOrdenada(nombre) {
  const snap = await db.collection(nombre).orderBy('nombre').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function leerConfig(id) {
  const snap = await db.doc(`config/${id}`).get();
  return snap.exists ? snap.data() : {};
}

async function main() {
  const [productos, categorias, landing, nosotros, contacto] = await Promise.all([
    leerColeccionOrdenada('productos'),
    leerColeccionOrdenada('categorias'),
    leerConfig('landing'),
    leerConfig('nosotros'),
    leerConfig('contacto'),
  ]);

  const catalogo = {
    generadoEn: new Date().toISOString(),
    productos,
    categorias,
    config: { landing, nosotros, contacto },
  };

  escribir(catalogo);
  console.log(`catalogo.json generado: ${productos.length} productos, ${categorias.length} categorías.`);
}

main().catch(err => {
  console.error('Error al generar catalogo.json:', err);
  if (ES_NETLIFY) process.exit(1);
  if (!existsSync(OUTPUT_FILE)) escribir(catalogoVacio());
  process.exit(0);
});
