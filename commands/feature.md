# Implementar Feature — Muebles Rafaela (SvelteKit + Firebase)

Implementa una funcionalidad de punta a punta en la app SvelteKit 5.

## Arquitectura del sistema
```
Firestore collection
        ↓
  onSnapshot listener (en app/src/routes/+layout.svelte)
        ↓
  Store Svelte (productos, categorias, configLanding, ... en $lib/stores.js)
        ↓
  derived store si hace falta filtrar/transformar (ej: productosFiltrados)
        ↓
  Componente .svelte que lee el store con $store
        ↓
  Markup Svelte 5 (runes, {#each}, {#if}, eventos onclick={})
```

---

## Proceso de implementación (SEGUIR EN ORDEN)

### Paso 1: Entender y planificar
Antes de escribir código:
1. Usar Grep para encontrar el store, componente o función relevante en `app/src/`
2. Identificar si la feature necesita: nueva colección/campo en Firestore, nuevo store o derived, nueva ruta, nuevo componente, nuevo bloque CSS en `app.css`
3. Confirmar con el usuario si hay ambigüedad

### Paso 2: Estructura de datos Firestore (si aplica)

Colecciones actuales:
- `productos` — `{ nombre, descripcion, precio, precioAnterior, descuento, stock, categoria (legacy string), categorias (array), material, imagen, imagenes[], nuevo, destacado, activo, colores[{nombre,hex}] }`
- `categorias` — `{ nombre }`
- `config/landing`, `config/nosotros`, `config/contacto` — documentos únicos con campos de configuración de página, sincronizados a `configLanding`/`configNosotros`/`configContacto`

```javascript
// Crear documento — Firestore genera el ID
await addDoc(collection(db, 'productos'), { nombre: 'x', precio: 1000, categorias: ['Sillones'], categoria: 'Sillones' });

// Documento único con ID fijo (config)
await setDoc(doc(db, 'config', 'landing'), datosCompletos);
```

Firestore es schema-less — no hay migración. Manejar ausencia de campo con `p.campo ?? default` o `p.campo || default`.

### Paso 3: Store (si el estado se comparte entre rutas)

Agregar a `app/src/lib/stores.js`:
```javascript
export const nuevoEstado = writable(valorInicial);

export const nuevoDerived = derived(
  [productos, nuevoEstado],
  ([$productos, $nuevoEstado]) => {
    // transformar/filtrar
    return $productos.filter(p => /* condición usando $nuevoEstado */);
  }
);
```

Si el estado es local a un solo componente (ej. un formulario), usar `$state`/`$derived` dentro del componente en vez de un store global.

### Paso 4: Suscripción a Firestore (si es una colección/doc nuevo)

Agregar dentro de `onMount` en `app/src/routes/+layout.svelte` (no en páginas individuales, para evitar resuscribirse en cada navegación):

```javascript
onMount(() => {
  const u = onSnapshot(query(collection(db, 'nueva_coleccion'), orderBy('nombre')), snap => {
    nuevoStore.set(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
  return u; // SvelteKit llama esta función de cleanup al desmontar
});
```

### Paso 5: Componente / ruta

- Feature pública nueva → nueva carpeta en `app/src/routes/<nombre>/+page.svelte`
- Feature admin nueva → nuevo tab dentro de `app/src/routes/admin/+page.svelte` (`tab = 'nuevo'` en el `$state` de pestañas existente)
- Modal → seguir el patrón de `productoSel` en `catalogo/+page.svelte`: una variable `$state(null)`, `{#if seleccion}` renderiza el overlay, cerrar con función dedicada + `Escape`

```svelte
<script>
  let { children } = $props();
  let miEstado = $state(valorInicial);
  const derivado = $derived(/* cálculo a partir de miEstado u otros $state */);
</script>
```

### Paso 6: CSS

Agregar al final de la sección correspondiente en `app/src/app.css`:
```css
/* === NOMBRE DE FEATURE === */
.nueva-clase {
  /* propiedades, usando var(--naranja), var(--azul), var(--radius), etc. */
}
@media (max-width: 768px) {
  .nueva-clase { /* ajuste móvil */ }
}
```

### Paso 7: Operación async (CRUD en Firestore)

```javascript
let guardando = $state(false);

async function guardarNuevo(datos) {
  guardando = true;
  try {
    await addDoc(collection(db, 'nueva_coleccion'), datos);
    toast('Guardado correctamente');
  } catch (err) {
    toast('Error al guardar: ' + err.message, 'err');
  } finally {
    guardando = false;
  }
}
```

`toast` se importa de `$lib/stores.js`.

### Paso 8: Verificación

- [ ] ¿El derived/filtro maneja el caso de lista vacía (empty state)?
- [ ] ¿Las operaciones async deshabilitan el botón (`disabled={guardando}`) y muestran feedback con `toast()`?
- [ ] ¿Los eventos usan sintaxis Svelte 5 (`onclick={}`, no `on:click`)?
- [ ] ¿Los campos opcionales de Firestore tienen fallback (`p.campo ?? ''`)?
- [ ] ¿El modal/sección cierra correctamente y limpia estado (`productoSel = null`, URL, etc.)?
- [ ] ¿La suscripción `onSnapshot` nueva vive en `+layout.svelte`, no duplicada en una página?
- [ ] ¿Se usaron variables CSS existentes en vez de valores hardcodeados?

---

## Patrones comunes en este proyecto

### Nuevo campo en producto existente
```
1. Agregar el input/checkbox al formulario de admin (app/src/routes/admin/+page.svelte, sección "Form de producto")
2. Incluir en el objeto `data` de guardarProd()
3. Leer con fallback en el card y en el modal de detalle (catalogo/+page.svelte)
4. Si afecta filtros, incorporarlo a productosFiltrados en stores.js
```

### Nueva vista pública
```
1. Nueva carpeta app/src/routes/<ruta>/+page.svelte
2. Leer datos de los stores ya poblados (productos, categorias) — no crear una nueva query salvo que sea información distinta
3. Agregar el link en la navegación de +layout.svelte (header y mobile-menu)
```

### Nueva funcionalidad de filtrado/búsqueda
```
1. writable en stores.js para el nuevo criterio
2. Incorporarlo a la cadena de .filter() dentro de productosFiltrados (derived)
3. UI de control (select, input, checkbox) en catalogo/+page.svelte con bind:value o onchange al store
```

### Nuevo campo de configuración (landing/nosotros/contacto)
```
1. Agregar el campo al objeto inicial del store correspondiente (configLanding, etc.) en stores.js
2. Agregar el input al formulario del tab correspondiente en admin/+page.svelte
3. Se persiste con setDoc(doc(db, 'config', 'landing'), formCompleto) — reemplaza el doc entero, no usar updateDoc parcial salvo que sea intencional
```

$ARGUMENTS
