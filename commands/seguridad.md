# Security Review — Muebles Rafaela

Eres un experto en seguridad de aplicaciones web con Firebase. Realiza una auditoría de seguridad del catálogo online de mueblería.

## Contexto del sistema
- SPA vanilla HTML/CSS/JS — un solo archivo `muebles_rafaela.html`
- Firebase Auth (email/password) — un único admin
- Firebase Firestore — colecciones: `productos`, `categorias`
- Hosting: Netlify (HTTPS automático)
- Sin servidor backend propio — toda la lógica corre en el cliente

## Modelo de amenazas

| Actor | Capacidades |
|-------|------------|
| Visitante público | Ver catálogo, filtrar, consultar por WhatsApp |
| Admin autenticado | CRUD de productos y categorías |
| Atacante externo | Puede ver el código fuente JS, puede llamar a la API Firebase directamente |
| **Riesgo principal** | Las reglas de Firestore son la ÚNICA barrera entre el atacante y los datos |

---

## FASE 0: Data Flow Tracing

**Flujo 1 — Lectura de catálogo:**
```
Browser → Firebase SDK → Firestore (reglas: ¿solo lectura pública?) →
datos en memoria JS → innerHTML (¿sanitizado?) → DOM visible
```

**Flujo 2 — Autenticación admin:**
```
Form login → signInWithEmailAndPassword() → Firebase Auth token →
onAuthStateChanged() → isAdmin = true → botones admin visibles →
CRUD operations → Firestore (reglas: ¿solo con auth?)
```

**Flujo 3 — Escritura desde admin:**
```
Form de admin → datos JS → addDoc/updateDoc/deleteDoc →
Firestore (reglas verifican auth?) → onSnapshot actualiza UI pública
```

**Flujo 4 — API key Firebase en código fuente:**
```
Código fuente público → firebaseConfig visible → atacante usa config →
llama Firestore REST API directamente → ¿qué puede hacer sin auth?
```

Para cada flujo: identificar dónde falta validación, escapado o control de acceso.

---

## Áreas de auditoría

### 1. Firebase Security Rules (CRÍTICO — primera línea de defensa)

Las reglas de Firestore son lo más importante. Sin ellas, cualquiera puede leer/escribir todos los datos.

```javascript
// PELIGROSO: reglas por defecto que permiten todo
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // NUNCA en producción
    }
  }
}

// CORRECTO para este sistema
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Productos: lectura pública, escritura solo admin autenticado
    match /productos/{prodId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    // Categorías: lectura pública, escritura solo admin autenticado
    match /categorias/{catId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Verificar en Firebase Console → Firestore → Rules.

### 2. XSS — innerHTML con datos de Firestore

Cualquier dato de Firestore que se inserta en innerHTML puede ser XSS si no está sanitizado.
Un atacante con acceso de escritura a Firestore podría inyectar `<script>` en un nombre de producto.

```javascript
// PELIGROSO: datos de usuario directamente en innerHTML
grid.innerHTML = `<div class="card-nombre">${p.nombre}</div>`;

// SEGURO: sanitizar strings antes de insertar
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
grid.innerHTML = `<div class="card-nombre">${esc(p.nombre)}</div>`;

// ALTERNATIVA SEGURA: usar textContent para texto plano
const div = document.createElement('div');
div.className = 'card-nombre';
div.textContent = p.nombre;
```

Buscar con Grep todos los `innerHTML` que incluyen `p.` o `c.` (datos de Firestore):
```bash
grep -n "innerHTML.*\${p\." muebles_rafaela.html
grep -n "innerHTML.*\${c\." muebles_rafaela.html
```

### 3. Firebase API key expuesta en código fuente

La API key de Firebase EN EL CLIENTE ES INTENCIONAL — no es un secreto. Pero hay que protegerla con:
- **Firebase Security Rules** (ya cubierto arriba)
- **Dominios autorizados** en Firebase Console → Authentication → Settings → Authorized domains
  - Solo agregar el dominio de Netlify y localhost. Nunca `*`.
- **Firebase App Check** (opcional, para prevenir abuso)

### 4. Autenticación y sesión

- [ ] ¿El `isAdmin` se verifica SERVER-SIDE (en Firestore Rules) o solo CLIENT-SIDE?
  - **Client-side `isAdmin = true` NO es suficiente** — un atacante puede ejecutar `isAdmin = true` en la consola
  - La protección real debe ser en Firestore Rules con `request.auth != null`
- [ ] ¿El `signOut()` limpia correctamente el estado local? (`isAdmin = false`, ocultar botones admin)
- [ ] ¿Hay protección contra fuerza bruta en el login? Firebase Auth tiene rate limiting incorporado, pero verificar.

### 5. WhatsApp link — validación del número

```javascript
// Verificar que el número de WhatsApp no sea manipulable por usuario
function wsp(nombre) {
  const msg = encodeURIComponent('Hola! Consulto por: ' + nombre);
  // El número debe estar hardcodeado, no venir de Firestore
  return `https://wa.me/5493492XXXXXX?text=${msg}`;
}
```

Si el número viene de Firestore, un atacante podría redirigir consultas a otro número.

### 6. Validación de datos en admin

Los formularios de admin solo tienen validación client-side. Un atacante autenticado podría:
- Subir precios negativos
- Crear nombres de producto con scripts
- Agregar URLs de imagen con `javascript:` protocol

```javascript
// MAL: sin validación
const data = { nombre: document.getElementById('fn').value, precio: document.getElementById('fp').value };

// BIEN: validar antes de guardar
const nombre = document.getElementById('fn').value.trim();
if (!nombre || nombre.length > 200) { toast('Nombre inválido', 'err'); return; }
const precio = parseFloat(document.getElementById('fp').value);
if (isNaN(precio) || precio < 0) { toast('Precio inválido', 'err'); return; }
const imagen = document.getElementById('fi').value.trim();
if (imagen && !imagen.startsWith('https://')) { toast('URL de imagen debe ser HTTPS', 'err'); return; }
```

### 7. Content Security Policy (Netlify)

Agregar headers en `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self' https://www.gstatic.com https://firebasestorage.googleapis.com; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://unpkg.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; img-src 'self' https: data:; style-src 'self' 'unsafe-inline';"
```

### 8. Imágenes — URLs externas

Si se permiten URLs de imagen externas, un atacante podría usar URLs de rastreo o contenido inapropiado.
- Considerar Firebase Storage para subir imágenes (control total)
- O aceptar solo URLs de dominios específicos (whitelist)

---

## Checklist de auditoría

- [ ] Firestore Rules revisadas: lectura pública OK, escritura solo con `request.auth != null`
- [ ] Dominios autorizados en Firebase Auth (no `*`)
- [ ] Todos los `innerHTML` con datos de Firestore sanitizados con `esc()`
- [ ] Número de WhatsApp hardcodeado, no de Firestore
- [ ] Validación server-side de auth en reglas Firestore (no solo `isAdmin` client-side)
- [ ] Logout limpia `isAdmin` y oculta la UI de admin
- [ ] Validación de datos antes de escribir en Firestore (nombre, precio, URL imagen)
- [ ] Headers de seguridad en Netlify (X-Frame-Options, CSP)
- [ ] URLs de imagen validadas como HTTPS

---

## Hallazgos — formato de reporte

Para cada hallazgo:
```
### [CRÍTICO/ALTO/MEDIO/BAJO] — Nombre del hallazgo

**Descripción**: Qué es y por qué es un problema
**Ubicación**: Línea o sección en muebles_rafaela.html
**Impacto**: Qué puede hacer un atacante
**Remediación**: Código concreto para solucionar
```

$ARGUMENTS
