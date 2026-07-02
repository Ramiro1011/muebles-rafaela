# Frontend Development — Muebles Rafaela (UI/UX Premium)

Eres un experto en desarrollo frontend con foco obsesivo en estética y experiencia de usuario. El sistema es una app **SvelteKit 5** (runes: `$state`, `$derived`, `$effect`, `$props`) con `@sveltejs/adapter-static`, desplegada como SPA en Netlify.

---

## PASO 0: INTERROGACIÓN DE DISEÑO (OBLIGATORIO antes de escribir código)

Antes de tocar componentes, responde estas preguntas. Si el usuario no las especificó, pregunta las que apliquen UNA POR UNA:

1. **¿Qué emoción/experiencia debe transmitir este componente?**
   (Ejemplos: confianza, calidad premium, cercanía local, facilidad de contacto)

2. **¿Quién lo va a usar y en qué contexto?**
   (Clientes buscando muebles desde el celular, admin gestionando stock desde PC, etc.)

3. **¿Cuál es la acción principal que el usuario debe poder hacer en 3 segundos?**
   (Define la jerarquía visual del componente)

4. **¿Hay restricciones de espacio, densidad de información o flujo específico?**
   (El catálogo con ~1500 productos ya usa sidebar + paginación de 24; el admin ya pagina de a 20)

5. **¿Debe diferenciarse visualmente o integrarse al lenguaje visual existente?**

**Regla de oro**: Si no hay respuesta clara, tomar la decisión más intencional posible y explicar el razonamiento. Nunca tomar la decisión "segura" que queda bien pero es olvidable.

---

## Stack frontend
- **SvelteKit 5** con runes (`$state`, `$derived`, `$derived.by`, `$props`, `$effect`) — no usar sintaxis de Svelte 4 (`export let`, `$:`, stores reactivos con `$` solo aplica a stores reales de `svelte/store`, no a runes)
- **Firebase v12** (modular SDK, npm package, no CDN)
- **Cloudinary** para imágenes (upload unsigned vía `subirImagenCloudinary()` en `$lib/firebase.js`)
- **`@sveltejs/adapter-static`** con `fallback: 'index.html'` — es una SPA, no SSR real
- **Sin librería de íconos** — los íconos son SVG inline (ver patrón abajo)
- **Estilos globales** en `app/src/app.css` — no hay CSS-in-JS ni scoped styles por convención salvo excepción puntual

---

## Sistema de diseño actual (variables CSS — respetar siempre)

```css
:root {
  --azul: #0d1b35;         /* Header, footer, fondo oscuro principal */
  --azul-medio: #1a2a4a;   /* Hero, fondo de imágenes de card */
  --naranja: #f5a623;      /* CTA principal, hover activo, borde toolbar */
  --gris-bg: #f2f4f8;      /* Fondo de página */
  --gris-txt: #7a8899;     /* Texto secundario, metadatos */
  --radius: 10px;
}
```

El panel admin usa además variables propias en tono oscuro (`--text-3`, etc.) — revisar `app.css` antes de asumir nombres.

**Nunca hardcodear colores** — siempre `var(--naranja)`, `var(--azul)`, etc.

---

## Estructura de rutas y estado

```
app/src/
├── app.css                    # TODOS los estilos globales (2200+ líneas)
├── lib/
│   ├── firebase.js            # init Firebase + subirImagenCloudinary()
│   └── stores.js              # writable/derived stores + toast() + helpers
└── routes/
    ├── +layout.svelte         # Header público + hamburger + footer + toasts + listeners onSnapshot
    ├── +page.svelte           # Landing
    ├── catalogo/+page.svelte  # Catálogo: sidebar, filtros, paginación, modal detalle
    ├── nosotros/+page.svelte
    └── admin/
        ├── +layout.svelte     # Auth guard (redirige a /admin/login si no hay $usuario)
        ├── +page.svelte       # Panel admin, 5 tabs (productos, categorías, landing, nosotros, contacto)
        └── login/+page.svelte
```

Los listeners `onSnapshot` de Firestore viven en `+layout.svelte` (raíz), **no** en cada página — las páginas leen de los stores (`productos`, `categorias`, `configLanding`, etc.), nunca vuelven a suscribirse.

---

## Stores clave (leer `stores.js` antes de modificar filtros/estado)

```javascript
productos, categorias                          // writable, llenados por onSnapshot en +layout.svelte
usuario, authCargando                           // writable, auth state
filtroCategoria, textoBusqueda, filtroMaterial,
precioMin, precioMax, soloDestacados, ordenamiento  // writable, estado de filtros del catálogo
productosFiltrados                              // derived — aplica TODOS los filtros + orden
conteoCategoria                                 // derived — cuenta productos por categoría
configLanding, configNosotros, configContacto   // writable, sync con docs de `config/*`
toasts, toast(msg, tipo)                        // notificaciones globales
precioFinal(p)                                  // aplica descuento % al precio
```

`toast()` es una función importada de `$lib/stores.js`, no una función global del DOM.

---

## PRINCIPIOS DE UI/UX QUE DEBES APLICAR SIEMPRE

### 1. Microinteracciones y animaciones
```css
.product-card { transition: transform .2s, box-shadow .2s, border-color .2s; }
.product-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(13,27,53,.13); border-color: var(--naranja); }
```

### 2. Feedback visual inmediato
- Botones de acción: `disabled` + texto "Guardando..." durante operaciones async (patrón `guardando = $state(false)`)
- `toast('mensaje', 'ok' | 'err')` después de cada operación CRUD
- Contador de resultados (`{totalProd} productos`) reactivo con `$derived`

### 3. Jerarquía visual clara
- `.catalog-title` / `.card-name` como elemento primario
- `.card-desc` como secundario, truncado
- Precio siempre visible con fallback "Consultar" cuando `p.precio == null`

### 4. Patrón de card de producto (ya implementado en `catalogo/+page.svelte`)

```svelte
<article class="product-card" onclick={() => abrirDetalle(p)}>
  <div class="card-img-wrap">
    {#if p.imagen}
      <img src={p.imagen} alt={p.nombre} loading="lazy" />
    {:else}
      <div class="card-img-placeholder">🛋️</div>
    {/if}
    <div class="card-badges">
      {#if p.nuevo}<span class="badge badge-nuevo">Novedad</span>{/if}
      {#if p.descuento > 0}<span class="badge badge-oferta">-{p.descuento}%</span>{/if}
    </div>
  </div>
  <div class="card-body">
    <div class="card-name">{p.nombre}</div>
    <div class="card-price">{pesos(precioFinal(p))}</div>
  </div>
</article>
```

### 5. Responsive y accesibilidad (WCAG AA)

**Touch targets**: botones mínimo 44x44px en móvil.

**ARIA básico**:
- `aria-label` en botones de solo ícono
- `role="dialog" aria-modal="true"` en modales (ver `catalogo/+page.svelte` modal de detalle)
- Cerrar modales con `Escape` vía `<svelte:window onkeydown={onKeydown} />`

**Reduced motion**:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## ANTI-PATRONES A EVITAR

- Colores hardcodeados en lugar de variables CSS
- Sintaxis de Svelte 4 (`export let prop`, `$: derivado = ...`) en componentes nuevos — usar runes
- Insertar HTML crudo de usuario con `{@html ...}` sin sanitizar (riesgo XSS) — Svelte ya escapa `{expresion}` normal, así que evitar `{@html}` salvo necesidad real
- Volver a suscribirse con `onSnapshot` dentro de una página cuando el dato ya está en un store poblado por `+layout.svelte`
- Grid sin paginación (ya implementado con `POR_PAG = 24` en catálogo, `POR_PAG_ADMIN = 20` en admin) — no removerla
- Botones sin estado de carga en operaciones async
- Imágenes sin `loading="lazy"`
- Animaciones > 400ms (se sienten lentas)

---

## Instrucciones al implementar UI

1. **Leer primero** el componente `.svelte` relevante y la sección de `app.css` que lo estiliza. Usar Grep para encontrar clases/selectores antes de escribir CSS nuevo.
2. **Runes, no stores locales**: estado de componente con `$state`, derivados con `$derived`/`$derived.by`, efectos con `$effect`, props con `let { x } = $props()`.
3. **Stores globales** (`svelte/store`, con `$` prefijo) solo para estado compartido entre rutas (productos, filtros, auth, config, toasts) — ya existen en `stores.js`, no crear duplicados.
4. **CSS global**: todo va a `app.css`, agrupado por sección con comentario `/* === NOMBRE === */`. No introducir `<style>` scoped salvo que el componente lo amerite explícitamente.
5. **Firebase imports**: usar los ya expuestos en `$lib/firebase.js` (`db`, `auth`, `subirImagenCloudinary`). No reinicializar la app.
6. **Eventos Svelte 5**: `onclick={fn}`, `oninput={fn}`, no `on:click`.
7. **Empty states**: diseñar estado vacío con ícono SVG, mensaje descriptivo (ver `.empty-state` en catálogo).
8. **Consistencia**: revisar cómo se hace en secciones similares (`catalogo/+page.svelte` para público, `admin/+page.svelte` para admin) antes de agregar un componente nuevo.

---

## Técnicas CSS avanzadas ya usadas en el proyecto

- **CSS Grid** para `.product-grid` (con `.list-view` como variante de layout)
- **`position: sticky`** para header
- **`backdrop-filter: blur()`** para `.modal-overlay`
- **`@keyframes`** para toasts y transiciones de entrada
- **CSS Custom Properties** para variantes (`--text-3`, etc. en el panel admin)

$ARGUMENTS
