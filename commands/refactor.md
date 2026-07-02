# Refactor & Calidad de Código — Muebles Rafaela

Mejora la calidad del código sin cambiar su comportamiento. Foco en legibilidad, mantenibilidad y eliminación de código duplicado en la app SvelteKit.

## Stack: SvelteKit 5 (runes) + Firebase v12 + Cloudinary

---

## Principios de refactor para este proyecto

### 1. Eliminar duplicación entre componentes
Buscar markup/lógica repetida entre `catalogo/+page.svelte` y `admin/+page.svelte` (ej: el cálculo de categorías legacy `p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : []` aparece en varios lugares — candidato a extraer como helper en `stores.js`).

```javascript
// MAL: el mismo cálculo repetido en catalogo/+page.svelte, admin/+page.svelte y stores.js
const cats = p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : [];

// BIEN: helper exportado desde stores.js, reutilizado en todos lados
export function categoriasDe(p) {
  return p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : [];
}
```

### 2. Derived stores para lógica de filtrado, nunca dentro del markup
```javascript
// MAL: filtrar dentro de un $derived.by disperso en el componente cuando ya existe uno central
const ps = $derived.by(() => $productos.filter(p => p.categoria === $filtroCategoria));

// BIEN: si el filtro es genérico y reutilizable, va en productosFiltrados (stores.js)
// Si es específico de una vista puntual (ej. admin), un $derived.by local está bien —
// pero evitar reimplementar lógica que productosFiltrados ya resuelve.
```

### 3. Runes, no reactividad de Svelte 4
```javascript
// MAL (Svelte 4, no usar en este proyecto)
export let producto;
$: precioMostrado = producto.descuento > 0 ? precioFinal(producto) : producto.precio;

// BIEN (Svelte 5, runes)
let { producto } = $props();
const precioMostrado = $derived(producto.descuento > 0 ? precioFinal(producto) : producto.precio);
```

### 4. Constantes para magic strings/numbers
```javascript
// MAL: número mágico repetido
const paginados = $productosFiltrados.slice(0, 24);
// en otro lugar:
if (pagina > totalProd / 24) ...

// BIEN: constante
const POR_PAG = 24;
const paginados = $productosFiltrados.slice(0, POR_PAG);
```

### 5. Async/await limpio con try/catch/finally
```javascript
// MAL: sin finally → guardando queda en true si hay error
async function guardar() {
  guardando = true;
  try {
    await addDoc(collection(db, 'productos'), data);
    toast('Guardado');
    guardando = false; // no se ejecuta si addDoc lanza
  } catch (e) {
    toast(e.message, 'err');
  }
}

// BIEN: finally garantiza reseteo del estado siempre
async function guardar() {
  guardando = true;
  try {
    await addDoc(collection(db, 'productos'), data);
    toast('Guardado correctamente');
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  } finally {
    guardando = false;
  }
}
```

### 6. Evitar suscripciones Firestore duplicadas
```javascript
// MAL: volver a suscribirse con onSnapshot dentro de una página cuando +layout.svelte ya llena el store
onMount(() => {
  const unsub = onSnapshot(collection(db, 'productos'), snap => { /* ... */ });
  return unsub;
});

// BIEN: leer el store ya poblado
import { productos } from '$lib/stores.js';
// usar $productos directamente en el markup
```

### 7. Guard clauses en lugar de anidación
```javascript
// MAL: anidación profunda
function abrirDetalle(id) {
  const p = $productos.find(x => x.id === id);
  if (p) {
    if (p.activo !== false) {
      productoSel = p;
    }
  }
}

// BIEN: early returns
function abrirDetalle(id) {
  const p = $productos.find(x => x.id === id);
  if (!p || p.activo === false) return;
  productoSel = p;
}
```

### 8. Fallbacks explícitos para campos opcionales de Firestore
```javascript
// MAL: puede fallar si el documento viejo no tiene el campo
const precio = p.precio.toLocaleString();

// BIEN: fallback explícito, coherente con precioFinal() y pesos() existentes
const precio = p.precio != null ? pesos(p.precio) : 'Consultar';
```

### 9. CSS: variables en lugar de valores repetidos
```css
/* MAL: colores repetidos en múltiples selectores */
.btn-wsp { background: #25d366; }
.footer-wsp { background: #25d366; }

/* BIEN: variable CSS agregada a :root en app.css */
:root { --verde-wsp: #25d366; }
.btn-wsp, .footer-wsp { background: var(--verde-wsp); }
```

### 10. Nombres de funciones y variables expresivos
Seguir la convención en español ya establecida en el proyecto (`guardarProd`, `eliminarProd`, `abrirDetalle`, `seleccionarCat`) — no mezclar inglés/español dentro de la misma función.

---

## Checklist de refactor

- [ ] ¿Hay lógica de filtrado/transformación repetida en varios componentes que debería vivir en un derived de `stores.js`?
- [ ] ¿Hay sintaxis de Svelte 4 (`export let`, `$:`) que debería migrarse a runes?
- [ ] ¿Hay una suscripción `onSnapshot` fuera de `+layout.svelte` que debería leer un store existente en su lugar?
- [ ] ¿Los magic strings/numbers (paginación, nombres de colección) aparecen en varios lugares? → Extraer constante
- [ ] ¿Las operaciones async tienen `finally` para resetear el estado de carga?
- [ ] ¿Hay anidación profunda que se puede aplanar con early returns?
- [ ] ¿Los campos de Firestore tienen fallbacks para cuando no existen (documentos viejos)?
- [ ] ¿Los colores CSS repetidos tienen sus variables?
- [ ] ¿Las funciones tienen nombres que describen su intención, consistentes con el resto del proyecto?

---

## Pase de limpieza estructurado (ejecutar después de cualquier modificación)

Restricción absoluta: **nunca cambiar el comportamiento, solo cómo se expresa.**

### Regla 1: Aplanar condicionales anidados → guard clauses (ver punto 7 arriba)

### Regla 2: Eliminar variables temporales que solo se usan para retornar
```javascript
// MAL
const resultado = $productos.filter(p => p.destacado);
return resultado;
// BIEN
return $productos.filter(p => p.destacado);
```

### Regla 3: Template literals sobre concatenación
```javascript
// MAL
'Hola! Consulto por: ' + nombre;
// BIEN
`Hola! Consulto por: ${nombre}`;
```

### Regla 4: Optional chaining para accesos encadenados
```javascript
// MAL
if (p && p.colores && p.colores.length) { ... }
// BIEN
if (p?.colores?.length) { ... }
```

### Regla 5: Nullish coalescing para fallbacks
```javascript
// MAL
const nombre = p.nombre !== undefined && p.nombre !== null ? p.nombre : 'Sin nombre';
// BIEN
const nombre = p.nombre ?? 'Sin nombre';
```

### Regla 6: CSS — eliminar propiedades redundantes
```css
/* MAL: propiedades con valores por defecto */
.card { display: block; float: none; margin: 0px; }
/* BIEN */
.card { /* solo propiedades que difieren del default */ }
```

### Regla 7: Eliminar comentarios que repiten el código
```javascript
// MAL: comentario que dice lo mismo
// Obtener el producto por id
const p = $productos.find(x => x.id === id);

// BIEN: sin comentario (el código ya es claro)
const p = $productos.find(x => x.id === id);
```

$ARGUMENTS
