# Security Review — Muebles Rafaela

Eres un experto en seguridad de aplicaciones web con Firebase. Realiza una auditoría de seguridad del catálogo online de mueblería.

## Contexto del sistema
- **SvelteKit 5** con `adapter-static` (SPA compilada a HTML/JS/CSS estáticos) — sin servidor propio, sin rutas de API server-side (`+page.server.js`)
- Firebase Auth (email/password) — un único admin
- Firebase Firestore v12 — colecciones: `productos`, `categorias`, docs `config/landing`, `config/nosotros`, `config/contacto`
- Cloudinary — upload **unsigned** de imágenes (preset `muebles-rafaela`, cloud `dc74ogekb`)
- Hosting: Netlify (HTTPS automático)
- Toda la lógica corre en el cliente — igual que antes de la migración a SvelteKit, esto NO cambia el modelo de amenazas

## Modelo de amenazas

| Actor | Capacidades |
|-------|------------|
| Visitante público | Ver catálogo, filtrar, consultar por WhatsApp |
| Admin autenticado | CRUD de productos, categorías y configuración de páginas |
| Atacante externo | Puede ver el bundle JS compilado, puede llamar a la API de Firebase y Cloudinary directamente |
| **Riesgo principal** | Las reglas de Firestore y el preset de Cloudinary son la ÚNICA barrera entre el atacante y los datos |

---

## FASE 0: Data Flow Tracing

**Flujo 1 — Lectura de catálogo:**
```
Browser → onSnapshot en +layout.svelte → Firestore (reglas: ¿solo lectura pública?) →
store Svelte (productos, categorias) → derived productosFiltrados →
markup ({expresion} escapa por defecto, ¿hay {@html} sin sanitizar?) → DOM visible
```

**Flujo 2 — Autenticación admin:**
```
admin/login/+page.svelte → signInWithEmailAndPassword() → Firebase Auth token →
onAuthStateChanged() en +layout.svelte → store `usuario` →
admin/+layout.svelte usa $effect para redirigir si !$usuario →
CRUD operations → Firestore (reglas: ¿solo con auth?)
```

**Flujo 3 — Escritura desde admin:**
```
Form en admin/+page.svelte → addDoc/updateDoc/deleteDoc/setDoc →
Firestore (reglas verifican auth?) → onSnapshot en +layout.svelte actualiza store → UI pública se actualiza en vivo
```

**Flujo 4 — Upload de imagen a Cloudinary:**
```
Input file en admin → subirImagenCloudinary() (XHR directo a Cloudinary, sin pasar por backend propio) →
upload_preset UNSIGNED → Cloudinary acepta el archivo → URL pública devuelta →
esa URL se guarda en el documento de Firestore (imagen / imagenes[])
```
Un preset unsigned significa que **cualquiera con la cloud name y el preset name (ambos visibles en el bundle JS) puede subir archivos a esa cuenta de Cloudinary**, esté o no autenticado como admin.

**Flujo 5 — Firebase config en código fuente:**
```
Bundle JS público → firebaseConfig visible (apiKey, projectId, etc.) →
atacante usa la config → llama Firestore REST API o el SDK directamente → ¿qué puede hacer sin auth?
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
    match /productos/{prodId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /categorias/{catId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /config/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Verificar en Firebase Console → Firestore → Rules (no está versionado en el repo, así que no se puede auditar solo leyendo código — hay que pedirle al usuario que confirme el estado actual en la consola).

### 2. Cloudinary — preset unsigned sin restricciones

El preset unsigned (`muebles-rafaela`) permite subir archivos desde cualquier origen, sin necesidad de estar autenticado como admin en la app.

Mitigaciones a verificar en el dashboard de Cloudinary (no en el código):
- **Restricciones de tipo de archivo** en el preset (solo `image/*`)
- **Límite de tamaño** de archivo
- **Restricción de dominio/referrer** si Cloudinary lo soporta para el preset
- **Moderación** o revisión manual si el volumen de abuso lo justifica

El código cliente (`subirImagenCloudinary` en `$lib/firebase.js`) ya valida `file.type.startsWith('image/')` antes de subir, pero eso es solo una guía de UX — un atacante puede saltarse el frontend y pegarle directo a la API de Cloudinary con el preset expuesto.

### 3. XSS — `{@html}` o datos sin escapar

Svelte escapa automáticamente `{expresion}` en el markup. El riesgo real está en:
- Cualquier uso de `{@html ...}` con datos de Firestore (nombre, descripción de producto) sin sanitizar
- `innerHTML` manual dentro de un `<script>` si en algún punto se manipula el DOM directamente

```bash
# Buscar usos de @html en todos los componentes
grep -rn "{@html" app/src/
```

Si no hay ningún `{@html}` con datos de usuario, el riesgo de XSS almacenado vía Firestore es bajo por defecto — pero **un admin comprometido o malicioso podría igual inyectar contenido** que se muestra en la página pública, así que vale la pena revisar cada `{@html}` que aparezca.

### 4. Firebase API key expuesta en el bundle

La API key de Firebase EN EL CLIENTE ES INTENCIONAL — no es un secreto. Pero hay que protegerla con:
- **Firebase Security Rules** (ya cubierto arriba)
- **Dominios autorizados** en Firebase Console → Authentication → Settings → Authorized domains
  - Solo agregar el dominio de Netlify y `localhost`. Nunca `*`.
- **Firebase App Check** (opcional, para prevenir abuso de la API)

### 5. Autenticación y sesión

- [ ] La protección real de rutas admin está en `admin/+layout.svelte` vía `$effect` que hace `goto('/admin/login')` si `!$usuario` — esto es **solo UX client-side**, no seguridad real. La seguridad real debe estar en Firestore Rules con `request.auth != null`.
- [ ] Un atacante puede ejecutar JS en la consola del browser y bypassear cualquier chequeo de `$usuario` en el cliente — si las reglas de Firestore no exigen auth, igual podría escribir datos.
- [ ] ¿`signOut()` limpia correctamente el store `usuario`? (ya lo hace vía `onAuthStateChanged`)
- [ ] Firebase Auth tiene rate limiting incorporado contra fuerza bruta en el login — no hay protección adicional propia y no hace falta.

### 6. WhatsApp — validación del número

```javascript
// El número viene de Firestore (config/contacto → wsp_num), NO está hardcodeado
// Esto es una decisión de diseño consciente (el cliente lo edita desde el admin)
```

Como el número de WhatsApp se lee de Firestore y se edita desde el admin, un atacante que comprometa las credenciales de admin (o que explote reglas de Firestore laxas) podría redirigir todas las consultas a otro número. La mitigación es la misma que para el resto: reglas de escritura restringidas a `request.auth != null`.

### 7. Validación de datos en admin

Los formularios de admin (`admin/+page.svelte`) validan poco más allá de "nombre no vacío". Un atacante autenticado (o con reglas laxas) podría:
- Subir precios negativos
- Crear nombres de producto extremadamente largos
- Agregar URLs de imagen arbitrarias si en el futuro se permite pegar URL a mano (actualmente las imágenes se suben vía Cloudinary, lo cual mitiga esto)

```javascript
// Reforzar antes de guardar en guardarProd()
const nombre = formNombre.trim();
if (!nombre || nombre.length > 200) { toast('Nombre inválido', 'err'); return; }
const precio = formPrecio !== '' ? Number(formPrecio) : null;
if (precio !== null && (isNaN(precio) || precio < 0)) { toast('Precio inválido', 'err'); return; }
```

### 8. Content Security Policy (Netlify)

Agregar headers en `netlify.toml` (raíz del repo):
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://api.cloudinary.com; img-src 'self' https: data:; style-src 'self' 'unsafe-inline';"
```
Ajustar `script-src`/`style-src` según lo que SvelteKit genere en el build (puede necesitar hashes o `'unsafe-inline'` para estilos inyectados).

### 9. Imágenes — Cloudinary vs URLs arbitrarias

A diferencia del sistema anterior (URLs externas pegadas a mano), ahora las imágenes pasan por Cloudinary, lo cual ya mitiga el riesgo de URLs de rastreo o contenido arbitrario en el campo `imagen`. Verificar que no haya quedado ningún input de texto libre para pegar URL de imagen sin pasar por `subirImagenCloudinary()`.

---

## Checklist de auditoría

- [ ] Firestore Rules revisadas en la consola: lectura pública OK, escritura solo con `request.auth != null` (incluye `config/*`)
- [ ] Dominios autorizados en Firebase Auth (no `*`)
- [ ] Preset unsigned de Cloudinary revisado: restricciones de tipo/tamaño de archivo configuradas en el dashboard
- [ ] Sin usos de `{@html}` con datos de Firestore sin sanitizar (`grep -rn "{@html" app/src/`)
- [ ] Validación server-side de auth en reglas Firestore (no solo el guard de `admin/+layout.svelte`, que es client-side)
- [ ] Logout limpia el store `usuario` y la ruta admin redirige correctamente
- [ ] Validación de datos antes de escribir en Firestore (nombre, precio)
- [ ] Headers de seguridad en `netlify.toml` (X-Frame-Options, CSP)

---

## Hallazgos — formato de reporte

Para cada hallazgo:
```
### [CRÍTICO/ALTO/MEDIO/BAJO] — Nombre del hallazgo

**Descripción**: Qué es y por qué es un problema
**Ubicación**: Archivo y línea en app/src/...
**Impacto**: Qué puede hacer un atacante
**Remediación**: Código concreto para solucionar
```

$ARGUMENTS
