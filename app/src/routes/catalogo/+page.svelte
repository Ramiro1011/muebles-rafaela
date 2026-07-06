<script>
  import { page }     from '$app/stores';
  import { goto }     from '$app/navigation';
  import { onMount }  from 'svelte';
  import {
    categoriasTree, conteoCategoria, usuario,
    filtroCategorias, textoBusqueda, filtroMaterial,
    precioMin, precioMax, soloDestacados,
    ordenamiento, productosFiltrados, productos, precioFinal,
    configContacto
  } from '$lib/stores.js';
  const POR_PAG    = 24;
  const VISTOS_KEY = 'mr_vistos';

  let paginaActual = $state(1);
  let vistaLista   = $state(false);
  let sidebarOpen  = $state(false);
  let productoSel  = $state(null);
  let pMinLocal    = $state('');
  let pMaxLocal    = $state('');
  let catsOpen     = $state(true);
  // Solo puede haber 1 categoría padre activa a la vez (su id = la que está
  // desplegada) y, dentro de ella, a lo sumo 1 subcategoría hija.
  let raizAbierta  = $state(null);
  let padreSel     = $state(null);
  let hijaSel      = $state(null);
  let imagenActiva = $state(0);
  let vistosIds    = $state([]);

  function aplicarFiltro() {
    const nombres = [padreSel, hijaSel].filter(Boolean);
    filtroCategorias.set(new Set(nombres));
    paginaActual = 1;
    syncUrl({ cat: nombres.length ? nombres.join(',') : null, pagina: null });
  }

  onMount(() => {
    const params = $page.url.searchParams;
    paginaActual = Number(params.get('pagina')) || 1;
    const catInicial = params.get('cat');
    if (catInicial) {
      const nombres = catInicial.split(',');
      filtroCategorias.set(new Set(nombres));
      const unsub = categoriasTree.subscribe(tree => {
        for (const n of nombres) {
          const raiz = tree.find(r => r.nombre === n);
          if (raiz) { padreSel = raiz.nombre; raizAbierta = raiz.id; continue; }
          const raizDeHija = tree.find(r => r.hijas.some(h => h.nombre === n));
          if (raizDeHija) { hijaSel = n; padreSel = raizDeHija.nombre; raizAbierta = raizDeHija.id; }
        }
      });
      unsub();
    }
    try { vistosIds = JSON.parse(localStorage.getItem(VISTOS_KEY) || '[]'); } catch { vistosIds = []; }
    const pId = params.get('p');
    if (pId) {
      const unsub = productos.subscribe(ps => {
        const encontrado = ps.find(x => x.id === pId);
        if (encontrado) productoSel = encontrado;
      });
      return unsub;
    }
  });

  function syncUrl(extra = {}) {
    const params = new URLSearchParams($page.url.searchParams);
    Object.entries(extra).forEach(([k, v]) => {
      if (v === null || v === '' || v === undefined) params.delete(k);
      else params.set(k, String(v));
    });
    const qs = params.toString();
    goto(qs ? `?${qs}` : '/catalogo', { replaceState: true, noScroll: true, keepFocus: true });
  }

  const totalProd  = $derived($productosFiltrados.length);
  const totalPags  = $derived(Math.max(1, Math.ceil(totalProd / POR_PAG)));
  const paginados  = $derived($productosFiltrados.slice((paginaActual - 1) * POR_PAG, paginaActual * POR_PAG));
  const paginas    = $derived(Array.from({ length: Math.min(totalPags, 7) }, (_, i) => i + 1));
  const materiales = $derived([...new Set($productos.map(p => p.material).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
  const vistosProductos = $derived(vistosIds.map(id => $productos.find(p => p.id === id)).filter(Boolean).slice(0, 6));
  const tituloSeccion   = $derived($filtroCategorias.size === 0 ? 'Todos los productos' : [...$filtroCategorias].join(' + '));
  const subtituloSeccion = $derived(`${totalProd} ${totalProd === 1 ? 'producto' : 'productos'}`);
  const imagenesModal   = $derived(productoSel ? [productoSel.imagen, ...(productoSel.imagenes || [])].filter(Boolean) : []);
  const categoriasModal = $derived(
    productoSel ? (productoSel.categorias?.length ? productoSel.categorias : productoSel.categoria ? [productoSel.categoria] : []) : []
  );

  function seleccionarTodos() {
    padreSel = null; hijaSel = null; raizAbierta = null; sidebarOpen = false;
    aplicarFiltro();
  }
  // El nombre y la flechita de una categoría padre hacen lo mismo: es la
  // única forma de activarla, y al hacerlo se despliega mostrando sus
  // subcategorías (no puede haber más de un padre activo a la vez).
  function toggleRaiz(raiz) {
    if (raizAbierta === raiz.id) {
      raizAbierta = null; padreSel = null; hijaSel = null;
    } else {
      raizAbierta = raiz.id; padreSel = raiz.nombre; hijaSel = null;
    }
    aplicarFiltro();
  }
  function seleccionarHija(raiz, hija) {
    hijaSel = hijaSel === hija.nombre ? null : hija.nombre;
    padreSel = raiz.nombre; raizAbierta = raiz.id;
    aplicarFiltro();
  }
  function seleccionarMaterial(mat) { filtroMaterial.set($filtroMaterial === mat ? '' : mat); paginaActual = 1; }
  function aplicarPrecio() { precioMin.set(pMinLocal); precioMax.set(pMaxLocal); paginaActual = 1; }
  function limpiarFiltros() {
    padreSel = null; hijaSel = null; raizAbierta = null;
    filtroCategorias.set(new Set()); textoBusqueda.set(''); precioMin.set(''); precioMax.set('');
    soloDestacados.set(false); filtroMaterial.set(''); pMinLocal = ''; pMaxLocal = ''; paginaActual = 1;
    syncUrl({ cat: null, pagina: null });
  }
  function irPag(n) {
    paginaActual = Math.max(1, Math.min(n, totalPags));
    syncUrl({ pagina: paginaActual === 1 ? null : paginaActual });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function abrirDetalle(p) {
    productoSel = p; imagenActiva = 0;
    history.pushState(null, '', `?p=${p.id}`);
    vistosIds = [p.id, ...vistosIds.filter(id => id !== p.id)].slice(0, 8);
    try { localStorage.setItem(VISTOS_KEY, JSON.stringify(vistosIds)); } catch {}
  }
  function cerrarDetalle() { productoSel = null; history.pushState(null, '', '/catalogo'); }
  function consultarWsp(nombre) {
    const msg = encodeURIComponent(`Hola! Consulto por: *${nombre}*\n¿Está disponible?`);
    window.open(`https://wa.me/${$configContacto.wsp_num}?text=${msg}`, '_blank');
  }
  function pesos(n) { return n != null ? '$ ' + Number(n).toLocaleString('es-AR') : null; }
  function onKeydown(e) { if (e.key === 'Escape' && productoSel) cerrarDetalle(); }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="layout-catalog">
  <div class="sidebar-overlay" class:open={sidebarOpen} onclick={() => sidebarOpen = false}></div>

  <aside class="sidebar" class:open={sidebarOpen}>
    <div class="sidebar-section">
      <button class="sidebar-section-toggle" class:open={catsOpen} onclick={() => catsOpen = !catsOpen}>
        <span class="sidebar-label">Categorías</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {#if catsOpen}
        <ul class="cat-list">
          <li class="cat-item">
            <button class:active={padreSel === null} onclick={seleccionarTodos}><span>Todos</span></button>
          </li>
          {#each $categoriasTree as raiz (raiz.id)}
            <li class="cat-item">
              <div class="cat-item-row">
                <button class:active={padreSel === raiz.nombre} class:has-expand={raiz.hijas.length > 0} onclick={() => toggleRaiz(raiz)}>
                  <span>{raiz.nombre}</span><span class="cat-count">{$conteoCategoria[raiz.nombre] || 0}</span>
                </button>
                {#if raiz.hijas.length > 0}
                  <button class="cat-item-expand" class:open={raizAbierta === raiz.id} onclick={() => toggleRaiz(raiz)} aria-label="Mostrar subcategorías">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                {/if}
              </div>
              {#if raiz.hijas.length > 0 && raizAbierta === raiz.id}
                <ul class="cat-list cat-list--hijas">
                  {#each raiz.hijas as hija (hija.id)}
                    <li class="cat-item cat-item--child">
                      <button class:active={hijaSel === hija.nombre} onclick={() => seleccionarHija(raiz, hija)}>
                        <span>{hija.nombre}</span><span class="cat-count">{$conteoCategoria[hija.nombre] || 0}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if materiales.length > 0}
      <div class="sidebar-section">
        <p class="sidebar-label">Material</p>
        <div class="material-tags">
          {#each materiales as mat}
            <button class="material-tag" class:active={$filtroMaterial === mat} onclick={() => seleccionarMaterial(mat)}>{mat}</button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="sidebar-section">
      <p class="sidebar-label">Precio</p>
      <div class="price-range">
        <div class="price-inputs">
          <input class="price-input" type="number" placeholder="Mín" bind:value={pMinLocal} min="0" />
          <input class="price-input" type="number" placeholder="Máx" bind:value={pMaxLocal} min="0" />
        </div>
        <button class="btn-filter-apply" onclick={aplicarPrecio}>Aplicar</button>
      </div>
      <div class="filter-checks" style="margin-top:1rem">
        <label class="filter-check">
          <input type="checkbox" bind:checked={$soloDestacados} onchange={() => paginaActual = 1} />
          <span>Solo destacados</span>
        </label>
      </div>
      {#if $filtroCategorias.size > 0 || $textoBusqueda || $precioMin || $precioMax || $soloDestacados || $filtroMaterial}
        <button class="btn" style="margin-top:1rem;width:100%;justify-content:center;font-size:.7rem" onclick={limpiarFiltros}>Limpiar filtros</button>
      {/if}
    </div>

    <div class="sidebar-promo">
      <div class="promo-label">Consulta personalizada</div>
      <div class="promo-title">Proyectos</div>
      <p class="promo-desc">¿Necesitás asesoramiento para tu espacio? Hablá directamente con nosotros.</p>
      <a href="https://wa.me/{$configContacto.wsp_num}" target="_blank" rel="noopener" class="btn-promo-wsp">WhatsApp</a>
    </div>
  </aside>

  <main class="catalog-main">
    <div class="catalog-header">
      <div>
        <h1 class="catalog-title">{tituloSeccion}</h1>
        <p class="catalog-subtitle">{subtituloSeccion}</p>
      </div>
      <div class="catalog-controls">
        <button class="btn-mobile-filtros" onclick={() => sidebarOpen = true}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          Filtros
        </button>
        <div class="sort-wrap">
          <span class="sort-label">Ordenar por:</span>
          <select class="sort-select" bind:value={$ordenamiento} onchange={() => paginaActual = 1}>
            <option value="nombre-asc">Nombre A→Z</option>
            <option value="nombre-desc">Nombre Z→A</option>
            <option value="precio-asc">Precio ↑</option>
            <option value="precio-desc">Precio ↓</option>
          </select>
        </div>
        <div class="view-toggle">
          <button class="view-btn" class:active={!vistaLista} onclick={() => vistaLista = false} title="Vista grilla">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button class="view-btn" class:active={vistaLista} onclick={() => vistaLista = true} title="Vista lista">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="product-grid" class:list-view={vistaLista}>
      {#if paginados.length === 0}
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
          <p>No se encontraron productos</p>
        </div>
      {:else}
        {#each paginados as p (p.id)}
          <article class="product-card" onclick={() => abrirDetalle(p)}>
            <div class="card-img-wrap">
              {#if p.imagen}<img src={p.imagen} alt={p.nombre} loading="lazy" />{:else}<div class="card-img-placeholder">🛋️</div>{/if}
              <div class="card-badges">
                {#if p.nuevo}<span class="badge badge-nuevo">Novedad</span>{/if}
                {#if p.descuento > 0}<span class="badge badge-oferta">-{p.descuento}%</span>{/if}
                {#if !$usuario && p.stock === 0}<span class="badge badge-sin-stock">Sin stock</span>{/if}
                {#if !$usuario && p.stock != null && p.stock > 0 && p.stock <= 4}<span class="badge badge-stock">Últimas unidades</span>{/if}
              </div>
            </div>
            <div class="card-body">
              <div class="card-title-row">
                <div class="card-name">{p.nombre}</div>
                <div class="card-price-col">
                  {#if p.descuento > 0}
                    <div class="card-price-original">{pesos(p.precio)}</div>
                    <div class="card-price">{pesos(precioFinal(p))}</div>
                  {:else if p.precioAnterior}
                    <div class="card-price-original">{pesos(p.precioAnterior)}</div>
                    <div class="card-price">{pesos(p.precio)}</div>
                  {:else if p.precio != null}
                    <div class="card-price">{pesos(p.precio)}</div>
                  {:else}
                    <div class="card-price consultar">Consultar</div>
                  {/if}
                </div>
              </div>
              {#if p.descripcion}<div class="card-desc">{p.descripcion}</div>{/if}
              {#if p.colores?.length > 0}
                <div class="card-colores">
                  {#each p.colores as c}
                    <div class="color-dot" style="background:{c.hex}"></div>
                  {/each}
                </div>
              {/if}
              {#if $usuario && p.stock != null}
                <div style="margin-top:.4rem;font-size:.68rem;font-weight:600;color:{p.stock === 0 ? '#ef4444' : p.stock <= 4 ? '#f59e0b' : 'var(--text-3)'}">
                  Stock: {p.stock} {p.stock === 1 ? 'unidad' : 'unidades'}
                </div>
              {/if}
            </div>
          </article>
        {/each}
      {/if}
    </div>

    {#if totalPags > 1}
      <div class="pagination">
        <button class="page-btn" onclick={() => irPag(paginaActual - 1)} disabled={paginaActual === 1}>←</button>
        {#each paginas as n}
          <button class="page-btn" class:active={n === paginaActual} onclick={() => irPag(n)}>{n}</button>
        {/each}
        {#if totalPags > 7}<span style="color:var(--text-3);font-size:.8rem">... {totalPags}</span>{/if}
        <button class="page-btn" onclick={() => irPag(paginaActual + 1)} disabled={paginaActual === totalPags}>→</button>
      </div>
    {/if}

    {#if vistosProductos.length > 0}
      <div class="vistos-section">
        <p class="sidebar-label" style="margin-bottom:1rem">Vistos recientemente</p>
        <div class="vistos-grid">
          {#each vistosProductos as p (p.id)}
            <div class="vistos-card" onclick={() => abrirDetalle(p)}>
              <div class="vistos-img">
                {#if p.imagen}<img src={p.imagen} alt={p.nombre} loading="lazy" />{:else}<div class="card-img-placeholder" style="font-size:1.5rem">🛋️</div>{/if}
              </div>
              <div class="vistos-nombre">{p.nombre}</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </main>
</div>

{#if productoSel}
  <div class="modal-overlay" onclick={cerrarDetalle} role="dialog" aria-modal="true">
    <div class="modal-det" onclick={(e) => e.stopPropagation()}>
      <div class="modal-img-side">
        {#if imagenesModal.length > 0}
          <img src={imagenesModal[imagenActiva]} alt={productoSel.nombre} />
          {#if imagenesModal.length > 1}
            <div class="modal-thumbs">
              {#each imagenesModal as url, i}
                <button class="modal-thumb" class:active={i === imagenActiva} onclick={() => imagenActiva = i}>
                  <img src={url} alt="Vista {i + 1}" />
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="modal-img-placeholder">🛋️</div>
        {/if}
      </div>
      <div class="modal-info-side">
        {#if categoriasModal.length > 0}
          <div class="modal-cats">
            {#each categoriasModal as cat}<span class="modal-cat">{cat}</span>{/each}
          </div>
        {/if}
        <h2 class="modal-name">{productoSel.nombre}</h2>
        {#if productoSel.material}<p style="font-size:.72rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem">{productoSel.material}</p>{/if}
        {#if productoSel.descripcion}<p class="modal-desc">{productoSel.descripcion}</p>{/if}
        {#if productoSel.colores?.length > 0}
          <div style="margin-bottom:1rem">
            <p style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:.6rem">Colores</p>
            <div class="modal-colores">
              {#each productoSel.colores as c}
                <div class="modal-color-item">
                  <div class="color-dot color-dot-lg" style="background:{c.hex}"></div>
                  <span class="modal-color-nombre">{c.nombre}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        {#if productoSel.descuento > 0}
          <div style="font-size:.82rem;color:var(--text-3);text-decoration:line-through;margin-bottom:.25rem">{pesos(productoSel.precio)}</div>
          <div class="modal-price">{pesos(precioFinal(productoSel))}</div>
        {:else if productoSel.precio != null}
          <div class="modal-price">{pesos(productoSel.precio)}</div>
        {:else}
          <div class="modal-price consultar">Consultar precio</div>
        {/if}
        {#if !$usuario && productoSel.stock != null && productoSel.stock <= 4 && productoSel.stock > 0}
          <p style="font-size:.75rem;color:#f59e0b;font-weight:600;margin-bottom:.75rem">
            ⚠ Últimas unidades disponibles
          </p>
        {/if}
        <div class="modal-actions">
          <button class="btn-wsp-det" onclick={() => consultarWsp(productoSel.nombre)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
            Consultar por WhatsApp
          </button>
          <button class="btn-share" onclick={() => navigator.clipboard.writeText(location.href)} title="Copiar enlace">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
        </div>
      </div>
      <button class="modal-close" onclick={cerrarDetalle} aria-label="Cerrar">✕</button>
    </div>
  </div>
{/if}
