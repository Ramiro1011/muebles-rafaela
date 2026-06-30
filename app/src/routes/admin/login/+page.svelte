<script>
  import { auth }                        from '$lib/firebase.js';
  import { signInWithEmailAndPassword }  from 'firebase/auth';
  import { usuario }                     from '$lib/stores.js';
  import { goto }                        from '$app/navigation';
  import { onMount }                     from 'svelte';

  let email    = $state('');
  let password = $state('');
  let error    = $state('');
  let loading  = $state(false);

  onMount(() => {
    const unsub = usuario.subscribe(u => {
      if (u) goto('/admin');
    });
    return unsub;
  });

  async function login(e) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      goto('/admin');
    } catch (err) {
      error = 'Credenciales incorrectas. Intentá de nuevo.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-wrap">
  <div class="login-card">
    <div class="login-logo-wrap">
      <img src="/logo.png" alt="Muebles Rafaela" class="login-logo" />
    </div>

    <h1 class="login-title">Panel de administración</h1>
    <p class="login-subtitle">Ingresá tus credenciales para continuar</p>

    <form onsubmit={login} style="display:flex;flex-direction:column;gap:.85rem">
      <div class="form-field">
        <label class="form-label" for="email">Email</label>
        <input
          id="email"
          type="email"
          class="login-input"
          bind:value={email}
          placeholder="admin@ejemplo.com"
          required
          autocomplete="email"
        />
      </div>

      <div class="form-field">
        <label class="form-label" for="pass">Contraseña</label>
        <input
          id="pass"
          type="password"
          class="login-input"
          bind:value={password}
          placeholder="••••••••"
          required
          autocomplete="current-password"
        />
      </div>

      {#if error}
        <div class="login-error">{error}</div>
      {/if}

      <button type="submit" class="login-btn" disabled={loading}>
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>

    <div style="margin-top:1.75rem;text-align:center">
      <a href="/" class="login-back">← Volver al catálogo</a>
    </div>
  </div>
</div>
