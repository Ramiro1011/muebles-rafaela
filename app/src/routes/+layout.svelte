<script>
  import '../app.css';
  import { onMount }    from 'svelte';
  import { page }       from '$app/stores';
  import { goto }       from '$app/navigation';
  import { db, auth }   from '$lib/firebase.js';
  import { onAuthStateChanged } from 'firebase/auth';
  import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
  import { doc, onSnapshot as onSnap } from 'firebase/firestore';
  import {
    productos, categorias, usuario, authCargando,
    textoBusqueda, toasts, configLanding, configNosotros, configContacto
  } from '$lib/stores.js';

  let { children } = $props();
  let busqueda = $state('');

  // Escuchar auth state
  onMount(() => {
    const unsub = onAuthStateChanged(auth, u => {
      usuario.set(u);
      authCargando.set(false);
    });
    return unsub;
  });

  // Escuchar Firestore en tiempo real
  onMount(() => {
    const q1 = query(collection(db, 'productos'),  orderBy('nombre'));
    const q2 = query(collection(db, 'categorias'), orderBy('nombre'));
    const u1 = onSnapshot(q1, snap => {
      productos.set(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(q2, snap => {
      categorias.set(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u3 = onSnap(doc(db, 'config', 'landing'), snap => {
      if (snap.exists()) configLanding.update(prev => ({ ...prev, ...snap.data() }));
    });
    const u4 = onSnap(doc(db, 'config', 'nosotros'), snap => {
      if (snap.exists()) configNosotros.update(prev => ({ ...prev, ...snap.data() }));
    });
    const u5 = onSnap(doc(db, 'config', 'contacto'), snap => {
      if (snap.exists()) configContacto.update(prev => ({ ...prev, ...snap.data() }));
    });
    return () => { u1(); u2(); u3(); u4(); u5(); };
  });

  function handleSearch(e) {
    e.preventDefault();
    textoBusqueda.set(busqueda);
    if ($page.url.pathname !== '/catalogo') goto('/catalogo');
  }

  const isAdminRoute = $derived($page.url.pathname.startsWith('/admin'));
</script>

{#if !isAdminRoute}
  <header class="header">
    <a href="/" class="header-logo">
      <img src="/logo.png" alt="Muebles Rafaela" class="header-logo-img" />
    </a>

    <nav>
      <ul class="header-nav">
        <li><a href="/" class:active={$page.url.pathname === '/'}>Inicio</a></li>
        <li><a href="/catalogo" class:active={$page.url.pathname === '/catalogo'}>Catálogo</a></li>
        <li><a href="/nosotros">Nosotros</a></li>
        <li>
          <a href="https://wa.me/{$configContacto.wsp_num}" target="_blank" rel="noopener">Contacto</a>
        </li>
      </ul>
    </nav>

    <div class="header-right">
      <form class="header-search" onsubmit={handleSearch}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Buscar producto..."
          bind:value={busqueda}
          oninput={() => textoBusqueda.set(busqueda)}
        />
      </form>

      <a href="https://wa.me/{$configContacto.wsp_num}" target="_blank" rel="noopener" class="btn-contactar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
        <span class="btn-contactar-label">Contactar</span>
      </a>
      <a href="/admin" class="btn-admin-header">Admin</a>
    </div>
  </header>
{/if}

<main class="page-main">{@render children()}</main>

{#if !isAdminRoute}
  <footer class="footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-logo-text">Muebles Rafaela</div>
        <p class="footer-tagline">
          Diseño y calidad para cada espacio de tu hogar.
          Encontrá el mueble perfecto en nuestro catálogo.
        </p>
        <a href="https://wa.me/{$configContacto.wsp_num}" target="_blank" rel="noopener" class="footer-wsp">
          WhatsApp
        </a>
      </div>

      <div class="footer-col">
        <h4>Catálogo</h4>
        <ul>
          <li><a href="/catalogo">Todos los productos</a></li>
          <li><a href="/catalogo?destacados=1">Destacados</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Nosotros</h4>
        <ul>
          <li><a href="/nosotros">Quiénes somos</a></li>
          <li><a href="https://wa.me/{$configContacto.wsp_num}" target="_blank" rel="noopener">Contacto</a></li>
        </ul>
      </div>

    </div>

    <div class="footer-bottom">
      <span>© {new Date().getFullYear()} Muebles Rafaela. Todos los derechos reservados.</span>
    </div>
  </footer>
{/if}

<!-- Toasts globales -->
<div class="toast-container">
  {#each $toasts as t (t.id)}
    <div class="toast {t.tipo}">
      {#if t.tipo === 'ok'}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      {:else}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      {/if}
      {t.msg}
    </div>
  {/each}
</div>
