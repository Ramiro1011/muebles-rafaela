# Firebase & Firestore — Muebles Rafaela

Eres un experto en Firebase para este catálogo de mueblería. El "backend" es 100% Firebase (Firestore + Auth), sin servidor propio.

## Stack
- **Firebase v10.12.2** (modular SDK via CDN)
- **Firebase Auth** — autenticación email/password (un único admin)
- **Firebase Firestore** — base de datos NoSQL en tiempo real
- **Netlify** — hosting estático
- **Sin Firebase Storage actualmente** — las imágenes se cargan por URL externa

---

## Arquitectura de datos Firestore

### Colección `productos`
```javascript
{
  id: "auto-generado-por-firestore",  // DocumentReference ID
  nombre: "Sillón 3 Cuerpos",         // string, requerido
  descripcion: "Tapizado en tela...",  // string, opcional
  precio: 85000,                       // number, nullable (null = "Consultar")
  categoria: "Sillones",              // string, debe existir en categorias[]
  imagen: "https://...",              // string URL, nullable
  destacado: true                     // boolean, opcional (para futura sección de destacados)
}
```

### Colección `categorias`
```javascript
{
  id: "auto-generado",
  nombre: "Sillones"  // string, requerido, único (no hay constraint en Firestore, validar en JS)
}
```

---

## Operaciones Firestore disponibles

### Imports ya disponibles en el script
```javascript
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase-firestore";
```

### Leer datos (en tiempo real)
```javascript
// onSnapshot se actualiza automáticamente cuando hay cambios
const unsub = onSnapshot(
  query(collection(db, 'productos'), orderBy('nombre')),
  snap => {
    productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGrid();
  },
  err => toast('Error: ' + err.message, 'err')
);
// Para cancelar: unsub()
```

### Crear documento
```javascript
await addDoc(collection(db, 'productos'), {
  nombre: 'Nuevo producto',
  precio: 50000,
  categoria: 'Sillones'
  // Firestore agrega el ID automáticamente
});
```

### Actualizar documento
```javascript
await updateDoc(doc(db, 'productos', id), {
  nombre: 'Nombre actualizado',
  precio: 60000
  // Solo los campos incluidos se actualizan; el resto no cambia
});
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
// Login
await signInWithEmailAndPassword(auth, email, password);

// Logout
await signOut(auth);

// Escuchar cambios de auth
onAuthStateChanged(auth, user => {
  isAdmin = !!user;
  // mostrar/ocultar botones admin
});
```

### Consideraciones de seguridad
- La protección REAL está en las **Firestore Security Rules**, no en `isAdmin`
- Un usuario puede ejecutar `isAdmin = true` en la consola del browser — eso no le da acceso a Firestore si las reglas están bien configuradas
- Firebase Auth maneja rate limiting de intentos de login automáticamente

---

## Firestore Security Rules (configurar en Firebase Console)

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
  }
}
```

---

## Paginación para 1500 productos

Con 1500 productos, cargar todo en memoria es posible pero genera:
- ~100-300 KB de JSON
- ~1500 Firestore reads en la carga inicial
- Posible lentitud en el primer render

### Opción 1: Paginación con cursor (recomendada)
```javascript
import { limit, startAfter } from "firebase-firestore";

let ultimoDoc = null;
const PAGE_SIZE = 24;

async function cargarMas() {
  let q = query(collection(db, 'productos'), orderBy('nombre'), limit(PAGE_SIZE));
  if (ultimoDoc) q = query(q, startAfter(ultimoDoc));

  const snap = await getDocs(q);
  ultimoDoc = snap.docs[snap.docs.length - 1];
  const nuevos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  productos = [...productos, ...nuevos];
  renderGrid();

  document.getElementById('btn-cargar-mas').style.display =
    snap.docs.length < PAGE_SIZE ? 'none' : 'block';
}
```

### Opción 2: Cargar todo pero renderizar en lotes (virtual scroll simple)
```javascript
// Cargar todo de Firestore pero mostrar solo N productos
let paginaActual = 0;
const POR_PAGINA = 24;

function renderGrid() {
  const ps = productosFiltrados();
  const visibles = ps.slice(0, (paginaActual + 1) * POR_PAGINA);
  // renderizar solo 'visibles'
  // Mostrar "Ver más" si hay más
}
```

---

## Firestore — Consideraciones de costo y quotas

| Operación | Costo en plan gratuito |
|-----------|----------------------|
| Lectura (getDocs/onSnapshot) | 50.000/día gratis |
| Escritura (addDoc/updateDoc) | 20.000/día gratis |
| Eliminación | 20.000/día gratis |
| Almacenamiento | 1 GB gratis |

Con 1500 productos:
- onSnapshot inicial: 1500 reads
- Cada cambio en Firestore dispara nuevo snapshot: 1500 reads más
- Con paginación de 24: 24 reads por carga

**Recomendación**: con 1500 productos y tráfico normal, el plan gratuito es suficiente. Si se acerca al límite, implementar paginación.

---

## Índices Firestore

Para `orderBy` combinado con `where`, Firestore requiere índices compuestos (se crean en Firebase Console o automáticamente con error en consola).

Índices que podrían necesitarse al escalar:
```
productos: categoria ASC, precio ASC  (para filtrar por cat y ordenar por precio)
productos: destacado ASC, nombre ASC  (para sección de destacados)
```

---

## Instrucciones al trabajar con Firebase

1. **Siempre usar try/catch** en operaciones Firestore — pueden fallar por permisos, red, etc.
2. **Cancelar onSnapshot** al desmontar (el código ya usa `unsubProds` y `unsubCats`)
3. **Retrocompatibilidad**: campos nuevos pueden no existir en documentos viejos → siempre usar `p.campo ?? defaultValue`
4. **No duplicar listeners**: verificar si ya hay un `onSnapshot` activo antes de crear otro
5. **No exponer credenciales**: la Firebase config con apiKey es pública e intencional — la seguridad está en Firestore Rules
6. **Batch writes** para operaciones múltiples atómicas (ej: renombrar categoría en todos los productos):

```javascript
import { writeBatch } from "firebase-firestore";

const batch = writeBatch(db);
productosAfectados.forEach(p => {
  batch.update(doc(db, 'productos', p.id), { categoria: nuevaCategoria });
});
await batch.commit(); // Máximo 500 docs por batch
```

$ARGUMENTS
