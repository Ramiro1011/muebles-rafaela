<script>
  import { configLanding, configContacto } from '$lib/stores.js';

  function wspMsg() {
    const msg = encodeURIComponent('Hola! Me gustaría recibir más información sobre sus muebles.');
    return `https://wa.me/${$configContacto.wsp_num}?text=${msg}`;
  }
</script>

<!-- ── HERO ─────────────────────────────────────────────────────────── -->
<section class="landing-hero" style={$configLanding.hero_imagen ? `background-image: url('${$configLanding.hero_imagen}')` : ''}>
  <div class="landing-hero-overlay"></div>
  <div class="landing-hero-content">
    {#if $configLanding.hero_badge}
      <div class="landing-badge">{$configLanding.hero_badge}</div>
    {/if}
    <h1 class="landing-hero-title">{$configLanding.hero_titulo}</h1>
    <p class="landing-hero-sub">{$configLanding.hero_subtitulo}</p>
    <div class="landing-hero-actions">
      <a href="/catalogo" class="btn-landing-primary">{$configLanding.hero_btn1}</a>
      <a href={wspMsg()} target="_blank" rel="noopener" class="btn-landing-ghost">{$configLanding.hero_btn2}</a>
    </div>
  </div>
</section>

<!-- ── COLECCIONES ────────────────────────────────────────────────────── -->
<section class="landing-collections">
  <div class="landing-section-header">
    <h2 class="landing-section-title">{$configLanding.col_seccion_titulo}</h2>
    <p class="landing-section-sub">{$configLanding.col_seccion_sub}</p>
  </div>
  <div class="collections-grid">
    {#each [
      { nombre: $configLanding.col1_nombre, badge: $configLanding.col1_badge, imagen: $configLanding.col1_imagen, link: $configLanding.col1_link },
      { nombre: $configLanding.col2_nombre, badge: $configLanding.col2_badge, imagen: $configLanding.col2_imagen, link: $configLanding.col2_link },
      { nombre: $configLanding.col3_nombre, badge: $configLanding.col3_badge, imagen: $configLanding.col3_imagen, link: $configLanding.col3_link },
    ] as col}
      <a class="col-card" href="/catalogo?cat={encodeURIComponent(col.link)}"
         style={col.imagen ? `background-image: url('${col.imagen}')` : ''}>
        <div class="col-card-overlay"></div>
        <div class="col-card-body">
          {#if col.badge}<div class="col-badge">{col.badge}</div>{/if}
          <div class="col-nombre">{col.nombre}</div>
        </div>
      </a>
    {/each}

    <!-- Panel promo (4to elemento del grid) -->
    <div class="col-promo-panel">
      {#if $configLanding.promo_badge}<div class="promo-badge-text">{$configLanding.promo_badge}</div>{/if}
      <h3 class="promo-titulo">{$configLanding.promo_titulo}</h3>
      <p class="promo-texto">{$configLanding.promo_texto}</p>
      <a href="/catalogo" class="btn-promo-ver">{$configLanding.promo_btn} →</a>
    </div>
  </div>
</section>

<!-- ── SOBRE NOSOTROS ─────────────────────────────────────────────────── -->
<section class="landing-sobre">
  <div class="sobre-img-col">
    {#if $configLanding.sobre_imagen}
      <img src={$configLanding.sobre_imagen} alt="Sobre nosotros" class="sobre-img" />
    {:else}
      <div class="sobre-img-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    {/if}
  </div>
  <div class="sobre-text-col">
    {#if $configLanding.sobre_badge}<div class="landing-badge plain">{$configLanding.sobre_badge}</div>{/if}
    <h2 class="sobre-titulo">{$configLanding.sobre_titulo}</h2>
    <p class="sobre-texto">{$configLanding.sobre_texto}</p>
    <ul class="sobre-lista">
      {#if $configLanding.sobre_item1}<li>{$configLanding.sobre_item1}</li>{/if}
      {#if $configLanding.sobre_item2}<li>{$configLanding.sobre_item2}</li>{/if}
      {#if $configLanding.sobre_item3}<li>{$configLanding.sobre_item3}</li>{/if}
    </ul>
    <a href="/nosotros" class="btn-landing-primary" style="margin-top: 2rem; display: inline-flex;">{$configLanding.sobre_btn}</a>
  </div>
</section>

<!-- ── CTA BANNER ──────────────────────────────────────────────────────── -->
<section class="landing-cta">
  <div class="cta-content">
    <h2 class="cta-titulo">{$configLanding.cta_titulo}</h2>
    <p class="cta-texto">{$configLanding.cta_texto}</p>
    <a href={wspMsg()} target="_blank" rel="noopener" class="btn-cta-wsp">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
      </svg>
      {$configLanding.cta_btn}
    </a>
  </div>
</section>
