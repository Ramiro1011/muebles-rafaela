<script>
  import '../app.css';
  import { onMount }    from 'svelte';
  import { page }       from '$app/stores';
  import { goto }       from '$app/navigation';
  import { auth }       from '$lib/firebase.js';
  import { onAuthStateChanged } from 'firebase/auth';
  import {
    productos, categorias, usuario, authCargando,
    textoBusqueda, toasts, toast, configLanding, configNosotros, configContacto
  } from '$lib/stores.js';

  let { children } = $props();
  let busqueda = $state('');
  let menuOpen = $state(false);

  const CATALOGO_CACHE_KEY = 'catalogo_cache_v1';

  function aplicarCatalogo(json) {
    productos.set(json.productos ?? []);
    categorias.set(json.categorias ?? []);
    if (json.config?.landing)  configLanding.update(prev => ({ ...prev, ...json.config.landing }));
    if (json.config?.nosotros) configNosotros.update(prev => ({ ...prev, ...json.config.nosotros }));
    if (json.config?.contacto) configContacto.update(prev => ({ ...prev, ...json.config.contacto }));
  }

  // Evita mostrar el mismo toast de error varias veces si el fetch falla
  let errorCatalogoMostrado = false;
  function manejarErrorCatalogo(err) {
    console.error('Error al cargar el catálogo:', err);
    if (errorCatalogoMostrado) return;
    errorCatalogoMostrado = true;
    toast('No pudimos cargar los datos del catálogo. Probá de nuevo en unos minutos.', 'err');
  }

  // Escuchar auth state (Firebase Auth, no consume cuota de Firestore — se
  // necesita en /catalogo para diferenciar qué ve un admin logueado)
  onMount(() => {
    const unsub = onAuthStateChanged(auth, u => {
      usuario.set(u);
      authCargando.set(false);
    }, err => {
      console.error('Error de Firebase Auth:', err);
      usuario.set(null);
      authCargando.set(false); // no dejar el spinner de "Cargando..." colgado para siempre
      toast('No pudimos verificar tu sesión. Probá recargar la página.', 'err');
    });
    return unsub;
  });

  // Catálogo público: se sirve estático desde Netlify (CDN), cero lecturas
  // de Firestore para el visitante. Firestore en vivo solo corre dentro del
  // panel de admin (ver admin/+layout.svelte), una vez autenticado.
  onMount(() => {
    // Hidratar rápido con lo último cacheado en esta pestaña, y siempre
    // refrescar en segundo plano por si se publicó algo nuevo mientras
    // la pestaña estaba abierta (stale-while-revalidate).
    try {
      const cacheado = sessionStorage.getItem(CATALOGO_CACHE_KEY);
      if (cacheado) aplicarCatalogo(JSON.parse(cacheado));
    } catch { /* sessionStorage no disponible o dato corrupto — seguimos con el fetch */ }

    fetch('/catalogo.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        aplicarCatalogo(json);
        try { sessionStorage.setItem(CATALOGO_CACHE_KEY, JSON.stringify(json)); } catch { /* no crítico */ }
      })
      .catch(manejarErrorCatalogo);
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
      <button class="hamburger" onclick={() => menuOpen = !menuOpen} aria-label="Menú">
        {#if menuOpen}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
        {/if}
      </button>
    </div>
  </header>

  {#if menuOpen}
    <div class="mobile-menu-overlay" onclick={() => menuOpen = false}></div>
    <nav class="mobile-menu">
      <a href="/" onclick={() => menuOpen = false} class:active={$page.url.pathname === '/'}>Inicio</a>
      <a href="/catalogo" onclick={() => menuOpen = false} class:active={$page.url.pathname === '/catalogo'}>Catálogo</a>
      <a href="/nosotros" onclick={() => menuOpen = false}>Nosotros</a>
      <a href="https://wa.me/{$configContacto.wsp_num}" target="_blank" rel="noopener" onclick={() => menuOpen = false}>Contacto</a>
      <a href="/admin" onclick={() => menuOpen = false} class="mobile-menu-admin">Admin</a>
    </nav>
  {/if}
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

      {#if $configContacto.locales?.length > 0}
        <div class="footer-col">
          <h4>Nuestros locales</h4>
          <ul class="footer-locales">
            {#each $configContacto.locales as local}
              <li>
                {#if local.nombre}<strong>{local.nombre}</strong>{/if}
                {#if local.direccion}<span>{local.direccion}</span>{/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}

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
