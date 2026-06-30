# Investigación y Propuesta de Mejoras — Muebles Rafaela

## Contexto de análisis
Catálogo de ~1500 productos y ~30 categorías. Referentes analizados: IKEA, Ashley Furniture,
Sodimac, Megatone, Easy, y catálogos regionales de mueblería argentina.

---

## PROBLEMAS CRÍTICOS CON LA ESCALA ACTUAL

### Problema 1 — Los filtros de categoría no escalan a 30 categorías
**Estado actual**: botones `.fbtn` en fila horizontal en la toolbar.
**Con 30 categorías**: se rompe el layout, overflow horizontal invisible, experiencia terrible en móvil.

**Solución**: Sidebar de categorías (desktop) + Bottom sheet (móvil).

### Problema 2 — Cargar 1500 productos de una sola vez
**Estado actual**: `onSnapshot` carga todos los documentos de Firestore en memoria.
**Con 1500 productos**: ~300-500ms de espera, ~200-400 KB de JSON, 1500 reads de Firestore por visita.

**Solución**: Paginación de 24 productos con "Cargar más" o scroll infinito.

### Problema 3 — Búsqueda solo en memoria (client-side)
**Estado actual**: filtra `productos[]` en el browser por `nombre.includes(busqueda)`.
**Con 1500 productos**: funciona pero limita la búsqueda a lo que está cargado en memoria.
Si hay paginación, la búsqueda no encuentra productos en páginas no cargadas.

**Solución**: Si se implementa paginación, mover búsqueda a Firestore con `.where()` o integrar Algolia.

---

## MEJORAS VISUALES

### V1 — Sidebar de Navegación por Categorías ⭐⭐⭐ (IMPACTO ALTO)

**Referente**: IKEA usa sidebar fija con categorías agrupadas.

```
[DESKTOP]
+--sidebar (240px)--+-------grid de productos---------+
| 🪑 Sillones (124) |  [card] [card] [card] [card]    |
| 🛋️ Sofás (87)     |  [card] [card] [card] [card]    |
| 🛏️ Dormitorio     |  ...                            |
|   > Camas (45)    |                                 |
|   > Placard (32)  |                                 |
| 🍽️ Comedor (76)   |                                 |
+-------------------+---------------------------------+

[MÓVIL]
[Filtrar ▼]  ← botón que abre bottom sheet
Bottom sheet con lista scrollable de categorías
```

**Beneficios**:
- 30 categorías visibles sin overflow
- Contador de productos por categoría genera confianza
- Sub-categorías (acordeón) para organización jerárquica
- En móvil: bottom sheet es patrón nativo y moderno

---

### V2 — Barra de Herramientas Mejorada ⭐⭐ (IMPACTO MEDIO)

**Estado actual**: search input + botones de categoría en fila.
**Mejora**: Search + Sort + View toggle + contador de resultados.

```
[🔍 Buscar productos...] [Ordenar: Nombre ▼] [⊞] [☰]   24 de 1500 productos
```

**Elementos a agregar**:
- **Ordenar por**: Nombre A-Z / Nombre Z-A / Precio menor / Precio mayor / Más recientes
- **Toggle de vista**: Grid (4 columnas) / Lista (1 columna con más detalle)
- **Rango de precio**: slider o inputs min/max (filtro muy pedido en mueblería)
- **Mostrar solo**: "Con precio" / "Consultar precio" / "Destacados"

---

### V3 — Cards Mejoradas ⭐⭐ (IMPACTO MEDIO)

**Referente**: Sodimac y Ashley muestran más info sin abrir detalle.

**Mejoras en el card**:
```
+--card (hover levanta + naranja border)---+
| [imagen 220px, lazy loading]             |
| [badge NUEVO] [badge DESTACADO]          |
|                                          |
| SILLONES                                 |
| Sillón 3 Cuerpos Premium                 |
| Tapizado en tela beige...                |
|                                          |
| $ 85.000                                 |
| [💬 Consultar]     [❤ Favorito]          |
+------------------------------------------+
```

**Cambios concretos**:
- Badges de estado (NUEVO, DESTACADO, OFERTA) con color semántico
- Botón de favoritos (guardado en localStorage, sin login requerido)
- Imagen con `loading="lazy"` y placeholder elegante (no emoji solitario)
- Al hover: mostrar overlay con "Ver detalle" en lugar de todo el card clickeable

---

### V4 — Modal de Detalle Mejorado ⭐⭐ (IMPACTO MEDIO)

**Estado actual**: modal simple con imagen y datos básicos.

**Mejora**:
```
+--------modal (max-width: 900px)----------------------------+
|                                        [✕]                |
| [imagen grande]  | SILLONES                               |
| [thumb] [thumb]  | Sillón 3 Cuerpos Premium               |
|                  |                                         |
|                  | $ 85.000                                |
|                  |                                         |
|                  | Descripción completa del producto...    |
|                  |                                         |
|                  | Colores: [⬛] [⬜] [🟤]                 |
|                  |                                         |
|                  | [💬 Consultar por WhatsApp]             |
|                  | [📋 Copiar enlace del producto]         |
+------------------------------------------------------------+
```

**Cambios concretos**:
- Layout 2 columnas en desktop (imagen | info)
- URL única por producto (`?producto=ID`) para compartir directamente
- Galería de imágenes (múltiples fotos por producto)
- Campos opcionales: dimensiones, materiales, colores disponibles

---

### V5 — Sección Hero Mejorada ⭐ (IMPACTO BAJO)

**Estado actual**: hero estático con texto y badges.

**Mejora**:
- Carousel de banners (promociones, novedades)
- O simplificar: hero más pequeño para priorizar el catálogo
- Buscador grande centrado al estilo Google/Amazon ("Buscá tu mueble ideal")

---

### V6 — Vista de Lista ⭐ (IMPACTO BAJO-MEDIO)

**Referente**: Megatone tiene toggle grid/lista. En lista se ve más info sin hacer click.

```
[lista view]
+--imagen 120x90--+--nombre + descripción larga--+--precio--+--[consultar]--+
|    [img]        | Sillón 3 Cuerpos Premium      | $ 85.000 | [💬 WhatsApp] |
|                 | Tapizado en tela beige, con   |          |               |
|                 | estructura de madera maciza   |          |               |
+-----------------+-------------------------------+----------+---------------+
```

---

## MEJORAS FUNCIONALES

### F1 — Paginación / Scroll Infinito ⭐⭐⭐ (CRÍTICO para 1500 productos)

**Recomendación**: "Cargar más" (mejor UX que paginación numerada para catálogo).

```javascript
// Implementación con cursor de Firestore
import { limit, startAfter } from "firebase-firestore";
const PAGE_SIZE = 24;
let ultimoCursor = null;
let hayMas = true;

async function cargarPagina() {
  let q = query(collection(db, 'productos'), orderBy('nombre'), limit(PAGE_SIZE));
  if (ultimoCursor) q = query(q, startAfter(ultimoCursor));
  const snap = await getDocs(q);
  ultimoCursor = snap.docs.at(-1);
  hayMas = snap.docs.length === PAGE_SIZE;
  productos = [...productos, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))];
  renderGrid();
}
```

**Alternativa más simple**: cargar todo pero mostrar de a 24 con "Cargar más" client-side.
No resuelve el problema de Firestore reads pero sí el problema de render lento.

---

### F2 — Filtros Múltiples ⭐⭐⭐ (IMPACTO ALTO)

**Estado actual**: filtro por UNA categoría a la vez.
**Mejora**: filtros combinables.

```javascript
let filtros = {
  categorias: [],      // Array de categorías seleccionadas (multi-select)
  precioMin: null,     // número
  precioMax: null,     // número
  soloConPrecio: false,
  soloDestacados: false,
  ordenamiento: 'nombre-asc'  // 'nombre-asc' | 'nombre-desc' | 'precio-asc' | 'precio-desc'
};

function productosFiltrados() {
  return productos
    .filter(p => !filtros.categorias.length || filtros.categorias.includes(p.categoria))
    .filter(p => filtros.precioMin === null || (p.precio && p.precio >= filtros.precioMin))
    .filter(p => filtros.precioMax === null || (p.precio && p.precio <= filtros.precioMax))
    .filter(p => !filtros.soloDestacados || p.destacado)
    .sort((a, b) => {
      if (filtros.ordenamiento === 'precio-asc') return (a.precio || 0) - (b.precio || 0);
      if (filtros.ordenamiento === 'precio-desc') return (b.precio || 0) - (a.precio || 0);
      return a.nombre.localeCompare(b.nombre, 'es');
    });
}
```

---

### F3 — URL Compartible por Producto ⭐⭐ (IMPACTO ALTO para negocio)

**Problema actual**: no se puede compartir un producto específico (no hay URL).
**Solución**: usar hash o query params.

```javascript
// Al abrir detalle: actualizar URL
function openDet(id) {
  history.pushState(null, '', '?p=' + id);
  // ... mostrar modal
}

// Al cargar la página: revisar si hay ID en URL
window.addEventListener('load', () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('p');
  if (id) {
    // Esperar a que los productos carguen, luego abrir el detalle
    // (manejar con Promise o callback en escucharDatos)
  }
});

// Al cerrar modal: limpiar URL
function closeOverlay() {
  history.pushState(null, '', location.pathname);
  // ... ocultar modal
}
```

---

### F4 — Favoritos (sin login) ⭐⭐ (IMPACTO MEDIO)

**Referente**: IKEA tiene lista de deseos sin login (localStorage).

```javascript
// Guardar en localStorage
function toggleFavorito(id, event) {
  event.stopPropagation();
  const favs = JSON.parse(localStorage.getItem('favs') || '[]');
  const idx = favs.indexOf(id);
  if (idx === -1) favs.push(id);
  else favs.splice(idx, 1);
  localStorage.setItem('favs', JSON.stringify(favs));
  renderGrid(); // actualizar ícono de corazón
}

function esFavorito(id) {
  return JSON.parse(localStorage.getItem('favs') || '[]').includes(id);
}
```

**En el card**:
```html
<button class="btn-fav ${esFavorito(p.id) ? 'activo' : ''}" 
        onclick="toggleFavorito('${p.id}', event)">
  ♥
</button>
```

**Filtro adicional**: "Ver mis favoritos" en la toolbar.

---

### F5 — Panel Admin Mejorado ⭐⭐ (IMPACTO MEDIO para el cliente)

**Problemas actuales**:
- Sin imágenes reales (solo URL externa)
- Sin búsqueda en el admin
- Sin bulk operations
- Sin paginación en lista de 1500 productos

**Mejoras**:

#### F5a — Carga de imágenes via Firebase Storage
```javascript
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase-storage";
const storage = getStorage(app);

async function subirImagen(file) {
  const storageRef = ref(storage, 'productos/' + Date.now() + '_' + file.name);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
```

#### F5b — Búsqueda en admin
```javascript
let busquedaAdmin = '';
function renderAList() {
  let ps = productos;
  if (busquedaAdmin) ps = ps.filter(p => p.nombre.toLowerCase().includes(busquedaAdmin.toLowerCase()));
  // ... render
}
```

#### F5c — Renombrar categoría en cascada
Al renombrar una categoría, actualizar todos los productos que la usan (batch write):
```javascript
async function renombrarCat(viejo, nuevo) {
  const batch = writeBatch(db);
  productos.filter(p => p.categoria === viejo)
           .forEach(p => batch.update(doc(db, 'productos', p.id), { categoria: nuevo }));
  batch.update(doc(db, 'categorias', catId), { nombre: nuevo });
  await batch.commit();
}
```

---

### F6 — Producto Destacado / Sección Especial ⭐ (IMPACTO BAJO-MEDIO)

**Campo** `destacado: true` en documentos de Firestore.

**Sección** "Productos Destacados" arriba del grid principal (carousel horizontal o grid 4col).

Permite al cliente administrar qué productos mostrar primero sin afectar el catálogo completo.

---

### F7 — WhatsApp Mejorado ⭐ (IMPACTO ALTO para negocio)

**Estado actual**: mensaje simple con nombre del producto.
**Mejora**: mensaje más completo para facilitar la consulta.

```javascript
function wsp(producto) {
  const lines = [`Hola! Me comunico desde el catálogo online.`];
  lines.push(`Consulto por: *${producto.nombre}*`);
  if (producto.categoria) lines.push(`Categoría: ${producto.categoria}`);
  if (producto.precio) lines.push(`Precio visto: ${pesos(producto.precio)}`);
  lines.push(`¿Está disponible?`);
  const msg = encodeURIComponent(lines.join('\n'));
  window.open(`https://wa.me/5493492XXXXXX?text=${msg}`, '_blank');
}
```

---

## HOJA DE RUTA SUGERIDA

### Fase 1 — Crítico (escala) 
- [ ] **F1** Paginación / "Cargar más" (sin esto, 1500 productos no funcionan bien)
- [ ] **V1** Sidebar de categorías (30 categorías no caben en botones horizontales)
- [ ] **F2** Filtros múltiples + ordenamiento

### Fase 2 — Alto impacto visual y de negocio
- [ ] **F3** URLs compartibles por producto
- [ ] **V2** Toolbar mejorada (sort, view toggle, contador)
- [ ] **V3** Cards mejoradas (badges, lazy loading, favoritos)
- [ ] **F7** WhatsApp con mensaje mejorado

### Fase 3 — Mejoras de experiencia
- [ ] **F4** Favoritos en localStorage
- [ ] **F5a** Imágenes via Firebase Storage
- [ ] **V4** Modal de detalle 2 columnas
- [ ] **F5b/c** Admin con búsqueda y renombrado en cascada

### Fase 4 — Nice to have
- [ ] **F6** Sección de destacados / carousel
- [ ] **V6** Vista de lista
- [ ] **V5** Hero simplificado o con banner rotativo

---

## ESTIMACIÓN DE ESFUERZO

| Feature | Esfuerzo | Impacto |
|---------|----------|---------|
| Paginación client-side (cargar todo, mostrar de a 24) | 1h | CRÍTICO |
| Sidebar categorías desktop + bottom sheet móvil | 3h | ALTO |
| Filtros múltiples + sort | 2h | ALTO |
| URLs compartibles | 1h | ALTO |
| Cards con lazy loading + badges | 1h | MEDIO |
| Firebase Storage para imágenes | 2h | MEDIO |
| Favoritos localStorage | 1h | MEDIO |
| Admin: búsqueda + renombrado en cascada | 2h | MEDIO |
| Modal detalle 2 columnas | 1h | MEDIO |
| WhatsApp mensaje mejorado | 30min | ALTO |
