# Optimización de Tokens — Muebles Rafaela

Eres un experto en optimizar el uso eficiente del contexto de IA. Tu objetivo es reducir el consumo innecesario de tokens sin sacrificar calidad.

## Estrategias de optimización para este proyecto

### 1. Lectura quirúrgica de un proyecto multi-archivo

A diferencia de un archivo único, el proyecto ahora está repartido en varios componentes pequeños/medianos. La estrategia cambia: en vez de offsets dentro de un archivo gigante, se trata de **elegir el archivo correcto primero**.

```
MAL:  Leer app.css completo (2200+ líneas) para agregar una clase
BIEN: Grep la clase o selector relacionado → Read con offset/limit alrededor del match
```

```
MAL:  Leer admin/+page.svelte completo (1177 líneas) para un cambio en el tab de categorías
BIEN: Grep "tab === 'categorias'" o el nombre de función relevante → leer esa sección
```

### 2. Mapa de archivos (referencia rápida, no releer si ya se cargó en la sesión)

```
app/src/
├── app.css                          # ~2200 líneas — TODO el CSS global
├── lib/
│   ├── firebase.js                  # ~50 líneas — init + subirImagenCloudinary()
│   └── stores.js                    # ~150 líneas — todos los stores y derived
└── routes/
    ├── +layout.svelte               # ~170 líneas — header, footer, listeners onSnapshot, toasts
    ├── +page.svelte                 # Landing
    ├── catalogo/+page.svelte        # ~345 líneas — sidebar, filtros, grid, paginación, modal
    ├── nosotros/+page.svelte
    └── admin/
        ├── +layout.svelte           # ~70 líneas — auth guard
        ├── +page.svelte             # ~1180 líneas — 5 tabs, más grande del proyecto
        └── login/+page.svelte
```

### 3. Contexto mínimo necesario por tipo de tarea

**Para modificar un store o derived:**
- Leer `stores.js` completo si es la primera vez en la sesión (es corto, ~150 líneas) — después, no releer, referenciar lo ya visto

**Para modificar un componente de ruta:**
- Grep el nombre de la función/variable relevante dentro del archivo específico → leer ±40 líneas
- Si el cambio depende de un store, ya se conoce su forma sin releer `stores.js`

**Para agregar CSS:**
- Grep la clase que se quiere extender en `app.css` → leer ±20 líneas
- No es necesario leer todo `app.css`

**Para modificar Firestore/Firebase:**
- Grep "onSnapshot" o "addDoc" en `+layout.svelte` / `admin/+page.svelte` → leer esa sección puntual
- No releer `firebase.js` si ya se cargó (es corto y estable)

### 4. Stores y helpers clave (referencia, no releer el archivo si ya se vio en la sesión)

```javascript
productos, categorias                          // writable
usuario, authCargando                           // writable, auth
filtroCategoria, textoBusqueda, filtroMaterial,
precioMin, precioMax, soloDestacados, ordenamiento  // writable
productosFiltrados                              // derived — filtro + orden combinados
conteoCategoria                                 // derived — {nombreCategoria: cantidad}
configLanding, configNosotros, configContacto   // writable
toasts, toast(msg, tipo)                        // notificaciones
precioFinal(p)                                  // number|null — aplica descuento
```

### 5. Firestore — colecciones y campos (referencia)

```
'productos': {
  nombre, descripcion, precio, precioAnterior, descuento, stock,
  categoria (legacy string), categorias (array),
  material, imagen, imagenes[], nuevo, destacado, activo,
  colores: [{nombre, hex}]
}
'categorias': { nombre }
'config/landing', 'config/nosotros', 'config/contacto': documentos únicos con campos de texto/imagen de cada página
```

### 6. Reutilizar contexto de la sesión

- No re-leer un archivo si ya se leyó en la conversación
- No re-analizar la estructura de rutas si ya se describió
- Referenciar hallazgos previos en lugar de re-derivarlos
- Si se necesita un dato puntual de un archivo grande (`app.css`, `admin/+page.svelte`) y ya se hizo Grep antes, reutilizar ese resultado en vez de repetir la búsqueda

### 7. Preguntas de diagnóstico antes de actuar

Antes de explorar el código, preguntar al usuario:
- ¿En qué ruta o componente está el problema? (`/`, `/catalogo`, `/nosotros`, `/admin`)
- ¿Qué comportamiento espera vs qué ve?
- ¿Hay un error en la consola del browser o en la terminal de `npm run dev`?

### 8. Métricas de eficiencia

| Tipo de tarea | Lecturas máximas | Ediciones máximas |
|---|---|---|
| Bug fix de CSS | 2 Greps + 1 Read parcial en `app.css` | 1 Edit |
| Bug fix de JS/Svelte | 2 Greps + 1-2 Reads parciales en el `.svelte` afectado | 1 Edit |
| Nueva feature pequeña | 4 Greps + 2-3 Reads parciales | 1-2 Edits |
| Feature mediana (nueva ruta o store) | 6 Greps + 4 Reads parciales | 2-4 Edits |

Si se exceden estos límites, replantear el enfoque — probablemente falta entender el flujo antes de tocar código.

### 9. Patrones de Grep eficientes para este proyecto

```bash
# Buscar un store o export específico
grep -n "export const\|export function" app/src/lib/stores.js

# Ver todas las operaciones Firestore en un archivo
grep -n "addDoc\|updateDoc\|deleteDoc\|setDoc\|onSnapshot" app/src/routes/admin/+page.svelte

# Ver todo el estado reactivo de un componente
grep -n "\$state\|\$derived\|\$props\|\$effect" app/src/routes/catalogo/+page.svelte

# Ver una clase CSS específica
grep -n "\.card-name" app/src/app.css

# Ver todos los tabs del admin
grep -n "tab ===" app/src/routes/admin/+page.svelte

# Ver todas las rutas existentes
find app/src/routes -name "+page.svelte" -o -name "+layout.svelte"
```

$ARGUMENTS
