# Implementar Feature — Muebles Rafaela (Firebase SPA)

Implementa una funcionalidad de punta a punta en la SPA de archivo único.

## Arquitectura del sistema
```
Firestore collection
        ↓
  onSnapshot listener (escucharDatos)
        ↓
  Estado JS (productos[], categorias[])
        ↓
  Función render (renderGrid, renderFiltros, etc.)
        ↓
  HTML dinámico (innerHTML con template literals)
        ↓
  Event listeners (delegación en contenedor o onclick inline)
```

---

## Proceso de implementación (SEGUIR EN ORDEN)

### Paso 1: Entender y planificar
Antes de escribir código:
1. Usar Grep para encontrar las funciones y secciones CSS relevantes
2. Identificar si la feature necesita: nueva colección Firestore, nuevos campos en documentos existentes, nueva sección HTML, nuevo CSS, nueva función JS
3. Confirmar con el usuario si hay ambigüedad

### Paso 2: Estructura de datos Firestore (si aplica)

Colecciones actuales:
- `productos` — documentos con campos: `nombre`, `descripcion`, `precio`, `categoria`, `imagen` (URL), `destacado`
- `categorias` — documentos con campos: `nombre`

Para agregar una nueva colección:
```javascript
// Siempre usar addDoc con collection() — Firestore genera el ID
await addDoc(collection(db, 'nueva_coleccion'), {
  campo: valor,
  creado: new Date().toISOString()
});
```

Para agregar un campo nuevo a documentos existentes:
- No hay migración — Firestore es schema-less
- Manejar la ausencia del campo con `p.campo || valorDefault`
- Documentar qué campos opcionales pueden ser undefined

### Paso 3: HTML (sección nueva o modal)

Agregar la sección en `muebles_rafaela.html`. Estructura de modal:
```html
<!-- Modal nueva feature -->
<div id="m-nueva" style="display:none; ...">
  <div class="modal-content">
    <button class="modal-close" onclick="closeOverlay()">✕</button>
    <h2>Título</h2>
    <!-- contenido -->
  </div>
</div>
```

Para secciones en el catálogo público, agregar dentro de `<main>` después del grid.

### Paso 4: CSS

Agregar al final del bloque `<style>` existente:
```css
/* === NOMBRE DE FEATURE === */
.nueva-clase {
  /* propiedades */
}
/* Sin dark mode por ahora — el proyecto no lo usa actualmente */
```

Reglas obligatorias:
- Usar variables CSS existentes (`var(--naranja)`, `var(--azul)`, etc.)
- Respetar `var(--radius)` para bordes redondeados
- Animaciones con `transition: all .2s ease` o específicas (no `.3s` para hover simple)
- Media query para móvil si el componente necesita adaptación: `@media(max-width:768px)`

### Paso 5: Funciones JS

Agregar dentro del `<script type="module">`. Patrones obligatorios:

**Función render (genera HTML):**
```javascript
function renderNuevaSeccion() {
  const contenedor = document.getElementById('id-contenedor');
  if (!datos.length) {
    contenedor.innerHTML = `<div class="empty"><div class="ico">📦</div><p>No hay datos aún</p></div>`;
    return;
  }
  contenedor.innerHTML = datos.map(item => `
    <div class="nueva-card" data-id="${item.id}">
      <span>${item.nombre}</span>
      <!-- más contenido -->
    </div>
  `).join('');
  lucide.createIcons(); // Siempre después de innerHTML con íconos Lucide
}
```

**Operación async (CRUD en Firestore):**
```javascript
async function guardarNuevo(datos) {
  const btn = document.getElementById('btn-guardar-nuevo');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    await addDoc(collection(db, 'nueva_coleccion'), datos);
    toast('Guardado correctamente');
    closeOverlay();
  } catch(e) {
    toast('Error al guardar: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}
```

**Escuchar nueva colección en Firestore (si aplica):**
```javascript
// Agregar dentro de escucharDatos() o como función separada
let unsubNuevo = null;
function escucharNuevos() {
  if (unsubNuevo) unsubNuevo(); // desuscribir antes de re-suscribir
  unsubNuevo = onSnapshot(
    query(collection(db, 'nueva_coleccion'), orderBy('nombre')),
    snap => {
      nuevos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderNuevaSeccion();
    },
    err => toast('Error al cargar: ' + err.message, 'err')
  );
}
```

### Paso 6: Event listeners

Agregar en la zona de event listeners al final del script (después de la sección existente):
```javascript
// Botón que abre la nueva sección
document.getElementById('btn-nueva').addEventListener('click', () => {
  showOverlay('m-nueva');
  // cargar datos si es necesario
});

// Delegación de eventos para listas dinámicas
document.getElementById('id-contenedor').addEventListener('click', e => {
  const card = e.target.closest('.nueva-card');
  if (!card) return;
  const id = card.dataset.id;
  // manejar click
});
```

### Paso 7: Verificación

- [ ] ¿La función render maneja el caso de lista vacía (empty state)?
- [ ] ¿Las operaciones async deshabilitan el botón y muestran feedback?
- [ ] ¿Se llama `lucide.createIcons()` después de cada `innerHTML` con íconos?
- [ ] ¿Los event listeners usan `data-id` y delegación (no listeners por elemento)?
- [ ] ¿Los campos opcionales de Firestore tienen fallback (`p.campo || ''`)?
- [ ] ¿Los inputs del usuario se sanitizan antes de insertar en innerHTML? (usar `textContent` o escapar)
- [ ] ¿El modal/sección cierra correctamente con `closeOverlay()` o `Escape`?
- [ ] ¿Los unsubscribe se llaman al cerrar para evitar memory leaks?

---

## Patrones comunes

### Nuevo campo en producto existente
```
1. Agregar el campo al formulario de admin (fn, fc, etc. → nuevo input)
2. Incluir en el objeto `data` de guardarProducto()
3. Mostrar en renderGrid() con fallback: `p.nuevoCampo || ''`
4. Mostrar en openDet() en el modal de detalle
```

### Nueva sección pública (sin auth)
```
1. Agregar HTML después del grid o como sección separada
2. Función render que lee de productos[] o categorias[] (ya en memoria)
3. Sin necesidad de nueva consulta Firestore — los datos ya están suscritos
```

### Nueva funcionalidad solo admin
```
1. Agregar pestaña o botón en renderAdminPanel()
2. Verificar isAdmin antes de renderizar
3. Operaciones CRUD con try/catch y toast
```

$ARGUMENTS
