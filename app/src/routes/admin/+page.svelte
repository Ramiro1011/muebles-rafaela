<script>
  import { db, subirImagenCloudinary } from '$lib/firebase.js';
  import { productos, categorias, proveedores, toast, configLanding, configNosotros, configContacto } from '$lib/stores.js';
  import {
    collection, addDoc, updateDoc, deleteDoc, doc, setDoc, writeBatch,
    getDocs, query, orderBy, limit
  } from 'firebase/firestore';
  import { goto } from '$app/navigation';
  import { usuario } from '$lib/stores.js';
  import { onMount } from 'svelte';

  // Redirigir si no autenticado
  onMount(() => {
    const unsub = usuario.subscribe(u => { if (!u) goto('/admin/login'); });
    return unsub;
  });

  // ── Pestañas ────────────────────────────────────────────────
  let tab = $state('productos');  // 'productos' | 'categorias' | 'proveedores' | 'historial' | 'landing' | 'nosotros' | 'contacto'

  // ── Historial de cambios ────────────────────────────────────
  let historial         = $state([]);
  let cargandoHistorial = $state(false);
  let historialCargado  = $state(false);

  async function registrarHistorial(tipo, descripcion) {
    try {
      await addDoc(collection(db, 'historial'), {
        tipo,
        descripcion,
        usuario: $usuario?.email || 'admin',
        fecha: new Date().toISOString(),
      });
      historialCargado = false; // forzar recarga la próxima vez que se abra la pestaña
    } catch (err) {
      // No bloquear la operación principal si falla el registro del historial
      console.error('Error al registrar historial:', err);
    }
  }

  async function cargarHistorial() {
    if (historialCargado) return;
    cargandoHistorial = true;
    try {
      const snap = await getDocs(query(collection(db, 'historial'), orderBy('fecha', 'desc'), limit(200)));
      historial = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      historialCargado = true;
    } catch (err) {
      toast('Error al cargar historial: ' + err.message, 'err');
    } finally {
      cargandoHistorial = false;
    }
  }

  function tipoHistorialLabel(tipo) {
    if (tipo.startsWith('producto'))  return { label: 'Producto',      color: '#818cf8' };
    if (tipo.startsWith('categoria')) return { label: 'Categoría',     color: '#22c55e' };
    if (tipo.startsWith('proveedor')) return { label: 'Proveedor',     color: '#f59e0b' };
    if (tipo === 'aumento_masivo')    return { label: 'Precios',       color: 'var(--naranja)' };
    if (tipo.startsWith('config'))    return { label: 'Configuración', color: '#7a8899' };
    return { label: tipo, color: '#7a8899' };
  }

  // ── Búsqueda en admin ───────────────────────────────────────
  let busquedaAdmin = $state('');
  let catAdmin = $state('');
  const prodsFiltrados = $derived.by(() => {
    let ps = $productos;
    if (catAdmin) ps = ps.filter(p => {
      const cats = p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : [];
      return cats.includes(catAdmin);
    });
    const q = busquedaAdmin.trim().toLowerCase();
    if (q) {
      ps = ps.filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : []).join(' ').toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.material || '').toLowerCase().includes(q) ||
        (p.proveedor || '').toLowerCase().includes(q) ||
        String(p.precio ?? '').includes(q) ||
        String(p.stock ?? '').includes(q)
      );
    }
    return ps;
  });

  // ── Paginación admin ────────────────────────────────────────
  let pagAdmin = $state(1);
  const POR_PAG_ADMIN = 20;
  const totalPagsAdmin = $derived(Math.max(1, Math.ceil(prodsFiltrados.length / POR_PAG_ADMIN)));
  const prodsPaginados  = $derived(
    prodsFiltrados.slice((pagAdmin - 1) * POR_PAG_ADMIN, pagAdmin * POR_PAG_ADMIN)
  );

  // ── Form de producto ────────────────────────────────────────
  let editId         = $state('');   // vacío = nuevo producto
  let formNombre     = $state('');
  let formDesc       = $state('');
  let formPrecio     = $state('');
  let formPrecioAnt  = $state('');
  let formDescuento  = $state('');   // % descuento, ej: 20
  let formStock      = $state('');   // número de unidades
  let formCategorias = $state([]);
  let formMaterial   = $state('');
  let formProveedor  = $state('');
  let formImagenUrl  = $state('');
  let formGaleria    = $state([]);   // URLs de imágenes adicionales
  let formNuevo      = $state(false);
  let formDestacado  = $state(false);
  let formActivo     = $state(true);
  let formColores    = $state([]);
  let nuevoColorHex  = $state('#888888');
  let nuevoColorNombre = $state('');
  let guardando      = $state(false);
  let mostrarForm    = $state(false);

  // Upload de imagen
  let uploadProgress  = $state(0);
  let uploadActivo    = $state(false);
  let dragOver        = $state(false);
  let uploadGaleriaActivo = $state(false);

  function abrirFormNuevo() {
    editId = ''; formNombre = ''; formDesc = ''; formPrecio = '';
    formPrecioAnt = ''; formDescuento = ''; formStock = '';
    formCategorias = []; formMaterial = ''; formProveedor = ''; formImagenUrl = ''; formGaleria = [];
    formNuevo = false; formDestacado = false; formActivo = true;
    formColores = []; nuevoColorHex = '#888888'; nuevoColorNombre = '';
    mostrarForm = true;
    tab = 'productos';
  }

  function editarProd(p) {
    editId        = p.id;
    formNombre    = p.nombre || '';
    formDesc      = p.descripcion || '';
    formPrecio    = p.precio != null ? String(p.precio) : '';
    formPrecioAnt = p.precioAnterior != null ? String(p.precioAnterior) : '';
    formDescuento = p.descuento != null && p.descuento > 0 ? String(p.descuento) : '';
    formStock     = p.stock != null ? String(p.stock) : '';
    formCategorias = p.categorias?.length ? [...p.categorias] : p.categoria ? [p.categoria] : [];
    formMaterial  = p.material || '';
    formProveedor = p.proveedor || '';
    formImagenUrl = p.imagen || '';
    formGaleria   = p.imagenes ? [...p.imagenes] : [];
    formNuevo     = p.nuevo || false;
    formDestacado = p.destacado || false;
    formActivo    = p.activo !== false;
    formColores   = p.colores ? [...p.colores] : [];
    nuevoColorHex = '#888888'; nuevoColorNombre = '';
    mostrarForm   = true;
  }

  async function guardarProd(e) {
    e.preventDefault();
    if (!formNombre.trim()) { toast('El nombre es obligatorio', 'err'); return; }
    guardando = true;
    try {
      const data = {
        nombre:         formNombre.trim(),
        descripcion:    formDesc.trim() || null,
        precio:         formPrecio !== '' ? Number(formPrecio) : null,
        precioAnterior: formPrecioAnt !== '' ? Number(formPrecioAnt) : null,
        descuento:      formDescuento !== '' ? Number(formDescuento) : 0,
        stock:          formStock !== '' ? Number(formStock) : null,
        categorias:     formCategorias,
        categoria:      formCategorias[0] || null,
        material:       formMaterial.trim() || null,
        proveedor:      formProveedor || null,
        imagen:         formImagenUrl || null,
        imagenes:       formGaleria,
        nuevo:          formNuevo,
        destacado:      formDestacado,
        activo:         formActivo,
        colores:        formColores,
      };
      if (editId) {
        await updateDoc(doc(db, 'productos', editId), data);
        toast('Producto actualizado');
        await registrarHistorial('producto_editado', `Editó el producto "${data.nombre}"`);
      } else {
        await addDoc(collection(db, 'productos'), data);
        toast('Producto agregado');
        await registrarHistorial('producto_creado', `Creó el producto "${data.nombre}"`);
      }
      mostrarForm = false;
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    } finally {
      guardando = false;
    }
  }

  async function toggleActivo(p) {
    try {
      const nuevoActivo = p.activo === false;
      await updateDoc(doc(db, 'productos', p.id), { activo: nuevoActivo });
      toast(nuevoActivo ? 'Producto activado' : 'Producto desactivado');
      await registrarHistorial('producto_estado', `${nuevoActivo ? 'Activó' : 'Desactivó'} el producto "${p.nombre}"`);
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    }
  }

  async function eliminarProd(p) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    try {
      await deleteDoc(doc(db, 'productos', p.id));
      toast('Producto eliminado');
      await registrarHistorial('producto_eliminado', `Eliminó el producto "${p.nombre}"`);
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    }
  }

  // ── Upload de imagen a Cloudinary ─────────────────────────
  async function subirImagen(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('Seleccioná un archivo de imagen', 'err');
      return;
    }
    uploadActivo = true;
    uploadProgress = 0;
    try {
      formImagenUrl = await subirImagenCloudinary(file, p => { uploadProgress = p; });
      toast('Imagen cargada');
    } catch(err) {
      toast('Error al subir: ' + err.message, 'err');
    } finally {
      uploadActivo = false;
    }
  }

  function onFileChange(e) { subirImagen(e.target.files[0]); }
  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    subirImagen(e.dataTransfer.files[0]);
  }

  async function agregarImagenGaleria(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('Seleccioná un archivo de imagen', 'err');
      return;
    }
    uploadGaleriaActivo = true;
    try {
      const url = await subirImagenCloudinary(file, () => {});
      formGaleria = [...formGaleria, url];
    } catch(err) {
      toast('Error al subir: ' + err.message, 'err');
    } finally {
      uploadGaleriaActivo = false;
    }
  }

  function onGaleriaFileChange(e) {
    agregarImagenGaleria(e.target.files[0]);
    e.target.value = '';
  }

  function quitarImagenGaleria(i) {
    formGaleria = formGaleria.filter((_, idx) => idx !== i);
  }

  function agregarColor() {
    if (!nuevoColorNombre.trim()) { toast('Escribí un nombre para el color', 'err'); return; }
    if (formColores.some(c => c.hex === nuevoColorHex)) { toast('Ese color ya está agregado', 'err'); return; }
    formColores = [...formColores, { nombre: nuevoColorNombre.trim(), hex: nuevoColorHex }];
    nuevoColorNombre = '';
  }
  function quitarColor(i) {
    formColores = formColores.filter((_, idx) => idx !== i);
  }

  // ── Categorías ──────────────────────────────────────────────
  let nuevaCat     = $state('');
  let agregandoCat = $state(false);
  let editCatId    = $state('');
  let editCatNombre = $state('');

  async function agregarCategoria(e) {
    e.preventDefault();
    if (!nuevaCat.trim()) return;
    const existe = $categorias.some(c => c.nombre.toLowerCase() === nuevaCat.toLowerCase());
    if (existe) { toast('Ya existe esa categoría', 'err'); return; }
    agregandoCat = true;
    try {
      await addDoc(collection(db, 'categorias'), { nombre: nuevaCat.trim() });
      toast('Categoría agregada');
      await registrarHistorial('categoria_creada', `Creó la categoría "${nuevaCat.trim()}"`);
      nuevaCat = '';
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    } finally {
      agregandoCat = false;
    }
  }

  async function guardarCat(id) {
    if (!editCatNombre.trim()) return;
    const nombreViejo = $categorias.find(c => c.id === id)?.nombre;
    try {
      await updateDoc(doc(db, 'categorias', id), { nombre: editCatNombre.trim() });
      toast('Categoría actualizada');
      await registrarHistorial('categoria_editada', `Renombró la categoría "${nombreViejo}" a "${editCatNombre.trim()}"`);
      editCatId = '';
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    }
  }

  function getCats(p) {
    return p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : [];
  }

  async function eliminarCategoria(cat) {
    const n = $productos.filter(p => getCats(p).includes(cat.nombre)).length;
    if (n > 0 && !confirm(`Esta categoría tiene ${n} producto(s). ¿Eliminarla de todos modos?`)) return;
    try {
      await deleteDoc(doc(db, 'categorias', cat.id));
      toast('Categoría eliminada');
      await registrarHistorial('categoria_eliminada', `Eliminó la categoría "${cat.nombre}"`);
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    }
  }

  // ── Proveedores ─────────────────────────────────────────────
  let nuevoProv     = $state('');
  let agregandoProv = $state(false);
  let editProvId    = $state('');
  let editProvNombre = $state('');

  async function agregarProveedor(e) {
    e.preventDefault();
    if (!nuevoProv.trim()) return;
    const existe = $proveedores.some(p => p.nombre.toLowerCase() === nuevoProv.toLowerCase());
    if (existe) { toast('Ya existe ese proveedor', 'err'); return; }
    agregandoProv = true;
    try {
      await addDoc(collection(db, 'proveedores'), { nombre: nuevoProv.trim() });
      toast('Proveedor agregado');
      await registrarHistorial('proveedor_creado', `Creó el proveedor "${nuevoProv.trim()}"`);
      nuevoProv = '';
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    } finally {
      agregandoProv = false;
    }
  }

  async function guardarProveedor(id) {
    if (!editProvNombre.trim()) return;
    const nombreViejo = $proveedores.find(p => p.id === id)?.nombre;
    try {
      await updateDoc(doc(db, 'proveedores', id), { nombre: editProvNombre.trim() });
      toast('Proveedor actualizado');
      await registrarHistorial('proveedor_editado', `Renombró el proveedor "${nombreViejo}" a "${editProvNombre.trim()}"`);
      editProvId = '';
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    }
  }

  async function eliminarProveedor(prov) {
    const n = $productos.filter(p => p.proveedor === prov.nombre).length;
    if (n > 0 && !confirm(`Este proveedor tiene ${n} producto(s) asociado(s). ¿Eliminarlo de todos modos?`)) return;
    try {
      await deleteDoc(doc(db, 'proveedores', prov.id));
      toast('Proveedor eliminado');
      await registrarHistorial('proveedor_eliminado', `Eliminó el proveedor "${prov.nombre}"`);
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    }
  }

  // ── Aumento masivo de precios por proveedor ────────────────
  let aumentoProveedor  = $state('');
  let aumentoDireccion  = $state('subir');   // 'subir' | 'bajar'
  let aumentoPorcentaje = $state('');        // siempre positivo, la dirección define el signo
  let aplicandoAumento  = $state(false);

  const aumentoPctFirmado = $derived.by(() => {
    if (aumentoPorcentaje === '' || isNaN(Number(aumentoPorcentaje))) return null;
    const pct = Math.abs(Number(aumentoPorcentaje));
    return aumentoDireccion === 'bajar' ? -pct : pct;
  });

  const aumentoPreview = $derived.by(() => {
    if (!aumentoProveedor || aumentoPctFirmado === null) return null;
    const factor = 1 + aumentoPctFirmado / 100;
    const afectados = $productos.filter(p => p.proveedor === aumentoProveedor);
    if (afectados.length === 0) return { count: 0, ejemplo: null };
    const ej = afectados.find(p => p.precio != null) || afectados[0];
    return {
      count: afectados.length,
      ejemplo: ej.precio != null ? {
        nombre: ej.nombre,
        precioAntes: ej.precio,
        precioDespues: Math.round(ej.precio * factor),
        tachadoAntes: ej.precioAnterior ?? null,
        tachadoDespues: ej.precioAnterior != null ? Math.round(ej.precioAnterior * factor) : null,
      } : null,
    };
  });

  async function aplicarAumentoMasivo() {
    if (!aumentoPreview || aumentoPreview.count === 0 || aumentoPctFirmado === null) return;
    const pct = aumentoPctFirmado;
    const verbo = pct >= 0 ? 'aumentar' : 'bajar';
    if (!confirm(`¿Aplicar ${Math.abs(pct)}% (${verbo}) a ${aumentoPreview.count} producto(s) de "${aumentoProveedor}"? Esta acción no se puede deshacer.`)) return;
    aplicandoAumento = true;
    try {
      const factor = 1 + pct / 100;
      const afectados = $productos.filter(p => p.proveedor === aumentoProveedor);
      for (let i = 0; i < afectados.length; i += 450) {
        const batch = writeBatch(db);
        afectados.slice(i, i + 450).forEach(p => {
          const data = {};
          if (p.precio != null) data.precio = Math.round(p.precio * factor);
          if (p.precioAnterior != null) data.precioAnterior = Math.round(p.precioAnterior * factor);
          batch.update(doc(db, 'productos', p.id), data);
        });
        await batch.commit();
      }
      toast(`Precios actualizados para ${afectados.length} producto(s)`);
      await registrarHistorial('aumento_masivo', `${pct >= 0 ? 'Aumentó' : 'Bajó'} ${Math.abs(pct)}% el precio de ${afectados.length} producto(s) de "${aumentoProveedor}"`);
      aumentoProveedor = ''; aumentoPorcentaje = '';
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    } finally {
      aplicandoAumento = false;
    }
  }

  function pesos(n) {
    return n != null ? '$ ' + Number(n).toLocaleString('es-AR') : '—';
  }

  // ── Stats ────────────────────────────────────────────────────
  const statTotal      = $derived($productos.length);
  const statSinImagen  = $derived($productos.filter(p => !p.imagen).length);
  const statSinPrecio  = $derived($productos.filter(p => p.precio == null).length);
  const statStockBajo  = $derived($productos.filter(p => p.stock != null && p.stock >= 1 && p.stock <= 4).length);

  // ── Landing config ───────────────────────────────────────────
  let landingForm = $state({ ...$configLanding });
  let guardandoLanding = $state(false);
  let uploadLandingField = $state('');

  $effect(() => { landingForm = { ...$configLanding }; });

  async function guardarLanding(e) {
    e.preventDefault();
    guardandoLanding = true;
    try {
      await setDoc(doc(db, 'config', 'landing'), landingForm);
      toast('Página de inicio guardada');
      await registrarHistorial('config_landing', 'Actualizó la página de Inicio');
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    } finally {
      guardandoLanding = false;
    }
  }

  // ── Nosotros config ──────────────────────────────────────────
  let nosotrosForm = $state({ ...$configNosotros });
  let guardandoNosotros = $state(false);
  let uploadNosotrosField = $state('');

  $effect(() => { nosotrosForm = { ...$configNosotros }; });

  async function guardarNosotros(e) {
    e.preventDefault();
    guardandoNosotros = true;
    try {
      await setDoc(doc(db, 'config', 'nosotros'), nosotrosForm);
      toast('Página Nosotros guardada');
      await registrarHistorial('config_nosotros', 'Actualizó la página Quiénes somos');
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    } finally {
      guardandoNosotros = false;
    }
  }

  async function subirImagenNosotros(file) {
    if (!file || !file.type.startsWith('image/')) { toast('Imagen inválida', 'err'); return; }
    uploadNosotrosField = 'imagen';
    try {
      const url = await subirImagenCloudinary(file, () => {});
      nosotrosForm = { ...nosotrosForm, imagen: url };
    } catch(err) {
      toast('Error al subir: ' + err.message, 'err');
    } finally {
      uploadNosotrosField = '';
    }
  }

  // ── Contacto config ──────────────────────────────────────────
  let contactoForm = $state({ ...$configContacto });
  let guardandoContacto = $state(false);

  $effect(() => { contactoForm = { ...$configContacto }; });

  async function guardarContacto(e) {
    e.preventDefault();
    guardandoContacto = true;
    try {
      await setDoc(doc(db, 'config', 'contacto'), contactoForm);
      toast('Contacto guardado');
      await registrarHistorial('config_contacto', 'Actualizó los datos de Contacto');
    } catch(err) {
      toast('Error: ' + err.message, 'err');
    } finally {
      guardandoContacto = false;
    }
  }

  function agregarLocal() {
    contactoForm = { ...contactoForm, locales: [...(contactoForm.locales ?? []), { nombre: '', direccion: '' }] };
  }
  function quitarLocal(i) {
    contactoForm = { ...contactoForm, locales: (contactoForm.locales ?? []).filter((_, idx) => idx !== i) };
  }

  async function subirImagenLanding(file, campo) {
    if (!file || !file.type.startsWith('image/')) { toast('Imagen inválida', 'err'); return; }
    uploadLandingField = campo;
    try {
      const url = await subirImagenCloudinary(file, () => {});
      landingForm = { ...landingForm, [campo]: url };
    } catch(err) {
      toast('Error al subir: ' + err.message, 'err');
    } finally {
      uploadLandingField = '';
    }
  }
</script>

<div class="admin-layout">
  <!-- ── SIDEBAR ADMIN ────────────────────────────────────── -->
  <aside class="admin-sidebar">
    <div class="admin-nav-group-label">Gestión</div>
    <ul class="admin-nav">
      <li class="admin-nav-item">
        <button class:active={tab === 'productos'} onclick={() => { tab = 'productos'; mostrarForm = false; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
          </svg>
          Productos
          <span class="admin-nav-badge">{$productos.length}</span>
        </button>
      </li>
      <li class="admin-nav-item">
        <button class:active={tab === 'categorias'} onclick={() => { tab = 'categorias'; mostrarForm = false; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          Categorías
          <span class="admin-nav-badge">{$categorias.length}</span>
        </button>
      </li>
      <li class="admin-nav-item">
        <button class:active={tab === 'proveedores'} onclick={() => { tab = 'proveedores'; mostrarForm = false; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          Proveedores
          <span class="admin-nav-badge">{$proveedores.length}</span>
        </button>
      </li>
      <li class="admin-nav-item">
        <button class:active={tab === 'historial'} onclick={() => { tab = 'historial'; mostrarForm = false; cargarHistorial(); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
          </svg>
          Historial
        </button>
      </li>
      <li class="admin-nav-item">
        <button class:active={tab === 'landing'} onclick={() => { tab = 'landing'; mostrarForm = false; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Página de inicio
        </button>
      </li>
      <li class="admin-nav-item">
        <button class:active={tab === 'nosotros'} onclick={() => { tab = 'nosotros'; mostrarForm = false; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          Quiénes somos
        </button>
      </li>
      <li class="admin-nav-item">
        <button class:active={tab === 'contacto'} onclick={() => { tab = 'contacto'; mostrarForm = false; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/>
          </svg>
          Contacto
        </button>
      </li>
    </ul>

    <!-- Alertas rápidas -->
    {#if statSinImagen > 0 || statStockBajo > 0}
      <div class="admin-sidebar-alerts">
        {#if statSinImagen > 0}
          <div class="admin-alert warn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {statSinImagen} sin imagen
          </div>
        {/if}
        {#if statStockBajo > 0}
          <div class="admin-alert danger">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {statStockBajo} stock bajo
          </div>
        {/if}
      </div>
    {/if}
  </aside>

  <!-- ── CONTENIDO ADMIN ──────────────────────────────────── -->
  <div class="admin-content">

    <!-- Navegación mobile (solo visible en pantallas pequeñas) -->
    <div class="admin-mobile-tabs">
      <button class:active={tab === 'productos'} onclick={() => { tab = 'productos'; mostrarForm = false; }}>Productos</button>
      <button class:active={tab === 'categorias'} onclick={() => { tab = 'categorias'; mostrarForm = false; }}>Categorías</button>
      <button class:active={tab === 'proveedores'} onclick={() => { tab = 'proveedores'; mostrarForm = false; }}>Proveedores</button>
      <button class:active={tab === 'historial'} onclick={() => { tab = 'historial'; mostrarForm = false; cargarHistorial(); }}>Historial</button>
      <button class:active={tab === 'landing'} onclick={() => { tab = 'landing'; mostrarForm = false; }}>Inicio</button>
      <button class:active={tab === 'nosotros'} onclick={() => { tab = 'nosotros'; mostrarForm = false; }}>Nosotros</button>
      <button class:active={tab === 'contacto'} onclick={() => { tab = 'contacto'; mostrarForm = false; }}>Contacto</button>
    </div>

    <!-- ── PESTAÑA PRODUCTOS ── -->
    {#if tab === 'productos'}

      <!-- Stats -->
      {#if !mostrarForm}
        <div class="admin-stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:rgba(245,166,35,.12);color:var(--naranja)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
              </svg>
            </div>
            <div>
              <div class="stat-number">{statTotal}</div>
              <div class="stat-label">Productos</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:rgba(99,102,241,.12);color:#818cf8">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
            </div>
            <div>
              <div class="stat-number">{$categorias.length}</div>
              <div class="stat-label">Categorías</div>
            </div>
          </div>
          <div class="stat-card" class:stat-warn={statSinImagen > 0}>
            <div class="stat-icon" style="background:rgba(245,158,11,.12);color:#fbbf24">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div>
              <div class="stat-number">{statSinImagen}</div>
              <div class="stat-label">Sin imagen</div>
            </div>
          </div>
          <div class="stat-card" class:stat-danger={statStockBajo > 0}>
            <div class="stat-icon" style="background:rgba(239,68,68,.12);color:#f87171">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div class="stat-number">{statStockBajo}</div>
              <div class="stat-label">Stock bajo</div>
            </div>
          </div>
        </div>
      {/if}

      {#if mostrarForm}
        <!-- FORMULARIO PRODUCTO -->
        <div class="admin-section-header">
          <h2 class="admin-section-title">{editId ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button class="btn btn-ghost btn-sm" onclick={() => mostrarForm = false}>← Volver a la lista</button>
        </div>

        <form class="admin-form" onsubmit={guardarProd}>
          <div class="form-grid">
            <div class="form-field full">
              <label class="form-label" for="fn">Nombre *</label>
              <input id="fn" class="form-input" type="text" bind:value={formNombre} placeholder="Ej: Sillón 3 Cuerpos Premium" required />
            </div>

            <div class="form-field full">
              <label class="form-label" for="fd">Descripción</label>
              <textarea id="fd" class="form-textarea" bind:value={formDesc} placeholder="Descripción del producto..."></textarea>
            </div>

            <div class="form-field">
              <label class="form-label" for="fp">Precio final</label>
              <input id="fp" class="form-input" type="number" min="0" bind:value={formPrecio} placeholder="85000" />
            </div>

            <div class="form-field">
              <label class="form-label" for="fpa">Precio tachado</label>
              <input id="fpa" class="form-input" type="number" min="0" bind:value={formPrecioAnt} placeholder="100000" />
              <p style="font-size:.7rem;color:var(--text-3);margin:0">Se muestra tachado junto al precio final para marcar una oferta (opcional)</p>
            </div>

            <div class="form-field">
              <label class="form-label" for="fdesc">Descuento %</label>
              <input id="fdesc" class="form-input" type="number" min="0" max="100" bind:value={formDescuento} placeholder="Ej: 20 (para 20% off)" />
            </div>

            <div class="form-field">
              <label class="form-label" for="fstock">Stock (unidades)</label>
              <input id="fstock" class="form-input" type="number" min="0" bind:value={formStock} placeholder="Vacío = sin control" />
            </div>

            <div class="form-field full">
              <label class="form-label">Categorías</label>
              <div class="cat-checkboxes">
                {#each $categorias as cat (cat.id)}
                  <label class="filter-check">
                    <input type="checkbox"
                      checked={formCategorias.includes(cat.nombre)}
                      onchange={e => {
                        if (e.currentTarget.checked) formCategorias = [...formCategorias, cat.nombre];
                        else formCategorias = formCategorias.filter(c => c !== cat.nombre);
                      }} />
                    <span>{cat.nombre}</span>
                  </label>
                {/each}
                {#if $categorias.length === 0}
                  <p style="font-size:.75rem;color:var(--text-3);margin:0">Sin categorías creadas aún</p>
                {/if}
              </div>
            </div>

            <div class="form-field">
              <label class="form-label" for="fmat">Material</label>
              <input id="fmat" class="form-input" type="text" bind:value={formMaterial} placeholder="Ej: Madera, Cuero, Metal" />
            </div>

            <div class="form-field">
              <label class="form-label" for="fprov">Proveedor</label>
              <select id="fprov" class="form-select" bind:value={formProveedor}>
                <option value="">Sin proveedor</option>
                {#each $proveedores as prov (prov.id)}
                  <option value={prov.nombre}>{prov.nombre}</option>
                {/each}
              </select>
              {#if $proveedores.length === 0}
                <p style="font-size:.7rem;color:var(--text-3);margin:0">
                  No hay proveedores creados — agregalos en la pestaña Proveedores
                </p>
              {/if}
            </div>

            <!-- Upload de imagen -->
            <div class="form-field full">
              <label class="form-label">Imagen principal</label>
              <div
                class="upload-zone"
                class:drag-over={dragOver}
                ondragover={(e) => { e.preventDefault(); dragOver = true; }}
                ondragleave={() => dragOver = false}
                ondrop={onDrop}
              >
                <input type="file" accept="image/*" onchange={onFileChange} />
                {#if formImagenUrl}
                  <img class="upload-preview" src={formImagenUrl} alt="Preview" />
                {:else}
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto;color:var(--text-3)">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                {/if}
                <p>
                  {#if formImagenUrl}
                    <span>Cambiar imagen</span>
                  {:else}
                    Arrastrá una imagen o <span>hacé click para seleccionar</span>
                  {/if}
                </p>
                {#if uploadActivo}
                  <div class="upload-progress">
                    <div class="upload-progress-bar" style="width:{uploadProgress}%"></div>
                  </div>
                {/if}
              </div>

              <!-- O ingresar URL manualmente -->
              <div style="margin-top:.5rem">
                <input
                  class="form-input"
                  type="url"
                  placeholder="O pegá una URL de imagen (https://...)"
                  bind:value={formImagenUrl}
                />
              </div>
            </div>

            <!-- Galería de imágenes adicionales -->
            <div class="form-field full">
              <label class="form-label">Galería de fotos (opcional)</label>
              <div class="gallery-grid">
                {#each formGaleria as url, i}
                  <div class="gallery-item">
                    <img src={url} alt="Galería {i + 1}" />
                    <button type="button" class="gallery-remove" onclick={() => quitarImagenGaleria(i)} title="Quitar">✕</button>
                  </div>
                {/each}
                <label class="gallery-add" class:uploading={uploadGaleriaActivo}>
                  <input type="file" accept="image/*" onchange={onGaleriaFileChange} disabled={uploadGaleriaActivo} />
                  {#if uploadGaleriaActivo}
                    ...
                  {:else}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  {/if}
                </label>
              </div>
            </div>

            <!-- Flags -->
            <div class="form-field">
              <label class="filter-check" style="margin-top:.25rem">
                <input type="checkbox" bind:checked={formDestacado} />
                <span>Producto destacado</span>
              </label>
            </div>
            <div class="form-field">
              <label class="filter-check" style="margin-top:.25rem">
                <input type="checkbox" bind:checked={formNuevo} />
                <span>Marcar como nuevo</span>
              </label>
            </div>
            <div class="form-field">
              <label class="filter-check" style="margin-top:.25rem">
                <input type="checkbox" bind:checked={formActivo} />
                <span>Producto activo (visible en catálogo)</span>
              </label>
            </div>
            <div class="form-field full">
              <label class="form-label">Colores disponibles</label>
              <div class="color-picker-row">
                <input type="color" class="color-picker-input" bind:value={nuevoColorHex} />
                <input class="form-input" style="flex:1" type="text" bind:value={nuevoColorNombre}
                  placeholder="Nombre del color (ej: Marrón)"
                  onkeydown={e => e.key === 'Enter' && (e.preventDefault(), agregarColor())} />
                <button type="button" class="btn btn-ghost btn-sm" onclick={agregarColor}>Agregar</button>
              </div>
              {#if formColores.length > 0}
                <div class="color-swatches-edit">
                  {#each formColores as c, i}
                    <div class="color-swatch-edit">
                      <div class="color-dot" style="background:{c.hex};width:22px;height:22px"></div>
                      <span class="color-swatch-name">{c.nombre}</span>
                      <button type="button" class="color-remove" onclick={() => quitarColor(i)}>✕</button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <hr class="divider" />
          <div style="display:flex;gap:.75rem;justify-content:flex-end">
            <button type="button" class="btn btn-ghost" onclick={() => mostrarForm = false}>Cancelar</button>
            <button type="submit" class="btn btn-primary" disabled={guardando || uploadActivo}>
              {guardando ? 'Guardando...' : editId ? 'Guardar cambios' : 'Agregar producto'}
            </button>
          </div>
        </form>

      {:else}
        <!-- LISTA DE PRODUCTOS -->
        <div class="admin-section-header">
          <h2 class="admin-section-title">Productos</h2>
          <div style="display:flex;gap:.75rem;align-items:center">
            <select class="form-select" style="padding:.45rem .6rem;font-size:.78rem" bind:value={catAdmin} onchange={() => pagAdmin = 1}>
              <option value="">Todas las categorías</option>
              {#each $categorias as cat (cat.id)}
                <option value={cat.nombre}>{cat.nombre}</option>
              {/each}
            </select>
            <div class="admin-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" placeholder="Buscar por nombre, categoría, material, precio..." bind:value={busquedaAdmin} oninput={() => pagAdmin = 1} />
            </div>
            <button class="btn btn-primary" onclick={abrirFormNuevo}>
              + Nuevo
            </button>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Proveedor</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Flags</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#if prodsPaginados.length === 0}
                <tr>
                  <td colspan="8" style="text-align:center;padding:2rem;color:var(--text-3)">
                    Sin resultados
                  </td>
                </tr>
              {/if}
              {#each prodsPaginados as p (p.id)}
                <tr style={p.activo === false ? 'opacity:.45' : ''}>
                  <td>
                    {#if p.imagen}
                      <img class="admin-thumb" src={p.imagen} alt={p.nombre} loading="lazy" />
                    {:else}
                      <div class="admin-thumb-placeholder">🛋️</div>
                    {/if}
                  </td>
                  <td class="bold">{p.nombre}</td>
                  <td>{getCats(p).join(', ') || '—'}</td>
                  <td>{p.proveedor || '—'}</td>
                  <td>
                    {#if p.descuento > 0}
                      <span style="text-decoration:line-through;font-size:.75rem;color:var(--text-3)">{pesos(p.precio)}</span>
                      <span style="color:var(--naranja);font-weight:700;margin-left:.3rem">{pesos(Math.round(p.precio * (1 - p.descuento / 100)))} (-{p.descuento}%)</span>
                    {:else}
                      {p.precio != null ? pesos(p.precio) : '—'}
                    {/if}
                  </td>
                  <td style="color:{p.stock === 0 ? '#ef4444' : p.stock != null && p.stock <= 4 ? '#f59e0b' : 'inherit'};font-weight:{p.stock != null && p.stock <= 4 ? 600 : 400}">
                    {p.stock != null ? p.stock : '—'}
                  </td>
                  <td>
                    {#if p.destacado}<span class="badge badge-destacado" style="margin-right:.25rem">★</span>{/if}
                    {#if p.nuevo}<span class="badge badge-nuevo">Nuevo</span>{/if}
                  </td>
                  <td>
                    <div style="display:flex;gap:.35rem">
                      <button class="btn btn-ghost btn-sm btn-icon" onclick={() => editarProd(p)} title="Editar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button class="btn btn-ghost btn-sm btn-icon" onclick={() => toggleActivo(p)}
                        title={p.activo === false ? 'Activar producto' : 'Desactivar producto'}
                        style={p.activo === false ? 'color:#ef4444;border-color:#3a1a1a' : ''}>
                        {#if p.activo === false}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        {:else}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        {/if}
                      </button>
                      <button class="btn btn-danger btn-sm btn-icon" onclick={() => eliminarProd(p)} title="Eliminar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Paginación admin -->
        {#if totalPagsAdmin > 1}
          <div style="display:flex;gap:.35rem;justify-content:center;margin-top:1.25rem">
            <button class="page-btn" onclick={() => pagAdmin = Math.max(1, pagAdmin - 1)} disabled={pagAdmin === 1}>←</button>
            {#each Array.from({ length: totalPagsAdmin }, (_, i) => i + 1) as n}
              <button class="page-btn" class:active={n === pagAdmin} onclick={() => pagAdmin = n}>{n}</button>
            {/each}
            <button class="page-btn" onclick={() => pagAdmin = Math.min(totalPagsAdmin, pagAdmin + 1)} disabled={pagAdmin === totalPagsAdmin}>→</button>
          </div>
        {/if}
      {/if}

    <!-- ── PESTAÑA CATEGORÍAS ── -->
    {:else if tab === 'categorias'}
      <div class="admin-section-header">
        <h2 class="admin-section-title">Categorías</h2>
      </div>

      <!-- Agregar categoría -->
      <form class="admin-form" style="margin-bottom:1.5rem" onsubmit={agregarCategoria}>
        <div style="display:flex;gap:.75rem;align-items:flex-end;max-width:480px">
          <div class="form-field" style="flex:1">
            <label class="form-label" for="nc">Nueva categoría</label>
            <input id="nc" class="form-input" type="text" bind:value={nuevaCat} placeholder="Ej: Dormitorio" />
          </div>
          <button type="submit" class="btn btn-primary" disabled={agregandoCat || !nuevaCat.trim()}>
            {agregandoCat ? '...' : 'Agregar'}
          </button>
        </div>
      </form>

      <!-- Lista de categorías -->
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Productos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each $categorias as cat (cat.id)}
              <tr>
                <td class="bold">
                  {#if editCatId === cat.id}
                    <form onsubmit={(e) => { e.preventDefault(); guardarCat(cat.id); }} style="display:flex;gap:.5rem">
                      <input class="form-input" type="text" bind:value={editCatNombre} style="padding:.35rem .6rem;font-size:.82rem" />
                      <button type="submit" class="btn btn-primary btn-sm">✓</button>
                      <button type="button" class="btn btn-ghost btn-sm" onclick={() => editCatId = ''}>✕</button>
                    </form>
                  {:else}
                    {cat.nombre}
                  {/if}
                </td>
                <td>{$productos.filter(p => p.categoria === cat.nombre).length}</td>
                <td>
                  <div style="display:flex;gap:.35rem">
                    <button
                      class="btn btn-ghost btn-sm btn-icon"
                      onclick={() => { editCatId = cat.id; editCatNombre = cat.nombre; }}
                      title="Editar"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      class="btn btn-danger btn-sm btn-icon"
                      onclick={() => eliminarCategoria(cat)}
                      title="Eliminar"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- ── PESTAÑA PROVEEDORES ── -->
    {#if tab === 'proveedores'}
      <div class="admin-section-header">
        <h2 class="admin-section-title">Proveedores</h2>
      </div>

      <!-- Agregar proveedor -->
      <form class="admin-form" style="margin-bottom:1.5rem" onsubmit={agregarProveedor}>
        <div style="display:flex;gap:.75rem;align-items:flex-end;max-width:480px">
          <div class="form-field" style="flex:1">
            <label class="form-label" for="np">Nuevo proveedor</label>
            <input id="np" class="form-input" type="text" bind:value={nuevoProv} placeholder="Ej: Sillas del Sur SRL" />
          </div>
          <button type="submit" class="btn btn-primary" disabled={agregandoProv || !nuevoProv.trim()}>
            {agregandoProv ? '...' : 'Agregar'}
          </button>
        </div>
      </form>

      <!-- Lista de proveedores -->
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Productos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each $proveedores as prov (prov.id)}
              <tr>
                <td class="bold">
                  {#if editProvId === prov.id}
                    <form onsubmit={(e) => { e.preventDefault(); guardarProveedor(prov.id); }} style="display:flex;gap:.5rem">
                      <input class="form-input" type="text" bind:value={editProvNombre} style="padding:.35rem .6rem;font-size:.82rem" />
                      <button type="submit" class="btn btn-primary btn-sm">✓</button>
                      <button type="button" class="btn btn-ghost btn-sm" onclick={() => editProvId = ''}>✕</button>
                    </form>
                  {:else}
                    {prov.nombre}
                  {/if}
                </td>
                <td>{$productos.filter(p => p.proveedor === prov.nombre).length}</td>
                <td>
                  <div style="display:flex;gap:.35rem">
                    <button
                      class="btn btn-ghost btn-sm btn-icon"
                      onclick={() => { editProvId = prov.id; editProvNombre = prov.nombre; }}
                      title="Editar"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      class="btn btn-danger btn-sm btn-icon"
                      onclick={() => eliminarProveedor(prov)}
                      title="Eliminar"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
            {#if $proveedores.length === 0}
              <tr>
                <td colspan="3" style="text-align:center;padding:2rem;color:var(--text-3)">
                  Sin proveedores creados aún
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Aumento masivo de precios -->
      <div class="admin-form-group-title" style="margin-top:2rem">Aumento masivo de precios por proveedor</div>
      <form class="admin-form" onsubmit={(e) => e.preventDefault()}>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label" for="aum-prov">Proveedor</label>
            <select id="aum-prov" class="form-select" bind:value={aumentoProveedor}>
              <option value="">Seleccioná un proveedor</option>
              {#each $proveedores as prov (prov.id)}
                <option value={prov.nombre}>{prov.nombre}</option>
              {/each}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="aum-dir">Acción</label>
            <select id="aum-dir" class="form-select" bind:value={aumentoDireccion}>
              <option value="subir">Aumentar precio</option>
              <option value="bajar">Bajar precio</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="aum-pct">Porcentaje (%)</label>
            <input id="aum-pct" class="form-input" type="number" min="0" step="0.01" bind:value={aumentoPorcentaje} placeholder="Ej: 10" />
          </div>
        </div>

        {#if aumentoPreview}
          <div class="aumento-preview">
            {#if aumentoPreview.count === 0}
              <p>No hay productos asociados a "{aumentoProveedor}".</p>
            {:else}
              <p>Se {aumentoDireccion === 'subir' ? 'van a aumentar' : 'van a bajar'} los precios de <strong>{aumentoPreview.count}</strong> producto(s) de "{aumentoProveedor}" un <strong>{Math.abs(aumentoPctFirmado)}%</strong>.</p>
              {#if aumentoPreview.ejemplo}
                <p class="aumento-ejemplo">
                  Ejemplo — "{aumentoPreview.ejemplo.nombre}": {pesos(aumentoPreview.ejemplo.precioAntes)} → {pesos(aumentoPreview.ejemplo.precioDespues)}
                  {#if aumentoPreview.ejemplo.tachadoAntes != null}
                    (precio tachado: {pesos(aumentoPreview.ejemplo.tachadoAntes)} → {pesos(aumentoPreview.ejemplo.tachadoDespues)})
                  {/if}
                </p>
              {/if}
              <button type="button" class="btn btn-primary" disabled={aplicandoAumento} onclick={aplicarAumentoMasivo}>
                {aplicandoAumento ? 'Aplicando...' : `Aplicar a ${aumentoPreview.count} producto(s)`}
              </button>
            {/if}
          </div>
        {/if}
      </form>
    {/if}

    <!-- ── PESTAÑA HISTORIAL ── -->
    {#if tab === 'historial'}
      <div class="admin-section-header">
        <h2 class="admin-section-title">Historial de cambios</h2>
        <p class="admin-section-sub">Últimos 200 movimientos del panel de administración</p>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {#if cargandoHistorial}
              <tr>
                <td colspan="4" style="text-align:center;padding:2rem;color:var(--text-3)">Cargando...</td>
              </tr>
            {:else if historial.length === 0}
              <tr>
                <td colspan="4" style="text-align:center;padding:2rem;color:var(--text-3)">Sin movimientos registrados todavía</td>
              </tr>
            {:else}
              {#each historial as h (h.id)}
                <tr>
                  <td style="white-space:nowrap;color:var(--text-3);font-size:.8rem">
                    {new Date(h.fecha).toLocaleString('es-AR')}
                  </td>
                  <td>
                    <span class="badge" style="background:{tipoHistorialLabel(h.tipo).color}22;color:{tipoHistorialLabel(h.tipo).color}">
                      {tipoHistorialLabel(h.tipo).label}
                    </span>
                  </td>
                  <td>{h.descripcion}</td>
                  <td style="color:var(--text-3);font-size:.8rem">{h.usuario}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- ── PESTAÑA LANDING ── -->
    {#if tab === 'landing'}
      <div class="admin-section-header">
        <h2 class="admin-section-title">Página de Inicio</h2>
        <p class="admin-section-sub">Editá los textos e imágenes de la página principal</p>
      </div>

      <form class="admin-form full-width" onsubmit={guardarLanding}>

        <!-- HERO -->
        <div class="admin-form-group-title">Hero</div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label" for="hero-badge">Badge (etiqueta pequeña)</label>
            <input id="hero-badge" class="form-input" bind:value={landingForm.hero_badge} placeholder="ej: Nuestro catálogo" />
          </div>
          <div class="form-field">
            <label class="form-label" for="hero-btn2">Texto botón 2 (Contactar)</label>
            <input id="hero-btn2" class="form-input" bind:value={landingForm.hero_btn2} />
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label" for="hero-titulo">Título principal</label>
            <input id="hero-titulo" class="form-input" bind:value={landingForm.hero_titulo} />
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label" for="hero-sub">Subtítulo</label>
            <textarea id="hero-sub" class="form-input" rows="2" bind:value={landingForm.hero_subtitulo}></textarea>
          </div>
          <div class="form-field">
            <label class="form-label" for="hero-btn1">Texto botón 1 (Ver Catálogo)</label>
            <input id="hero-btn1" class="form-input" bind:value={landingForm.hero_btn1} />
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label">Imagen de fondo del hero</label>
            {#if landingForm.hero_imagen}
              <img src={landingForm.hero_imagen} alt="Hero" style="height:100px;border-radius:var(--radius);object-fit:cover;margin-bottom:.5rem;" />
            {/if}
            <div class="file-upload-wrap">
              <label class="file-upload-label" class:uploading={uploadLandingField === 'hero_imagen'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {uploadLandingField === 'hero_imagen' ? 'Subiendo...' : 'Agregar archivo'}
                <input type="file" accept="image/*" onchange={e => subirImagenLanding(e.target.files[0], 'hero_imagen')} disabled={!!uploadLandingField} />
              </label>
            </div>
          </div>
        </div>

        <!-- COLECCIONES -->
        <div class="admin-form-group-title" style="margin-top:2rem">Colecciones</div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label" for="col-sec-titulo">Título de sección</label>
            <input id="col-sec-titulo" class="form-input" bind:value={landingForm.col_seccion_titulo} />
          </div>
          <div class="form-field">
            <label class="form-label" for="col-sec-sub">Subtítulo de sección</label>
            <input id="col-sec-sub" class="form-input" bind:value={landingForm.col_seccion_sub} />
          </div>
        </div>
        {#each [
          { prefix: 'col1', label: 'Colección 1' },
          { prefix: 'col2', label: 'Colección 2' },
          { prefix: 'col3', label: 'Colección 3' },
        ] as col}
          <div style="background:var(--bg-2);border-radius:var(--radius);padding:1rem;margin-bottom:.75rem">
            <p style="font-size:.75rem;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem">{col.label}</p>
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Nombre</label>
                <input class="form-input" bind:value={landingForm[`${col.prefix}_nombre`]} />
              </div>
              <div class="form-field">
                <label class="form-label">Badge</label>
                <input class="form-input" bind:value={landingForm[`${col.prefix}_badge`]} />
              </div>
              <div class="form-field">
                <label class="form-label">Categoría de destino</label>
                <select class="form-select" bind:value={landingForm[`${col.prefix}_link`]}>
                  <option value="">Seleccioná una categoría</option>
                  {#each $categorias as cat (cat.id)}
                    <option value={cat.nombre}>{cat.nombre}</option>
                  {/each}
                </select>
              </div>
              <div class="form-field">
                <label class="form-label">Imagen</label>
                {#if landingForm[`${col.prefix}_imagen`]}
                  <img src={landingForm[`${col.prefix}_imagen`]} alt={col.label} style="height:70px;border-radius:var(--radius-sm);object-fit:cover;margin-bottom:.4rem;" />
                {/if}
                <div class="file-upload-wrap">
                  <label class="file-upload-label" class:uploading={uploadLandingField === `${col.prefix}_imagen`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {uploadLandingField === `${col.prefix}_imagen` ? 'Subiendo...' : 'Agregar archivo'}
                    <input type="file" accept="image/*" onchange={e => subirImagenLanding(e.target.files[0], `${col.prefix}_imagen`)} disabled={!!uploadLandingField} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        {/each}

        <!-- PROMO PANEL -->
        <div class="admin-form-group-title" style="margin-top:2rem">Panel Promo</div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label">Badge</label>
            <input class="form-input" bind:value={landingForm.promo_badge} />
          </div>
          <div class="form-field">
            <label class="form-label">Título</label>
            <input class="form-input" bind:value={landingForm.promo_titulo} />
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label" for="promo-texto">Texto</label>
            <textarea id="promo-texto" class="form-input" rows="3" bind:value={landingForm.promo_texto}></textarea>
          </div>
          <div class="form-field">
            <label class="form-label" for="promo-btn">Texto del botón</label>
            <input id="promo-btn" class="form-input" bind:value={landingForm.promo_btn} placeholder="Ver colección" />
          </div>
        </div>

        <!-- SOBRE NOSOTROS -->
        <div class="admin-form-group-title" style="margin-top:2rem">Sobre Nosotros</div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label">Badge</label>
            <input class="form-input" bind:value={landingForm.sobre_badge} />
          </div>
          <div class="form-field">
            <label class="form-label">Título</label>
            <input class="form-input" bind:value={landingForm.sobre_titulo} />
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label">Texto</label>
            <textarea class="form-input" rows="3" bind:value={landingForm.sobre_texto}></textarea>
          </div>
          <div class="form-field">
            <label class="form-label">Ítem 1</label>
            <input class="form-input" bind:value={landingForm.sobre_item1} />
          </div>
          <div class="form-field">
            <label class="form-label">Ítem 2</label>
            <input class="form-input" bind:value={landingForm.sobre_item2} />
          </div>
          <div class="form-field">
            <label class="form-label">Ítem 3</label>
            <input class="form-input" bind:value={landingForm.sobre_item3} />
          </div>
          <div class="form-field">
            <label class="form-label" for="sobre-btn">Texto del botón</label>
            <input id="sobre-btn" class="form-input" bind:value={landingForm.sobre_btn} placeholder="Conocernos más" />
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label">Imagen</label>
            {#if landingForm.sobre_imagen}
              <img src={landingForm.sobre_imagen} alt="Sobre nosotros" style="height:100px;border-radius:var(--radius);object-fit:cover;margin-bottom:.5rem;" />
            {/if}
            <div class="file-upload-wrap">
              <label class="file-upload-label" class:uploading={uploadLandingField === 'sobre_imagen'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {uploadLandingField === 'sobre_imagen' ? 'Subiendo...' : 'Agregar archivo'}
                <input type="file" accept="image/*" onchange={e => subirImagenLanding(e.target.files[0], 'sobre_imagen')} disabled={!!uploadLandingField} />
              </label>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div class="admin-form-group-title" style="margin-top:2rem">Banner CTA</div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label">Título</label>
            <input class="form-input" bind:value={landingForm.cta_titulo} />
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label" for="cta-texto">Texto</label>
            <textarea id="cta-texto" class="form-input" rows="2" bind:value={landingForm.cta_texto}></textarea>
          </div>
          <div class="form-field">
            <label class="form-label" for="cta-btn">Texto del botón</label>
            <input id="cta-btn" class="form-input" bind:value={landingForm.cta_btn} placeholder="Escribinos por WhatsApp" />
          </div>
        </div>

        <div style="margin-top:2rem;display:flex;gap:1rem">
          <button type="submit" class="btn btn-primary" disabled={guardandoLanding}>
            {guardandoLanding ? 'Guardando...' : 'Guardar página de inicio'}
          </button>
        </div>
      </form>
    {/if}

    <!-- ── PESTAÑA NOSOTROS ── -->
    {#if tab === 'nosotros'}
      <div class="admin-section-header">
        <h2 class="admin-section-title">Quiénes somos</h2>
        <p class="admin-section-sub">Editá el contenido de la página Nosotros</p>
      </div>

      <form class="admin-form full-width" onsubmit={guardarNosotros}>

        <div class="admin-form-group-title">Encabezado</div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label" for="nos-titulo">Título</label>
            <input id="nos-titulo" class="form-input" bind:value={nosotrosForm.titulo} />
          </div>
          <div class="form-field">
            <label class="form-label" for="nos-sub">Subtítulo</label>
            <input id="nos-sub" class="form-input" bind:value={nosotrosForm.subtitulo} />
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label" for="nos-texto">Texto principal</label>
            <textarea id="nos-texto" class="form-input" rows="5" bind:value={nosotrosForm.texto}></textarea>
          </div>
          <div class="form-field" style="grid-column: 1 / -1">
            <label class="form-label">Imagen</label>
            {#if nosotrosForm.imagen}
              <img src={nosotrosForm.imagen} alt="Nosotros" style="height:120px;border-radius:var(--radius);object-fit:cover;margin-bottom:.5rem;" />
            {/if}
            <div class="file-upload-wrap">
              <label class="file-upload-label" class:uploading={uploadNosotrosField === 'imagen'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {uploadNosotrosField === 'imagen' ? 'Subiendo...' : 'Agregar archivo'}
                <input type="file" accept="image/*" onchange={e => subirImagenNosotros(e.target.files[0])} disabled={!!uploadNosotrosField} />
              </label>
            </div>
          </div>
        </div>

        <div class="admin-form-group-title" style="margin-top:2rem">Valores / Pilares</div>
        {#each [
          { n: 1, tKey: 'valor1_titulo', txKey: 'valor1_texto', label: 'Valor 1' },
          { n: 2, tKey: 'valor2_titulo', txKey: 'valor2_texto', label: 'Valor 2' },
          { n: 3, tKey: 'valor3_titulo', txKey: 'valor3_texto', label: 'Valor 3' },
        ] as v}
          <div style="background:var(--bg-2);border-radius:var(--radius);padding:1rem;margin-bottom:.75rem">
            <p style="font-size:.75rem;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem">{v.label}</p>
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label" for="nos-v{v.n}-t">Título</label>
                <input id="nos-v{v.n}-t" class="form-input" bind:value={nosotrosForm[v.tKey]} />
              </div>
              <div class="form-field">
                <label class="form-label" for="nos-v{v.n}-tx">Texto</label>
                <input id="nos-v{v.n}-tx" class="form-input" bind:value={nosotrosForm[v.txKey]} />
              </div>
            </div>
          </div>
        {/each}

        <div style="margin-top:2rem">
          <button type="submit" class="btn btn-primary" disabled={guardandoNosotros}>
            {guardandoNosotros ? 'Guardando...' : 'Guardar página Nosotros'}
          </button>
        </div>
      </form>
    {/if}

    <!-- ── PESTAÑA CONTACTO ── -->
    {#if tab === 'contacto'}
      <div class="admin-section-header">
        <h2 class="admin-section-title">Contacto</h2>
        <p class="admin-section-sub">Número de WhatsApp que aparece en todo el sitio</p>
      </div>

      <form class="admin-form" onsubmit={guardarContacto}>
        <div class="admin-form-group-title">WhatsApp</div>
        <div class="form-field" style="max-width:360px">
          <label class="form-label" for="wsp-num">Número de WhatsApp</label>
          <input
            id="wsp-num"
            class="form-input"
            type="text"
            bind:value={contactoForm.wsp_num}
            placeholder="5492252486140"
          />
          <p style="font-size:.7rem;color:var(--text-3);margin-top:.4rem;line-height:1.5">
            Formato internacional sin +: código de país + número.<br>
            Ejemplo Argentina: <strong style="color:var(--text-2)">549</strong> + número sin 0 ni 15.<br>
            (0221 123-4567 → <strong style="color:var(--text-2)">5492211234567</strong>)
          </p>
        </div>

        <div class="admin-form-group-title" style="margin-top:2rem">Locales</div>
        <div class="form-field full" style="max-width:640px">
          {#each contactoForm.locales ?? [] as local, i}
            <div class="local-row">
              <input class="form-input" type="text" bind:value={local.nombre} placeholder="Nombre (ej: Sucursal Centro)" />
              <input class="form-input" type="text" bind:value={local.direccion} placeholder="Dirección" />
              <button type="button" class="btn btn-danger btn-sm btn-icon" onclick={() => quitarLocal(i)} title="Quitar">✕</button>
            </div>
          {/each}
          <button type="button" class="btn btn-ghost btn-sm" onclick={agregarLocal}>+ Agregar local</button>
        </div>

        <div style="margin-top:1.5rem">
          <button type="submit" class="btn btn-primary" disabled={guardandoContacto}>
            {guardandoContacto ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    {/if}

  </div>
</div>
