# Investigación y Propuesta de Mejoras — Muebles Rafaela

## Contexto de análisis
Catálogo de ~1500 productos y ~30 categorías, ahora sobre **SvelteKit 5 + Firebase v12 + Cloudinary**. Este documento listaba mejoras frente al viejo SPA de archivo único; gran parte de la Fase 1 y 2 de la hoja de ruta original **ya está implementada** tras la migración. Referentes originales: IKEA, Ashley Furniture, Sodimac, Megatone, Easy, catálogos regionales de mueblería argentina.

---

## ESTADO ACTUAL — qué ya está resuelto

| Item original | Estado | Dónde |
|---|---|---|
| F1 Paginación | ✅ Implementado | `catalogo/+page.svelte` (`POR_PAG = 24`), `admin/+page.svelte` (`POR_PAG_ADMIN = 20`) — client-side slice sobre datos ya cargados por `onSnapshot` |
| V1 Sidebar de categorías | ✅ Implementado | `catalogo/+page.svelte`, con contador por categoría (`conteoCategoria`) y bottom-sheet/overlay en móvil (`sidebarOpen`) |
| F2 Filtros múltiples + orden | ✅ Implementado | Stores `filtroCategoria`, `filtroMaterial`, `precioMin/Max`, `soloDestacados`, `ordenamiento` combinados en el derived `productosFiltrados` |
| V2 Toolbar mejorada | ✅ Implementado | `catalog-controls`: sort select, toggle grid/lista, contador de resultados |
| V3 Cards mejoradas | ✅ Implementado (parcial) | Badges (`nuevo`, `descuento`), colores (`colores[]`), lazy loading. **Falta**: botón de favoritos |
| V4 Modal de detalle | ✅ Implementado | Layout 2 columnas, galería con thumbs (`imagenesModal`), URL compartible (`?p=id`), botón copiar enlace |
| F3 URL compartible por producto | ✅ Implementado | `history.pushState` en `abrirDetalle()`/`cerrarDetalle()`, lectura de `?p=` en `onMount` |
| F5a Imágenes vía servicio externo | ✅ Implementado (con Cloudinary, no Firebase Storage) | `subirImagenCloudinary()` en `$lib/firebase.js`, con barra de progreso |
| F5b Búsqueda en admin | ✅ Implementado | `busquedaAdmin` + `catAdmin` filtrando `prodsFiltrados` en `admin/+page.svelte` |
| F6 Producto destacado | ✅ Implementado | Campo `destacado`, filtro `soloDestacados` |
| F7 WhatsApp mejorado | ✅ Implementado (parcial) | Mensaje con nombre del producto; **no** incluye categoría/precio como proponía el plan original |
| "Vistos recientemente" (no estaba en el plan original) | ✅ Implementado | `localStorage` (`mr_vistos`), sección debajo del grid |
| Múltiples categorías por producto (no estaba en el plan original) | ✅ Implementado | Campo `categorias[]` + legacy `categoria` string, checkboxes en el form admin |
| Stock / badges de últimas unidades (no estaba en el plan original) | ✅ Implementado | Campo `stock`, badges condicionales en card y modal |

---

## PENDIENTE — lo que sigue sin resolver

### F4 — Favoritos (sin login) ⭐⭐ (IMPACTO MEDIO)
No implementado. El patrón sigue siendo válido:
```javascript
// stores.js — nuevo store
export const favoritos = writable(JSON.parse(localStorage.getItem('mr_favs') || '[]'));
export function toggleFavorito(id) {
  favoritos.update(favs => {
    const nuevo = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
    localStorage.setItem('mr_favs', JSON.stringify(nuevo));
    return nuevo;
  });
}
```
Agregar botón de corazón en `.product-card` (ver `V3` arriba) y un filtro "Ver mis favoritos" en la sidebar del catálogo, junto a "Solo destacados".

### F5c — Renombrar categoría en cascada ⭐⭐ (IMPACTO MEDIO)
**Riesgo real detectado**: `guardarCat()` en `admin/+page.svelte` (línea ~247) actualiza el campo `nombre` del documento en `categorias`, pero **no** actualiza el string correspondiente en el array `categorias[]`/`categoria` de los productos que la referencian. Resultado: al renombrar una categoría, los productos existentes quedan apuntando al nombre viejo y "desaparecen" de ese filtro hasta que se editan uno por uno.

```javascript
import { writeBatch } from 'firebase/firestore';

async function guardarCat(id) {
  if (!editCatNombre.trim()) return;
  const catActual = $categorias.find(c => c.id === id);
  const nombreViejo = catActual?.nombre;
  const nombreNuevo = editCatNombre.trim();
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'categorias', id), { nombre: nombreNuevo });
    $productos.filter(p => getCats(p).includes(nombreViejo)).forEach(p => {
      const cats = getCats(p).map(c => c === nombreViejo ? nombreNuevo : c);
      batch.update(doc(db, 'productos', p.id), { categorias: cats, categoria: cats[0] });
    });
    await batch.commit();
    toast('Categoría actualizada');
    editCatId = '';
  } catch (err) {
    toast('Error: ' + err.message, 'err');
  }
}
```
Máximo 500 docs por batch — si alguna categoría llegara a tener más productos que eso, habría que dividir en múltiples batches.

### V5 — Sección Hero Mejorada ⭐ (IMPACTO BAJO)
La landing (`+page.svelte`) sigue siendo un hero configurable desde `configLanding`, sin carousel de banners. Si se quiere, es una mejora de UI pura, no de arquitectura.

### V6 — Vista de Lista
Parcialmente cubierto por el toggle grid/lista de V2 (`vistaLista` + clase `.list-view`) — verificar si el CSS de `.list-view` realmente muestra más info por fila (descripción larga, precio, botón) como proponía el mockup original, o si solo cambia el layout del grid sin agregar contenido.

---

## NUEVAS OPORTUNIDADES (post-migración, no estaban en el análisis original)

### N1 — Validación de formularios en el admin
`guardarProd()` valida solo que el nombre no esté vacío. Ver `commands/seguridad.md` punto 7 para validaciones concretas a agregar (precio no negativo, longitud de nombre).

### N2 — Restricciones en el preset unsigned de Cloudinary
Ver `commands/seguridad.md` — el preset unsigned permite subir archivos desde fuera de la app. Configurar límites de tamaño/tipo en el dashboard de Cloudinary, no en código.

### N3 — Loading states en navegación entre rutas
Con `adapter-static`, la navegación es client-side vía SvelteKit router — verificar si hay algún indicador de carga entre rutas (`/` → `/catalogo`) o si se siente instantáneo por el tamaño actual del bundle.

---

## HOJA DE RUTA ACTUALIZADA

### Ya completado (no requiere trabajo)
- [x] F1 Paginación
- [x] V1 Sidebar de categorías
- [x] F2 Filtros múltiples + ordenamiento
- [x] F3 URLs compartibles
- [x] V2 Toolbar mejorada
- [x] V3 Cards mejoradas (badges, lazy loading) — falta favoritos
- [x] V4 Modal de detalle 2 columnas
- [x] F5a Imágenes vía Cloudinary
- [x] F5b Admin con búsqueda
- [x] F6 Sección de destacados
- [x] F7 WhatsApp con mensaje básico

### Pendiente — priorizado
- [ ] **F5c** Renombrar categoría en cascada (bug latente, no solo feature — ver arriba) ⭐⭐⭐
- [ ] **N1** Validación de formularios admin (seguridad, no solo UX) ⭐⭐
- [ ] **N2** Restricciones del preset Cloudinary (seguridad) ⭐⭐
- [ ] **F4** Favoritos en localStorage ⭐⭐
- [ ] **V6** Confirmar que la vista de lista muestra info adicional real ⭐
- [ ] **V5** Hero con carousel o banner rotativo ⭐

$ARGUMENTS
