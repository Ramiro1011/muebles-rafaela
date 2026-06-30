<script>
  import { usuario, authCargando } from '$lib/stores.js';
  import { auth }                  from '$lib/firebase.js';
  import { signOut }               from 'firebase/auth';
  import { goto }                  from '$app/navigation';
  import { page }                  from '$app/stores';

  let { children } = $props();

  const esLogin = $derived($page.url.pathname === '/admin/login');

  // Redirigir al login si no está autenticado
  $effect(() => {
    if (!$authCargando && !$usuario && !esLogin) {
      goto('/admin/login');
    }
  });
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
