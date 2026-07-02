# Firebase & Firestore — Muebles Rafaela

Eres un experto en Firebase para este catálogo de mueblería. El "backend" es 100% Firebase (Firestore + Auth) + Cloudinary para imágenes, sin servidor propio. La app es SvelteKit 5 con `adapter-static` — no hay rutas server (`+page.server.js`, `+server.js`), todo corre en el cliente.

## Stack
- **Firebase v12** (modular SDK, instalado vía npm — no CDN)
- **Firebase Auth** — email/password, un único admin
- **Firebase Firestore** — base de datos NoSQL en tiempo real
- **Cloudinary** — upload unsigned de imágenes (reemplaza URLs externas pegadas a mano del sistema anterior)
- **Netlify** — hosting estático del build de `adapter-static`

Init centralizado en `app/src/lib/firebase.js`:
```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

export const CLOUDINARY_CLOUD_NAME    = 'dc74ogekb';
export const CLOUDINARY_UPLOAD_PRESET = 'muebles-rafaela';

export async function subirImagenCloudinary(file, onProgress) { /* XHR a api.cloudinary.com */ }
```
Importar `db`, `auth`, `subirImagenCloudinary` desde `$lib/firebase.js` — nunca reinicializar la app en otro archivo.

---

## Arquitectura de datos Firestore

### Colección `productos`
```javascript
{
  id: "auto-generado",
  nombre: "Sillón 3 Cuerpos",        // string, requerido
  descripcion: "Tapizado en...",     // string, opcional
  precio: 85000,                     // number, nullable (null = "Consultar")
  precioAnterior: 95000,             // number, nullable — precio tachado si no hay descuento %
  descuento: 10,                     // number (%), 0 = sin descuento activo
  stock: 5,                          // number, nullable
  categoria: "Sillones",             // string, LEGACY — igual a categorias[0]
  categorias: ["Sillones", "Living"],// array de strings — fuente de verdad actual
  material: "Madera",                // string, opcional
  imagen: "https://res.cloudinary.com/...", // URL de Cloudinary, nullable
  imagenes: ["https://...", "..."],  // array de URLs adicionales (galería)
  nuevo: true,                       // boolean, opcional — badge "Novedad"
  destacado: true,                   // boolean, opcional
  activo: true,                      // boolean — false = oculto del catálogo público
  colores: [{ nombre: "Gris", hex: "#888888" }] // array de objetos, opcional
}
```

Al guardar desde el admin (`guardarProd()` en `admin/+page.svelte`) siempre se escriben **ambos** `categoria` y `categorias` — mantener esa doble escritura al tocar ese código, ya que hay lectores (derived, filtros) que todavía consultan el campo legacy como fallback.

### Colección `categorias`
```javascript
{ id: "auto-generado", nombre: "Sillones" }
```

### Documentos de configuración (`config/landing`, `config/nosotros`, `config/contacto`)
Documentos con ID fijo, no colecciones — se leen/escriben con `doc(db, 'config', 'landing')`, no con `collection()`. Cada uno mapea 1:1 a un store (`configLanding`, `configNosotros`, `configContacto`) con sus valores por defecto ya definidos en `stores.js` (se usan como fallback si el doc no existe todavía).

---

## Operaciones Firestore disponibles

### Imports típicos
```javascript
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
```

### Leer datos en tiempo real (patrón del proyecto: centralizado en `+layout.svelte`)
```javascript
// Dentro de onMount() en app/src/routes/+layout.svelte
const u1 = onSnapshot(query(collection(db, 'productos'), orderBy('nombre')), snap => {
  productos.set(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});
// return del onMount desuscribe automáticamente al desmontar el layout
```
**No** volver a suscribirse con `onSnapshot` dentro de páginas individuales — los stores ya están poblados globalmente.

### Crear documento (ID autogenerado)
```javascript
await addDoc(collection(db, 'productos'), {
  nombre: 'Nuevo producto',
  precio: 50000,
  categorias: ['Sillones'],
  categoria: 'Sillones',
});
```

### Actualizar documento (parcial)
```javascript
await updateDoc(doc(db, 'productos', id), {
  activo: false, // solo los campos incluidos cambian
});
```

### Reemplazar documento completo con ID fijo (config)
```javascript
await setDoc(doc(db, 'config', 'landing'), formCompleto); // reemplaza TODO el doc
```

### Eliminar documento
```javascript
await deleteDoc(doc(db, 'productos', id));
```

### Consulta puntual (sin tiempo real)
```javascript
const snap = await getDocs(query(collection(db, 'productos'), orderBy('nombre')));
const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
```

---

## Firebase Auth

### Patrón actual
```javascript
// Login (admin/login/+page.svelte)
await signInWithEmailAndPassword(auth, email, password);

// Logout (botón "Salir" en admin/+layout.svelte)
await signOut(auth);

// Escuchar cambios de auth — centralizado en +layout.svelte raíz
onAuthStateChanged(auth, u => {
  usuario.set(u);
  authCargando.set(false);
});
```

### Guard de rutas admin
`admin/+layout.svelte` usa un `$effect` reactivo a los stores `usuario`/`authCargando` para redirigir a `/admin/login` con `goto()` si no hay sesión. Esto es protección **de UX**, no de seguridad — la seguridad real vive en las Firestore Security Rules (`request.auth != null` en escritura).

---

## Firestore Security Rules (configurar en Firebase Console — no versionado en el repo)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /productos/{prodId} {
      allow read: if true;                    // Catálogo público
      allow write: if request.auth != null;   // Solo admin autenticado
    }
    match /categorias/{catId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /config/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## Paginación (ya implementada)

- **Catálogo público** (`catalogo/+page.svelte`): `POR_PAG = 24`, paginación numerada client-side sobre `$productosFiltrados` (todos los productos ya están en memoria vía `onSnapshot`, se hace slice en el derived)
- **Admin** (`admin/+page.svelte`): `POR_PAG_ADMIN = 20`, mismo patrón de slice client-side sobre `prodsFiltrados`

Con ~1500 productos esto sigue siendo client-side (un solo `onSnapshot` inicial trae todo). Si el catálogo crece significativamente más, considerar mover a paginación por cursor de Firestore (`limit` + `startAfter`) en vez de traer todo de una vez — pero no es necesario en la escala actual.

---

## Firestore — Consideraciones de costo y quotas

| Operación | Costo en plan gratuito |
|-----------|----------------------|
| Lectura (getDocs/onSnapshot) | 50.000/día gratis |
| Escritura (addDoc/updateDoc/setDoc) | 20.000/día gratis |
| Eliminación | 20.000/día gratis |
| Almacenamiento Firestore | 1 GB gratis |

Con ~1500 productos: el `onSnapshot` inicial de `+layout.svelte` cuesta ~1500 reads, y cada escritura desde el admin dispara un nuevo snapshot completo (~1500 reads más) para todos los clientes conectados en ese momento. Con tráfico normal el plan gratuito alcanza.

Cloudinary tiene su propia cuota separada (créditos mensuales en el plan free) — no consume quota de Firebase.

---

## Índices Firestore

Para `orderBy` combinado con `where`, Firestore requiere índices compuestos (se crean en Firebase Console o automáticamente con link de error en consola del browser). No hay `where` combinado con `orderBy` en el código actual — los filtros (categoría, material, precio, destacados) se hacen client-side sobre los datos ya cargados, así que no se necesitan índices compuestos hoy.

---

## Instrucciones al trabajar con Firebase

1. **Siempre usar try/catch/finally** en operaciones Firestore — pueden fallar por permisos, red, etc. Ver patrón en `guardarProd()`.
2. **No duplicar `onSnapshot`**: toda suscripción en tiempo real vive en `app/src/routes/+layout.svelte`. Las páginas leen stores, no vuelven a suscribirse.
3. **Retrocompatibilidad**: campos nuevos pueden no existir en documentos viejos → usar `p.campo ?? default` o `p.campo != null`.
4. **Mantener la doble escritura `categoria`/`categorias`** al modificar `guardarProd()` — hay lectores que dependen del fallback legacy.
5. **No exponer credenciales adicionales**: la Firebase config con `apiKey` es pública e intencional — la seguridad está en Firestore Rules. El preset de Cloudinary unsigned también es público por diseño; su mitigación son las restricciones configuradas en el dashboard de Cloudinary, no el código.
6. **Batch writes** para operaciones múltiples atómicas (ej: renombrar categoría en cascada sobre todos los productos que la usan):

```javascript
import { writeBatch } from 'firebase/firestore';

const batch = writeBatch(db);
productosAfectados.forEach(p => {
  batch.update(doc(db, 'productos', p.id), { categoria: nuevoNombre });
});
await batch.commit(); // Máximo 500 docs por batch
```

$ARGUMENTS
