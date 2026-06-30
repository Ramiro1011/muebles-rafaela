# Muebles Rafaela — Catálogo Online

## Descripción
Catálogo online de mueblería con panel de administración. SPA de archivo único desplegada en Netlify, con base de datos Firebase Firestore.

## Stack técnico
- **Frontend**: HTML5 + CSS3 + ES6+ puro (sin frameworks) — todo en `muebles_rafaela.html`
- **Base de datos**: Firebase Firestore v10.12.2 (collections: `productos`, `categorias`)
- **Autenticación**: Firebase Auth (email/password, un único admin)
- **Hosting**: Netlify (deploy del archivo HTML directamente)
- **Sin build tool**: se sirve el archivo HTML directamente

## Estructura del proyecto
```
muebles_rafaela/
├── muebles_rafaela.html   # Aplicación completa (CSS + HTML + JS en un archivo)
├── CLAUDE.md              # Este archivo
└── commands/              # Skills de Claude Code adaptados al proyecto
    ├── frontend.md        # Guía UI/UX para este stack
    ├── feature.md         # Cómo implementar features Firebase SPA
    ├── planificar.md      # Protocolo de planificación
    ├── refactor.md        # Guía de calidad de código
    ├── seguridad.md       # Auditoría de seguridad Firebase
    ├── tokens.md          # Optimización de contexto (offsets del archivo)
    └── backend.md         # Firebase/Firestore patterns
```

## Colores y diseño
```css
--azul: #0d1b35       /* Header, footer */
--azul-medio: #1a2a4a /* Hero, fondo de imágenes */
--naranja: #f5a623    /* CTA principal */
--gris-bg: #f2f4f8    /* Fondo de página */
--gris-txt: #7a8899   /* Texto secundario */
--radius: 10px
```

## Estado JS (variables globales)
```javascript
let productos = []    // Array de objetos de Firestore
let categorias = []   // Array de objetos de Firestore
let filtro = 'todos'  // Categoría activa
let busqueda = ''     // Texto de búsqueda
let isAdmin = false   // Usuario autenticado como admin
```

## Funciones principales
- `escucharDatos()` — suscribe a Firestore con onSnapshot
- `renderGrid()` — renderiza el grid de productos filtrado
- `renderFiltros()` — renderiza botones de categoría
- `renderAdminPanel()` — renderiza panel admin (3 pestañas)
- `showOverlay(which)` — muestra modal: 'mlogin' | 'madmin' | 'mdet'
- `toast(msg, tipo)` — notificación: tipo 'ok' | 'err'

## Escala objetivo
- ~1500 productos
- ~30 categorías
- Paginación o lazy loading necesario a esa escala

## Contexto de negocio
- Los visitantes ven el catálogo y consultan por WhatsApp
- El cliente (dueño) administra productos y categorías desde el panel admin
- Sin carrito ni e-commerce — solo catálogo + contacto

## Comandos útiles de búsqueda en el archivo
```bash
grep -n "function render" muebles_rafaela.html
grep -n "onSnapshot\|addDoc" muebles_rafaela.html
grep -n 'id="' muebles_rafaela.html
```
