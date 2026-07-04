<script>
  import {
    usuario, authCargando, productos, categorias, proveedores,
    configLanding, configNosotros, configContacto, catalogoGeneradoEn, toast,
  } from '$lib/stores.js';
  import { auth, db }               from '$lib/firebase.js';
  import { signOut }                from 'firebase/auth';
  import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
  import { goto }                   from '$app/navigation';
  import { page }                   from '$app/stores';

  let { children } = $props();

  const esLogin = $derived($page.url.pathname === '/admin/login');

  // Redirigir al login si no está autenticado
  $effect(() => {
    if (!$authCargando && !$usuario && !esLogin) {
      goto('/admin/login');
    }
  });

  // Firestore en tiempo real — solo corre acá (panel de admin autenticado).
  // La vista pública nunca toca Firestore, lee un JSON estático (ver
  // catalogo.json / +layout.svelte raíz).
  let errorFirestoreMostrado = false;
  function manejarErrorFirestore(err) {
    console.error('Error de Firestore:', err);
    if (errorFirestoreMostrado) return;
    errorFirestoreMostrado = true;
    toast('No pudimos cargar los datos del panel. Probá de nuevo en unos minutos.', 'err');
  }

  // Fecha (ISO) de la entrada más reciente del historial — se compara
  // contra catalogoGeneradoEn para saber si hay cambios sin publicar.
  let ultimoCambioEn = $state(null);

  $effect(() => {
    if (!$usuario) return; // no autenticado todavía: no suscribirse a nada

    const q1 = query(collection(db, 'productos'),   orderBy('nombre'));
    const q2 = query(collection(db, 'categorias'),  orderBy('nombre'));
    const q3 = query(collection(db, 'proveedores'), orderBy('nombre'));
    const q7 = query(collection(db, 'historial'),   orderBy('fecha', 'desc'), limit(1));
    const u1 = onSnapshot(q1, snap => {
      productos.set(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, manejarErrorFirestore);
    const u2 = onSnapshot(q2, snap => {
      categorias.set(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, manejarErrorFirestore);
    const u3 = onSnapshot(q3, snap => {
      proveedores.set(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, manejarErrorFirestore);
    const u4 = onSnapshot(doc(db, 'config', 'landing'), snap => {
      if (snap.exists()) configLanding.update(prev => ({ ...prev, ...snap.data() }));
    }, manejarErrorFirestore);
    const u5 = onSnapshot(doc(db, 'config', 'nosotros'), snap => {
      if (snap.exists()) configNosotros.update(prev => ({ ...prev, ...snap.data() }));
    }, manejarErrorFirestore);
    const u6 = onSnapshot(doc(db, 'config', 'contacto'), snap => {
      if (snap.exists()) configContacto.update(prev => ({ ...prev, ...snap.data() }));
    }, manejarErrorFirestore);
    const u7 = onSnapshot(q7, snap => {
      ultimoCambioEn = snap.docs[0]?.data()?.fecha ?? null;
    }, manejarErrorFirestore);

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  });

  // Hay cambios sin publicar si algo se registró en el historial después
  // de que se generó el catalogo.json que está sirviendo la vista pública.
  const hayPendientes = $derived(
    !!($catalogoGeneradoEn && ultimoCambioEn && ultimoCambioEn > $catalogoGeneradoEn)
  );

  // Publicar cambios: regenera catalogo.json y redeployea el sitio.
  // Pasa por una Netlify Function que valida el ID token server-side —
  // la URL real del build hook nunca llega al bundle público.
  let publicando = $state(false);

  async function refrescarCatalogoGeneradoEn() {
    try {
      const res = await fetch('/catalogo.json?t=' + Date.now());
      if (!res.ok) return;
      const json = await res.json();
      if (json.generadoEn) catalogoGeneradoEn.set(json.generadoEn);
    } catch { /* no crítico, se reintentará en el próximo reload */ }
  }

  async function publicarCambios() {
    if (publicando || !hayPendientes) return;
    publicando = true;
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/publicar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast('Publicando cambios — el sitio se actualiza en 1-2 minutos.');
      // Netlify tarda un rato en buildear y deployar — reconsultamos
      // catalogo.json más tarde para confirmar que ya se publicó.
      setTimeout(async () => {
        await refrescarCatalogoGeneradoEn();
        publicando = false;
      }, 90000);
    } catch (err) {
      toast('Error al publicar: ' + err.message, 'err');
      publicando = false;
    }
  }
</script>

{#if $authCargando}
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a">
    <div style="color:#555;font-size:.85rem;letter-spacing:.1em;text-transform:uppercase">Cargando...</div>
  </div>

{:else if !$usuario && !esLogin}
  <!-- Vacío mientras redirige -->
  <div style="min-height:100vh;background:#0a0a0a"></div>

{:else if esLogin}
  {@render children()}

{:else}
  <div class="admin-wrap">
    <header class="admin-header">
      <div class="admin-header-brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--naranja)" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <div>
          <div class="admin-header-brand-name">Muebles Rafaela</div>
          <div class="admin-header-brand-sub">Panel de administración</div>
        </div>
      </div>

      <div class="admin-header-actions">
        <div class="admin-user-pill">
          <div class="admin-user-avatar">{($usuario?.email?.[0] ?? 'A').toUpperCase()}</div>
          <span class="admin-user-email">{$usuario?.email}</span>
        </div>
        <div class="publicar-wrap">
          {#if hayPendientes && !publicando}
            <span class="publicar-pendiente-texto">
              <span class="publicar-pendiente-dot"></span>
              Tenés cambios sin publicar
            </span>
          {/if}
          <button
            class="btn btn-primary btn-sm"
            onclick={publicarCambios}
            disabled={publicando || !hayPendientes}
            title={hayPendientes ? '' : 'No hay cambios nuevos para publicar'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            {publicando ? 'Publicando...' : 'Publicar cambios'}
            {#if hayPendientes && !publicando}<span class="publicar-dot"></span>{/if}
          </button>
        </div>
        <a href="/" class="btn btn-ghost btn-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Ver tienda
        </a>
        <button class="btn btn-ghost btn-sm" onclick={() => signOut(auth)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Salir
        </button>
      </div>
    </header>

    {@render children()}
  </div>
{/if}
