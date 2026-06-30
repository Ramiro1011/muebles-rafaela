# Refactor & Calidad de Código — Muebles Rafaela

Mejora la calidad del código sin cambiar su comportamiento. Foco en legibilidad, mantenibilidad y eliminación de código duplicado en el archivo HTML único.

## Stack: Vanilla HTML + CSS3 + ES6+ + Firebase v10.12.2

---

## Principios de refactor para este proyecto

### 1. Eliminar duplicación en funciones render
Buscar HTML repetido entre `renderGrid()`, `renderAdminPanel()`, `renderAList()` y `openDet()`.
Extraer a funciones helper o template functions.

```javascript
// MAL: mismo bloque de card generado en 2 funciones distintas
function renderGrid() { ... `<div class="card">...<span>${p.categoria}</span>...` ... }
function openDet(id) { ... `<span class="cat-tag">${p.categoria}</span>...` ... }

// BIEN: función helper reutilizable
function catTag(cat) {
  return `<span class="cat-tag">${cat || 'Sin categoría'}</span>`;
}
```

### 2. Separar generación de HTML de lógica de negocio
Las funciones render no deben hacer lógica de negocio. Filtrar datos ANTES de pasarlos a render.

```javascript
// MAL: filtrar dentro de la función render
function renderGrid() {
  let ps = productos;
  if (filtro !== 'todos') ps = ps.filter(p => p.categoria === filtro);
  if (busqueda) ps = ps.filter(p => p.nombre.toLowerCase().includes(busqueda));
  // render...
}

// BIEN: función de filtrado separada
function productosFiltrados() {
  return productos
    .filter(p => filtro === 'todos' || p.categoria === filtro)
    .filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
}

function renderGrid() {
  const ps = productosFiltrados();
  // solo render...
}
```

### 3. Sanitizar HTML dinámico
Datos de usuario no deben insertarse directamente en innerHTML.

```javascript
// MAL: XSS si p.nombre contiene <script>...
grid.innerHTML = `<div class="card-nombre">${p.nombre}</div>`;

// BIEN: sanitizar con función helper
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
grid.innerHTML = `<div class="card-nombre">${esc(p.nombre)}</div>`;
```

### 4. Constantes para magic strings
```javascript
// MAL: strings repetidos en múltiples lugares
if (filtro === 'todos') { ... }
// En otro lado:
filtros.push('todos');

// BIEN: constante
const FILTRO_TODOS = 'todos';
if (filtro === FILTRO_TODOS) { ... }
```

### 5. Async/await limpio con try/catch/finally
```javascript
// MAL: sin finally → botón queda deshabilitado si hay error
async function guardar() {
  btn.disabled = true;
  try {
    await addDoc(...);
    toast('Guardado');
  } catch(e) {
    toast(e.message, 'err');
    btn.disabled = false; // olvidado si no hay catch
  }
}

// BIEN: finally garantiza que el botón se re-habilita siempre
async function guardar() {
  btn.disabled = true;
  try {
    await addDoc(...);
    toast('Guardado correctamente');
  } catch(e) {
    toast('Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}
```

### 6. Event delegation para listas dinámicas
```javascript
// MAL: listener por elemento → memory leaks con 1500 productos
productos.forEach(p => {
  document.getElementById('card-' + p.id).addEventListener('click', () => openDet(p.id));
});

// BIEN: un solo listener en el contenedor
document.getElementById('grid').addEventListener('click', e => {
  const card = e.target.closest('[data-id]');
  if (card) openDet(card.dataset.id);
});
// En el template: <div class="card" data-id="${p.id}">
```

### 7. Guard clauses en lugar de anidación
```javascript
// MAL: anidación profunda
function openDet(id) {
  const p = productos.find(x => x.id === id);
  if (p) {
    const overlay = document.getElementById('overlay');
    if (overlay) {
      // lógica...
    }
  }
}

// BIEN: early returns
function openDet(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  // lógica...
}
```

### 8. Fallbacks explícitos para campos opcionales de Firestore
```javascript
// MAL: ReferenceError si el campo no existe en el documento
const precio = p.precio.toLocaleString();

// BIEN: fallback explícito
const precio = p.precio ? pesos(p.precio) : '<span class="consultar">Consultar precio</span>';
```

### 9. CSS: variables en lugar de valores repetidos
```css
/* MAL: colores repetidos en múltiples selectores */
.btn-wsp { background: #25d366; }
.footer-wsp { background: #25d366; }

/* BIEN: variable CSS */
:root { --verde-wsp: #25d366; --verde-wsp-hover: #1da851; }
.btn-wsp, .footer-wsp { background: var(--verde-wsp); }
.btn-wsp:hover, .footer-wsp:hover { background: var(--verde-wsp-hover); }
```

### 10. Nombres de funciones y variables expresivos
```javascript
// MAL: nombres crípticos
function rAP() { ... }
const c = document.getElementById('alist');
let f = 'todos';

// BIEN: nombres que comunican intención
function renderAdminPanel() { ... }
const listaAdmin = document.getElementById('alist');
let filtroActivo = 'todos';
```

---

## Checklist de refactor

- [ ] ¿Hay HTML generado que se repite en varias funciones render? → Extraer helper
- [ ] ¿Hay datos de usuario insertados en innerHTML sin sanitizar? → Agregar esc()
- [ ] ¿Los magic strings aparecen en varios lugares? → Extraer constante
- [ ] ¿Los operaciones async tienen finally para re-habilitar botones?
- [ ] ¿Las listas dinámicas usan event delegation?
- [ ] ¿Hay anidación profunda que se puede aplanar con early returns?
- [ ] ¿Los campos de Firestore tienen fallbacks para cuando no existen?
- [ ] ¿Los colores CSS repetidos tienen sus variables?
- [ ] ¿Las funciones tienen nombres que describen su intención?

---

## Pase de limpieza estructurado (ejecutar después de cualquier modificación)

Restricción absoluta: **nunca cambiar el comportamiento, solo cómo se expresa.**

### Regla 1: Aplanar condicionales anidados → guard clauses (ver punto 7 arriba)

### Regla 2: Eliminar variables temporales que solo se usan para retornar
```javascript
// MAL
const resultado = productos.filter(p => p.categoria === filtro);
return resultado;
// BIEN
return productos.filter(p => p.categoria === filtro);
```

### Regla 3: Template literals sobre concatenación
```javascript
// MAL
'Hola! Consulto por: ' + nombre + ' - ' + precio;
// BIEN
`Hola! Consulto por: ${nombre} - ${precio}`;
```

### Regla 4: Optional chaining para accesos encadenados
```javascript
// MAL: TypeError si p o p.imagen es undefined
if (p && p.imagen && p.imagen.url) { ... }
// BIEN
if (p?.imagen?.url) { ... }
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
const p = productos.find(x => x.id === id);

// BIEN: sin comentario (el código ya es claro)
const p = productos.find(x => x.id === id);
```

$ARGUMENTS
