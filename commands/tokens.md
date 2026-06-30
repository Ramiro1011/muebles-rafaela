# Optimización de Tokens — Muebles Rafaela

Eres un experto en optimizar el uso eficiente del contexto de IA. Tu objetivo es reducir el consumo innecesario de tokens sin sacrificar calidad.

## Estrategias de optimización para este proyecto

### 1. Lectura quirúrgica del archivo único

El archivo `muebles_rafaela.html` es grande (~1100+ líneas). Leer secciones específicas con `offset` y `limit`:

```
MAL:  Leer todo muebles_rafaela.html (1100+ líneas)
BIEN: Grep para encontrar la línea exacta → Read con offset/limit de ±20 líneas
```

Grep útiles para encontrar secciones:
```bash
# Encontrar función específica
grep -n "function renderGrid" muebles_rafaela.html

# Encontrar clase CSS
grep -n "\.card-nombre" muebles_rafaela.html

# Encontrar sección de Firebase
grep -n "onSnapshot\|addDoc\|deleteDoc" muebles_rafaela.html

# Encontrar event listeners
grep -n "addEventListener" muebles_rafaela.html
```

### 2. Estructura del archivo (referencia rápida)

Para no tener que explorar el archivo desde cero, la estructura aproximada:

```
Líneas 1-15:     <head> — meta, title
Líneas 16-695:   <style> — todo el CSS
  ~16-100:         Variables, reset, header
  ~100-200:        Hero, toolbar, filtros
  ~200-300:        Cards, skeleton, empty state
  ~300-400:        Footer, overlay, modals
  ~400-500:        Modal detalle, panel admin
  ~500-600:        Formularios, pestañas, toast
  ~600-695:        Responsive
Líneas 696-XXX:  <body> — HTML
  ~696-750:        Header, hero, toolbar
  ~750-850:        Catálogo, grid, footer
  ~850-950:        Overlay, modal detalle, modal admin
  ~950-XXX:        Script JS (Firebase + lógica)
```

**Nota**: los offsets exactos cambian con cada modificación. Usar Grep primero.

### 3. Contexto mínimo necesario por tipo de tarea

**Para modificar una función JS existente:**
- Grep el nombre de la función → leer ±30 líneas
- Leer las variables de estado globales (≈15 líneas al inicio del script)
- Leer la función que llama a la modificada (si es callback)

**Para agregar CSS:**
- Grep la clase que quiero extender → leer ±20 líneas
- No es necesario leer todo el CSS

**Para agregar HTML:**
- Grep el elemento padre donde va el nuevo HTML → leer ±30 líneas
- Identificar el patrón existente → replicarlo

**Para modificar Firestore/Firebase:**
- Grep "const db" o "collection" → leer ±20 líneas
- Grep la función de escucha relevante (escucharDatos, etc.)

### 4. Variables de estado globales (referencia, no leer el archivo)

```javascript
// Estado que influye en todas las funciones render:
let productos = [];    // Array de objetos {id, nombre, descripcion, precio, categoria, imagen}
let categorias = [];   // Array de objetos {id, nombre}
let filtro = 'todos';  // String: 'todos' o nombre de categoría
let busqueda = '';     // String: texto del input de búsqueda
let isAdmin = false;   // Boolean: usuario autenticado como admin
let unsubProds = null; // Función unsubscribe de onSnapshot productos
let unsubCats = null;  // Función unsubscribe de onSnapshot categorías
```

### 5. Funciones clave (referencia, no leer el archivo)

```
escucharDatos()      → suscribe Firestore → actualiza productos[] y categorias[]
renderGrid()         → filtra productos[] y genera HTML del grid
renderFiltros()      → genera botones de categorías desde categorias[]
renderAdminPanel()   → genera HTML del panel admin con 3 pestañas
renderAList()        → lista de productos en admin (pestaña 1)
renderCats()         → lista de categorías en admin (pestaña 2)
fillCatSel()         → llena el <select> de categoría en el form de agregar producto
showOverlay(which)   → muestra overlay: 'mlogin' | 'madmin' | 'mdet'
closeOverlay()       → oculta overlay
toast(msg, tipo)     → toast: tipo 'ok' | 'err'
wsp(nombre)          → link WhatsApp
openDet(id)          → modal detalle de producto
editProd(id)         → carga producto en formulario de edición
delProd(id)          → elimina producto de Firestore
editCat(id)          → edición inline de categoría
delCat(id)           → elimina categoría de Firestore
pesos(n)             → formatea precio a string '$ 12.500'
```

### 6. Firestore — colecciones y campos (referencia)

```
colección 'productos':
  {id: auto, nombre: str, descripcion: str, precio: number|null, categoria: str, imagen: url|null, destacado: bool|null}

colección 'categorias':
  {id: auto, nombre: str}
```

### 7. Reutilizar contexto de la sesión

- No re-leer el archivo si ya se leyó en la conversación
- No re-analizar la estructura si ya se describió
- Referenciar hallazgos previos en lugar de re-derivarlos

### 8. Preguntas de diagnóstico antes de actuar

Antes de explorar el código, preguntar al usuario:
- ¿En qué función o sección visual está el problema?
- ¿Qué comportamiento espera vs qué ve?
- ¿Hay un error en la consola del browser?

### 9. Métricas de eficiencia

| Tipo de tarea | Lecturas máximas | Ediciones máximas |
|---|---|---|
| Bug fix de CSS | 2 Greps + 1 Read parcial | 1 Edit |
| Bug fix de JS | 2 Greps + 2 Reads parciales | 1 Edit |
| Nueva feature pequeña | 5 Greps + 3 Reads parciales | 1-2 Edits |
| Feature mediana | 8 Greps + 5 Reads parciales | 2-4 Edits |

Si se exceden estos límites, replantear el enfoque.

### 10. Patterns de Grep eficientes para este proyecto

```bash
# Buscar función render específica
grep -n "function render" muebles_rafaela.html

# Ver todos los event listeners
grep -n "\.addEventListener\|onclick=" muebles_rafaela.html

# Ver sección de Firebase (imports y config)
grep -n "import\|firebaseConfig\|const db\|const auth" muebles_rafaela.html

# Ver todos los IDs de elementos HTML
grep -n 'id="' muebles_rafaela.html

# Ver todas las variables de estado globales
grep -n "^let \|^const \|^var " muebles_rafaela.html

# Ver todos los modales/overlays
grep -n "showOverlay\|closeOverlay\|mlogin\|madmin\|mdet" muebles_rafaela.html
```

$ARGUMENTS
