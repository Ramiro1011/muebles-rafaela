// Backup diario de Firestore — pensado para correr desde GitHub Actions.
// Lee productos, categorias, proveedores, historial y config, y guarda
// un JSON con fecha en /backups en la raíz del repo. Mantiene solo los
// últimos MAX_BACKUPS archivos, borrando los más viejos.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url)); // app/scripts
const REPO_ROOT = join(__dirname, '..', '..');
const BACKUP_DIR = join(REPO_ROOT, 'backups');
const MAX_BACKUPS = 3;

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio).');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// El email del admin no debe quedar expuesto en un repo público.
function enmascararUsuario(usuario) {
  return usuario ? 'admin' : usuario ?? null;
}

async function leerColeccion(nombre) {
  const snap = await db.collection(nombre).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function leerConfig(id) {
  const snap = await db.doc(`config/${id}`).get();
  return snap.exists ? snap.data() : null;
}

function rotarBackups() {
  const archivos = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort(); // backup-YYYY-MM-DD.json ordena cronológicamente como string

  const sobrantes = archivos.slice(0, Math.max(0, archivos.length - MAX_BACKUPS));
  for (const f of sobrantes) {
    unlinkSync(join(BACKUP_DIR, f));
    console.log(`Backup viejo eliminado: ${f}`);
  }
}

async function main() {
  const [productos, categorias, proveedores, historialCrudo, landing, nosotros, contacto] = await Promise.all([
    leerColeccion('productos'),
    leerColeccion('categorias'),
    leerColeccion('proveedores'),
    leerColeccion('historial'),
    leerConfig('landing'),
    leerConfig('nosotros'),
    leerConfig('contacto'),
  ]);

  const fecha = new Date().toISOString();
  const backup = {
    fecha,
    productos,
    categorias,
    proveedores,
    historial: historialCrudo.map(h => ({ ...h, usuario: enmascararUsuario(h.usuario) })),
    config: { landing, nosotros, contacto },
  };

  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

  const nombreArchivo = `backup-${fecha.slice(0, 10)}.json`;
  writeFileSync(join(BACKUP_DIR, nombreArchivo), JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`Backup guardado: backups/${nombreArchivo} (${productos.length} productos, ${categorias.length} categorías, ${proveedores.length} proveedores, ${historialCrudo.length} entradas de historial)`);

  rotarBackups();
}

main().catch(err => {
  console.error('Error al generar el backup:', err);
  process.exit(1);
});
