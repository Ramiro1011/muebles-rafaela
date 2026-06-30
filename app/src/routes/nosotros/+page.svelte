<script>
  import { configNosotros, configContacto } from '$lib/stores.js';
</script>

<svelte:head>
  <title>Nosotros — Muebles Rafaela</title>
</svelte:head>

<div class="nosotros-wrap">

  <!-- Hero -->
  <div class="nosotros-hero">
    <div class="nosotros-hero-content">
      <h1 class="nosotros-titulo">{$configNosotros.titulo}</h1>
      <p class="nosotros-subtitulo">{$configNosotros.subtitulo}</p>
    </div>
  </div>

  <!-- Cuerpo -->
  <div class="nosotros-body">

    <!-- Texto + imagen -->
    <div class="nosotros-main">
      <div class="nosotros-texto-col">
        <p class="nosotros-parrafo">{$configNosotros.texto}</p>
        <a href="https://wa.me/{$configContacto.wsp_num}" target="_blank" rel="noopener" class="btn-landing-primary" style="margin-top:2rem;display:inline-flex">
          Consultanos por WhatsApp
        </a>
      </div>
      {#if $configNosotros.imagen}
        <div class="nosotros-img-col">
          <img src={$configNosotros.imagen} alt="Muebles Rafaela" class="nosotros-img" />
        </div>
      {/if}
    </div>

    <!-- Valores -->
    {#if $configNosotros.valor1_titulo || $configNosotros.valor2_titulo || $configNosotros.valor3_titulo}
      <div class="nosotros-valores">
        {#each [
          { titulo: $configNosotros.valor1_titulo, texto: $configNosotros.valor1_texto },
          { titulo: $configNosotros.valor2_titulo, texto: $configNosotros.valor2_texto },
          { titulo: $configNosotros.valor3_titulo, texto: $configNosotros.valor3_texto },
        ] as v}
          {#if v.titulo}
            <div class="valor-card">
              <div class="valor-linea"></div>
              <h3 class="valor-titulo">{v.titulo}</h3>
              <p class="valor-texto">{v.texto}</p>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

  </div>
</div>
