import { writable, derived } from 'svelte/store';

// ── Datos de Firestore ──────────────────────────────────────────────
export const productos   = writable([]);
export const categorias  = writable([]);
export const proveedores = writable([]);

// ── Auth ────────────────────────────────────────────────────────────
export const usuario = writable(null);
export const authCargando = writable(true);

// ── Filtros del catálogo ────────────────────────────────────────────
export const filtroCategoria  = writable('todos');
export const textoBusqueda    = writable('');
export const filtroMaterial   = writable('');
export const precioMin        = writable('');
export const precioMax        = writable('');
export const soloDestacados   = writable(false);
export const ordenamiento     = writable('nombre-asc');

// ── Toast global ────────────────────────────────────────────────────
export const toasts = writable([]);

let toastId = 0;
export function toast(msg, tipo = 'ok', duracion = 3500) {
  const id = ++toastId;
  toasts.update(t => [...t, { id, msg, tipo }]);
  setTimeout(() => toasts.update(t => t.filter(x => x.id !== id)), duracion);
}

// ── Precio final (aplicando descuento %) ────────────────────────────
export function precioFinal(p) {
  if (p.precio == null) return null;
  if (p.descuento > 0) return Math.round(p.precio * (1 - p.descuento / 100));
  return p.precio;
}

// ── Productos filtrados (derived store) ─────────────────────────────
export const productosFiltrados = derived(
  [productos, filtroCategoria, textoBusqueda, filtroMaterial, precioMin, precioMax, soloDestacados, ordenamiento],
  ([$productos, $cat, $texto, $material, $pMin, $pMax, $dest, $orden]) => {
    let ps = $productos.filter(p => p.activo !== false);

    if ($cat !== 'todos') {
      ps = ps.filter(p => {
        const cats = p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : [];
        return cats.includes($cat);
      });
    }
    if ($material) {
      ps = ps.filter(p => p.material === $material);
    }
    if ($texto.trim()) {
      const q = $texto.toLowerCase();
      ps = ps.filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.material || '').toLowerCase().includes(q) ||
        (p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : []).join(' ').toLowerCase().includes(q)
      );
    }
    if ($pMin !== '') {
      ps = ps.filter(p => { const pf = precioFinal(p); return pf != null && pf >= Number($pMin); });
    }
    if ($pMax !== '') {
      ps = ps.filter(p => { const pf = precioFinal(p); return pf != null && pf <= Number($pMax); });
    }
    if ($dest) {
      ps = ps.filter(p => p.destacado);
    }

    return [...ps].sort((a, b) => {
      switch ($orden) {
        case 'nombre-desc': return (b.nombre || '').localeCompare(a.nombre || '', 'es');
        case 'precio-asc':  return (precioFinal(a) || 0) - (precioFinal(b) || 0);
        case 'precio-desc': return (precioFinal(b) || 0) - (precioFinal(a) || 0);
        default:            return (a.nombre || '').localeCompare(b.nombre || '', 'es');
      }
    });
  }
);

// ── Configuración de la Landing page ────────────────────────────────
// Fotos por defecto de Unsplash (libres). El admin puede reemplazarlas.
export const configLanding = writable({
  hero_badge:    'Nuestro catálogo',
  hero_titulo:   'Diseño y calidad para tu hogar',
  hero_subtitulo:'Explorá nuestra colección de muebles y encontrá la pieza perfecta para cada espacio.',
  hero_imagen:   'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920&q=80',
  hero_btn1:     'Ver Catálogo',
  hero_btn2:     'Contactar',

  col_seccion_titulo: 'Nuestras Colecciones',
  col_seccion_sub:    'Explorá cada espacio de tu hogar',

  col1_nombre: 'Salón',      col1_badge: 'Confort y estilo',       col1_imagen: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&q=80', col1_link: 'Salón',
  col2_nombre: 'Dormitorio', col2_badge: 'Tu espacio de descanso', col2_imagen: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80', col2_link: 'Dormitorio',
  col3_nombre: 'Trabajo',    col3_badge: 'Productividad en casa',  col3_imagen: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80', col3_link: 'Trabajo',

  promo_badge: '— Nueva línea',
  promo_titulo:'Explorá nuestra nueva colección',
  promo_texto: 'Piezas diseñadas para resistir el ritmo de la vida cotidiana. Calidad, estilo y durabilidad en cada detalle.',
  promo_btn:   'Ver colección',

  sobre_badge:  'Nuestra Esencia',
  sobre_titulo: 'Diseño Moderno, Alma Artesana.',
  sobre_texto:  'En Muebles Rafaela creemos que los muebles no son solo objetos, sino los pilares de tu vida cotidiana.',
  sobre_item1:  'Maderas nobles seleccionadas a mano.',
  sobre_item2:  'Acabados de alta resistencia.',
  sobre_item3:  'Diseño optimizado para espacios reales.',
  sobre_imagen: '/sobre.jpg',
  sobre_btn:    'Conocernos más',

  cta_titulo: '¿Necesitás un proyecto a medida?',
  cta_texto:  'Nuestro equipo está disponible para asesorarte de forma personalizada y enviarte presupuestos sin compromiso.',
  cta_btn:    'Escribinos por WhatsApp',
});

// ── Configuración de la página Nosotros ─────────────────────────────
export const configNosotros = writable({
  titulo:    'Quiénes somos',
  subtitulo: 'Conocé nuestra historia y lo que nos hace únicos.',
  texto:     'Muebles Rafaela es una mueblería con años de experiencia en diseño y calidad para el hogar. Nuestro catálogo online te permite explorar toda nuestra colección y consultarnos directamente por WhatsApp para asesoramiento personalizado.',
  imagen:    '',
  valor1_titulo: 'Calidad garantizada',
  valor1_texto:  'Trabajamos solo con materiales y proveedores de confianza.',
  valor2_titulo: 'Diseño a medida',
  valor2_texto:  'Cada pieza puede adaptarse a las necesidades de tu espacio.',
  valor3_titulo: 'Atención personalizada',
  valor3_texto:  'Te acompañamos en todo el proceso, desde la elección hasta la entrega.',
});

// ── Configuración de contacto ────────────────────────────────────────
export const configContacto = writable({
  wsp_num: '5492252486140',
  locales: [], // [{ nombre, direccion }]
});

// ── Conteo por categoría ────────────────────────────────────────────
export const conteoCategoria = derived(productos, $ps => {
  const mapa = {};
  for (const p of $ps) {
    const cats = p.categorias?.length ? p.categorias : p.categoria ? [p.categoria] : [];
    for (const c of cats) {
      mapa[c] = (mapa[c] || 0) + 1;
    }
  }
  return mapa;
});
