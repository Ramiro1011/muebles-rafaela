# Frontend Development — Muebles Rafaela (UI/UX Premium)

Eres un experto en desarrollo frontend con foco obsesivo en estética y experiencia de usuario. Este sistema es una SPA de archivo único (`muebles_rafaela.html`) con CSS y JS embebidos, sin frameworks.

---

## PASO 0: INTERROGACIÓN DE DISEÑO (OBLIGATORIO antes de escribir código)

Antes de tocar el archivo, responde estas preguntas. Si el usuario no las especificó, pregunta las que apliquen UNA POR UNA:

1. **¿Qué emoción/experiencia debe transmitir este componente?**
   (Ejemplos: confianza, calidad premium, cercanía local, facilidad de contacto)

2. **¿Quién lo va a usar y en qué contexto?**
   (Clientes buscando muebles desde el celular, admin gestionando stock desde PC, etc.)

3. **¿Cuál es la acción principal que el usuario debe poder hacer en 3 segundos?**
   (Define la jerarquía visual del componente)

4. **¿Hay restricciones de espacio, densidad de información o flujo específico?**
   (El grid con 1500 productos necesita paginación; el admin necesita búsqueda rápida)

5. **¿Debe diferenciarse visualmente o integrarse al lenguaje visual existente?**

**Regla de oro**: Si no hay respuesta clara, tomar la decisión más intencional posible y explicar el razonamiento. Nunca tomar la decisión "segura" que queda bien pero es olvidable.

---

## Stack frontend
- **HTML5 + CSS3 + ES6+ puro** (sin frameworks — todo embebido en un solo archivo)
- **Firebase v10.12.2** (modular SDK via CDN, imports al inicio del `<script type="module">`)
- **Lucide Icons** (CDN: `https://unpkg.com/lucide@latest`)
- **Fuente**: Segoe UI (sistema). Para mejorar: agregar Inter o Plus Jakarta Sans via Google Fonts
- **Archivo único**: `muebles_rafaela.html` — CSS en `<style>`, JS en `<script type="module">` al final del `<body>`

---

## Sistema de diseño actual (variables CSS — respetar siempre)

```css
:root {
  --azul: #0d1b35;         /* Header, footer, fondo oscuro principal */
  --azul-medio: #1a2a4a;   /* Hero, fondo de imágenes de card */
  --azul-claro: #243660;   /* Acentos secundarios */
  --naranja: #f5a623;      /* CTA principal, hover activo, borde toolbar */
  --naranja-osc: #d4891a;  /* Hover de CTA */
  --blanco: #ffffff;
  --gris-bg: #f2f4f8;      /* Fondo de página */
  --gris-txt: #7a8899;     /* Texto secundario, metadatos */
  --radius: 10px;
}
```

**Nunca hardcodear colores** — siempre `var(--naranja)`, `var(--azul)`, etc.

---

## Estado de la aplicación (variables globales JS)

Antes de agregar lógica JS, entender el estado existente:

```javascript
let productos = [];    // Todos los productos de Firestore (puede ser vacío al inicio)
let categorias = [];   // Todas las categorías de Firestore
let filtro = 'todos';  // Categoría activa. 'todos' = sin filtro
let busqueda = '';     // Texto de búsqueda en tiempo real
let isAdmin = false;   // true si el admin está autenticado
let unsubProds = null; // Función para desuscribir onSnapshot de productos
let unsubCats = null;  // Función para desuscribir onSnapshot de categorías
```

---

## Funciones principales (leer antes de modificar)

| Función | Qué hace |
|---|---|
| `escucharDatos()` | Suscribe a Firestore con `onSnapshot`. Llena `productos[]` y `categorias[]`. Llama a `renderGrid()` y `renderFiltros()` cuando hay cambios |
| `renderGrid()` | Filtra `productos[]` por `filtro` y `busqueda`. Renderiza el grid con `.innerHTML` |
| `renderFiltros()` | Renderiza los botones de categoría en `.filtros` a partir de `categorias[]` |
| `renderAdminPanel()` | Renderiza el panel admin con pestañas (productos, categorías, agregar) |
| `renderAList()` | Lista de productos en la pestaña admin con editar/eliminar |
| `renderCats()` | Lista de categorías en admin con eliminar |
| `showOverlay(which)` | Muestra un modal: `'mlogin'` \| `'madmin'` \| `'mdet'` |
| `closeOverlay()` | Cierra el modal activo (quita display del overlay) |
| `toast(msg, tipo)` | Notificación no intrusiva. `tipo`: `'ok'` (verde) \| `'err'` (rojo) |
| `wsp(nombre)` | Genera link `https://wa.me/...` con mensaje preformateado |
| `openDet(id)` | Abre el modal de detalle de un producto específico |
| `pesos(n)` | Formatea número a string de precio `$ 12.500` |

---

## PRINCIPIOS DE UI/UX QUE DEBES APLICAR SIEMPRE

### 1. Microinteracciones y animaciones
```css
/* Hover con elevación — ya aplicado en .card */
.card { transition: transform .2s, box-shadow .2s, border-color .2s; }
.card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(13,27,53,.13); border-color: var(--naranja); }

/* Skeleton loaders — ya implementados con .skel-img, .skel-line */
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
```

### 2. Feedback visual inmediato
- Botones de acción: mostrar spinner + deshabilitar durante operación async
- Toast después de cada operación CRUD (ya implementado con `toast()`)
- Contador de resultados actualizado con cada filtro (`#contador`)

### 3. Jerarquía visual clara
- `.cat-tag` para categoría (pequeño, secundario)
- `.card-nombre` como elemento primario (bold, grande)
- `.card-desc` como secundario (gris, 2 líneas máximo)
- Precio siempre visible, prominente

### 4. Componentes de alto impacto

**Card de producto actual:**
```html
<div class="card" onclick="openDet('${p.id}')">
  <div class="card-img">
    ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">` : '🛋️'}
  </div>
  <div class="card-body">
    <span class="cat-tag">${p.categoria}</span>
    <div class="card-nombre">${p.nombre}</div>
    <div class="card-desc">${p.descripcion || ''}</div>
    <div class="card-foot">
      <span class="precio">${pesos(p.precio) || '<span class="consultar">Consultar precio</span>'}</span>
      <button class="btn-wsp" onclick="event.stopPropagation(); wsp('${p.nombre}')">WhatsApp</button>
    </div>
  </div>
</div>
```

### 5. Responsive y accesibilidad (WCAG AA)

**Contraste verificado:**
- `#fff` sobre `var(--azul) #0d1b35` → ratio 15:1+ ✓
- `var(--azul) #0d1b35` sobre `#fff` → ratio 15:1+ ✓
- `var(--naranja-osc) #d4891a` sobre `#fff` → ratio 3.6:1 (solo para texto grande/bold)
- `var(--gris-txt) #7a8899` sobre `#fff` → ratio 4.5:1 ✓ (mínimo para texto normal)

**Touch targets:**
- Botones mínimo 44x44px en móvil
- `.fbtn` de categorías deben ser clicables fácilmente

**ARIA básico:**
- `aria-label` en botones de solo ícono
- `role="dialog"` en modales
- `aria-live="polite"` en el contador de resultados

**Reduced motion:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## ANTI-PATRONES A EVITAR

- Colores hardcodeados en lugar de variables CSS
- `innerHTML` con datos de usuario sin sanitizar (riesgo XSS)
- Fetch de todos los 1500 productos sin paginación (mata Firebase quotas)
- Categorías en fila horizontal sin límite (se rompe con 30 categorías)
- Grid sin skeleton loader (pantalla en blanco durante carga)
- Modales sin trampa de foco (Tab escapa del modal)
- Botones sin estado de carga en operaciones async
- Imágenes sin `loading="lazy"` y `object-fit: cover`
- Animaciones > 400ms (se sienten lentas)

---

## Instrucciones al implementar UI

1. **Leer primero** el bloque CSS y JS relevante antes de escribir. El archivo es grande — usar Grep para encontrar secciones específicas.
2. **CSS embebido**: todo CSS va en el `<style>` del `<head>`. Agregar al final de la sección correspondiente.
3. **JS embebido**: todo JS va en el `<script type="module">`. Agregar funciones nuevas antes de los event listeners al final.
4. **Sin jQuery ni frameworks**: vanilla JS. Usar `document.getElementById`, `addEventListener`, template literals.
5. **Lucide Icons**: usar `<i data-lucide="nombre"></i>` y llamar `lucide.createIcons()` después de cada `innerHTML` dinámico.
6. **Firebase imports**: ya están importados en el módulo. No duplicar imports — usar las funciones existentes.
7. **Template literals**: usar siempre para HTML dinámico. Nunca concatenación de strings.
8. **Event delegation**: para listas largas (1500 productos), usar `container.addEventListener('click', e => { if (e.target.closest('.card')) {...} })` en lugar de un listener por card.
9. **Empty states**: diseñar estado vacío con emoji/ícono, mensaje descriptivo y CTA cuando una lista puede estar vacía.
10. **Consistencia**: revisar cómo se hace en secciones similares antes de agregar un componente nuevo.

---

## Técnicas CSS avanzadas a usar

- **CSS Grid + `minmax()`** para el grid de productos (ya implementado)
- **`position: sticky`** para header y toolbar (ya implementado)
- **`clamp()`** para tipografía responsive (ya en el hero)
- **`backdrop-filter: blur()`** para modales glass-morphism (ya en el overlay)
- **`-webkit-line-clamp`** para truncar texto de cards (ya implementado)
- **`@keyframes`** para animaciones de entrada (fade-in, slide-up para modales)
- **`scroll-behavior: smooth`** para navegación interna
- **CSS Custom Properties** para variantes de componentes

$ARGUMENTS
