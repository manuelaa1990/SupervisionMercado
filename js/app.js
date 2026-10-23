/* ============================================================================
   FLOTA · INTERFAZ
   ========================================================================== */

(function () {
  'use strict';

  const CFG = window.CONFIG_FLOTA;
  const $ = (id) => document.getElementById(id);

  const ui = {
    filtro: 'todos',
    busqueda: '',
    equipoAbierto: null,
    ultimoFoco: null,
    firmaResumen: '',
    logEstado: 'todas',
    logEquipo: 'todos',
    toastTimer: null
  };

  const ids = {
    grid: $('gridEquipos'),
    vacio: $('sinResultados'),
    chips: $('chipsResumen'),
    buscar: $('buscarEquipo'),
    drawer: $('drawer'),
    drawerContenido: $('drawerContenido'),
    overlay: $('overlay'),
    modalCrear: $('modalCrear'),
    modalRegistro: $('modalRegistro'),
    formCrear: $('formCrear'),
    tiposCrear: $('tiposCrear'),
    refrigerante: $('refrigeranteEquipo'),
    expansion: $('expansionEquipo'),
    aceite: $('aceiteEquipo'),
    compresor: $('compresorEquipo'),
    objetivo: $('objetivoEquipo'),
    ayudaObjetivo: $('ayudaObjetivo'),
    nombre: $('nombreEquipo'),
    ubicacion: $('ubicacionEquipo'),
    relojHora: $('relojHora'),
    relojFecha: $('relojFecha'),
    tituloFlota: $('tituloFlota'),
    puntoSim: $('puntoSim'),
    textoSim: $('textoSim'),
    btnPausa: $('btnPausa'),
    simulacion: $('simulacion'),
    registroCuerpo: $('registroCuerpo'),
    filtroEstado: $('filtroEstado'),
    filtroEquipo: $('filtroEquipo'),
    toast: $('toast')
  };

  const fechaHora = new Intl.DateTimeFormat('es-VE', {
    timeZone: CFG.zonaHoraria,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const horaSegundos = new Intl.DateTimeFormat('es-VE', {
    timeZone: CFG.zonaHoraria,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const fechaLarga = new Intl.DateTimeFormat('es-VE', {
    timeZone: CFG.zonaHoraria,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  function escapar(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function numero(valor, decimales) {
    if (!Number.isFinite(valor)) return '—';
    return valor.toFixed(decimales == null ? 1 : decimales);
  }

  function etiquetaTipo(tipo) {
    const cfg = CFG.tipos[tipo];
    return cfg ? cfg.corto + ' · ' + cfg.nombre : tipo;
  }

  function limitesEspacio(equipo) {
    const tipo = CFG.tipos[equipo.tipo] || CFG.tipos.MBP;
    const objetivo = Number.isFinite(equipo.objetivo) ? equipo.objetivo : tipo.objetivo;
    return {
      objetivo: objetivo,
      avisoAlto: objetivo + tipo.margenes.avisoAlto,
      alarmaAlto: objetivo + tipo.margenes.alarmaAlto,
      avisoBajo: objetivo - tipo.margenes.avisoBajo,
      alarmaBajo: objetivo - tipo.margenes.alarmaBajo
    };
  }

  /* --------------------------------- RELOJ --------------------------------- */

  function actualizarReloj() {
    const ahora = new Date();
    ids.relojHora.textContent = horaSegundos.format(ahora);
    ids.relojFecha.textContent = fechaLarga.format(ahora);
  }

  /* ------------------------------- TOAST ---------------------------------- */

  function toast(mensaje, error) {
    if (ui.toastTimer) clearTimeout(ui.toastTimer);
    ids.toast.textContent = mensaje;
    ids.toast.classList.toggle('error', !!error);
    ids.toast.classList.add('visible');
    ui.toastTimer = setTimeout(() => {
      ids.toast.classList.remove('visible');
    }, 3800);
  }

  /* ------------------------------- RESUMEN -------------------------------- */

  function actualizarResumen(forzar) {
    const resumen = FLOTA.resumen();
    const firma = [
      resumen.total, resumen.alarma, resumen.aviso, resumen.sugerencia,
      resumen.sin_datos, resumen.normal, ui.filtro
    ].join('|');

    if (!forzar && firma === ui.firmaResumen) return;
    ui.firmaResumen = firma;
    if (ids.tituloFlota) {
      ids.tituloFlota.textContent = 'SupervisionMercado · ' + resumen.total + (resumen.total === 1 ? ' equipo' : ' equipos');
    }

    const items = [
      { clave: 'todos', texto: 'Todos', valor: resumen.total },
      { clave: 'alarma', texto: 'Alarmas', valor: resumen.alarma },
      { clave: 'aviso', texto: 'Avisos', valor: resumen.aviso },
      { clave: 'sugerencia', texto: 'Sugerencias', valor: resumen.sugerencia },
      { clave: 'sin_datos', texto: 'Sin datos', valor: resumen.sin_datos },
      { clave: 'normal', texto: 'Normales', valor: resumen.normal }
    ];

    ids.chips.innerHTML = items.map((item) => {
      const activo = ui.filtro === item.clave;
      return '<button type="button" class="chip-resumen chip-resumen--' + item.clave + '" ' +
        'data-filtro="' + item.clave + '" aria-pressed="' + activo + '">' +
        '<span class="punto"></span>' + item.texto + ' <b>' + item.valor + '</b></button>';
    }).join('');
  }

  /* -------------------------------- GRID ---------------------------------- */

  const RANGO_ORDEN = { alarma: 5, sin_datos: 4, aviso: 3, sugerencia: 2, normal: 1 };

  function equiposFiltrados() {
    const texto = ui.busqueda.trim().toLowerCase();
    return FLOTA.equipos()
      .filter((equipo) => {
        const estado = FLOTA.estadoEquipo(equipo);
        if (ui.filtro !== 'todos' && estado.nivel !== ui.filtro) return false;
        if (!texto) return true;
        const contenido = [
          equipo.nombre, equipo.ubicacion, equipo.tipo, equipo.refrigerante,
          equipo.expansion, equipo.compresor, equipo.aceite
        ].join(' ').toLowerCase();
        return contenido.indexOf(texto) >= 0;
      })
      .sort((a, b) => {
        const ea = FLOTA.estadoEquipo(a);
        const eb = FLOTA.estadoEquipo(b);
        const diferencia = (RANGO_ORDEN[eb.nivel] || 0) - (RANGO_ORDEN[ea.nivel] || 0);
        if (diferencia !== 0) return diferencia;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }

  function sparkline(equipoId) {
    const historial = FLOTA.historial(equipoId).slice(-60);
    if (historial.length < 2) return '';
    const valores = historial.map((lectura) => lectura.tempEspacio);
    const minimo = Math.min.apply(null, valores);
    const maximo = Math.max.apply(null, valores);
    const rango = Math.max(0.5, maximo - minimo);
    const ancho = 100;
    const alto = 18;
    const margen = 2;
    const puntos = valores.map((valor, indice) => {
      const x = margen + indice * (ancho - margen * 2) / (valores.length - 1);
      const y = alto - margen - ((valor - minimo) / rango) * (alto - margen * 2);
      return [x, y];
    });
    const linea = puntos.map((punto, indice) => (indice ? 'L' : 'M') + punto[0].toFixed(1) + ' ' + punto[1].toFixed(1)).join(' ');
    const area = linea + ' L ' + puntos[puntos.length - 1][0].toFixed(1) + ' ' + (alto - margen) +
      ' L ' + puntos[0][0].toFixed(1) + ' ' + (alto - margen) + ' Z';
    return '<svg class="tarjeta-spark" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="area" d="' + area + '"></path>' +
      '<path class="linea" d="' + linea + '"></path></svg>';
  }

  function tarjetaHTML(equipo) {
    const estado = FLOTA.estadoEquipo(equipo);
    const lectura = FLOTA.lectura(equipo.id);
    const principal = estado.alertaPrincipal;
    const temperatura = lectura ? numero(lectura.tempEspacio, 1) : '—';
    let mensaje = 'Sin novedades';

    if (estado.nivel === 'sin_datos') {
      const edad = lectura ? Date.now() - lectura.ts : null;
      mensaje = lectura ? 'Sin señal ' + FLOTA.tiempoRelativo(edad) : 'Sin lectura';
    } else if (principal) {
      mensaje = principal.titulo;
      if (estado.reconocida) mensaje += ' · en revisión';
    }

    const etiqueta = estado.etiqueta + (estado.reconocida ? ' · revisada' : '');
    return '<button type="button" class="tarjeta tarjeta--' + estado.nivel + '" data-id="' + escapar(equipo.id) + '" ' +
      'aria-label="' + escapar(equipo.nombre + ', ' + estado.etiqueta + ', ' + mensaje) + '">' +
      '<span class="tarjeta-top">' +
        '<span class="tarjeta-nombre">' + escapar(equipo.nombre) + '</span>' +
        '<span class="estado-punto" aria-hidden="true"></span>' +
      '</span>' +
      '<span class="tarjeta-meta">' +
        '<span class="badge badge-tipo">' + escapar(etiquetaTipo(equipo.tipo)) + '</span>' +
        '<span class="badge">' + escapar(equipo.refrigerante) + '</span>' +
        '<span class="badge">' + escapar(equipo.ubicacion) + '</span>' +
      '</span>' +
      '<span class="tarjeta-temp"><strong>' + temperatura + '</strong><span class="unidad">°C</span>' +
        '<span class="objetivo">Objetivo ' + numero(equipo.objetivo, 0) + '°</span></span>' +
      '<span class="tarjeta-pie"><span class="tarjeta-estado">' + escapar(etiqueta) + '</span>' +
        '<span class="tarjeta-mensaje">' + escapar(mensaje) + '</span></span>' +
      sparkline(equipo.id) +
    '</button>';
  }

  function renderGrid() {
    const enfocado = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.tarjeta') : null;
    const idEnfocado = enfocado ? enfocado.dataset.id : null;
    const equipos = equiposFiltrados();

    ids.grid.innerHTML = equipos.map(tarjetaHTML).join('');
    ids.vacio.hidden = equipos.length > 0;

    if (idEnfocado) {
      const nueva = ids.grid.querySelector('[data-id="' + idEnfocado + '"]');
      if (nueva) nueva.focus({ preventScroll: true });
    }
  }

  /* ------------------------------ SIMULACIÓN ------------------------------- */

  function actualizarSimulacion() {
    const activa = FLOTA.simulacionActiva();
    ids.simulacion.classList.toggle('pausada', !activa);
    ids.textoSim.textContent = activa ? 'Simulación activa' : 'Simulación en pausa';
    ids.btnPausa.textContent = activa ? 'Pausar' : 'Reanudar';
  }

  /* ------------------------------- RENDER ---------------------------------- */

  function actualizarTodo() {
    actualizarResumen(false);
    renderGrid();
    actualizarSimulacion();
    actualizarDrawer();
    if (!ids.modalRegistro.hidden) renderRegistro();
  }

  function renderTodo() {
    actualizarResumen(true);
    renderGrid();
    actualizarSimulacion();
    if (ui.equipoAbierto) abrirDrawer(ui.equipoAbierto, true);
    if (!ids.modalRegistro.hidden) renderRegistro();
  }

  /* -------------------------------- DRAWER --------------------------------- */

  function alertaHTML(alerta) {
    const clase = alerta.tipo === 'sin_datos' ? 'sin_datos' : alerta.gravedad;
    const etiqueta = alerta.tipo === 'sin_datos' ? 'Sin datos' : FLOTA.etiquetaGravedad(alerta.gravedad);
    const estado = FLOTA.etiquetaEstadoAlerta(alerta.estado);
    const boton = alerta.estado === 'activa'
      ? '<button type="button" class="btn-enlace" data-accion="reconocer" data-alerta-id="' + escapar(alerta.id) + '">Reconocer</button>'
      : '';

    return '<div class="alerta-item alerta-item--' + clase + '">' +
      '<div class="alerta-cabecera">' +
        '<span class="chip chip--' + clase + '">' + escapar(etiqueta) + '</span>' +
        '<strong>' + escapar(alerta.titulo) + '</strong>' +
        '<time>' + escapar(FLOTA.fechaHora(alerta.inicio)) + '</time>' +
      '</div>' +
      '<p>' + escapar(alerta.detalle) + '</p>' +
      '<p class="sugerencia"><b>Sugerencia:</b> ' + escapar(alerta.sugerencia) + '</p>' +
      '<div class="alerta-pie"><span>' + escapar(estado) + '</span>' + boton + '</div>' +
    '</div>';
  }

  function historialHTML(alertas) {
    if (!alertas.length) return '<p class="sin-datos-texto">Sin fallas registradas para este equipo.</p>';
    const visibles = alertas.slice(0, 12);
    const items = visibles.map((alerta) => {
      const estado = alerta.estado;
      const etiqueta = FLOTA.etiquetaEstadoAlerta(estado);
      const fin = alerta.fin ? ' → ' + FLOTA.fechaHora(alerta.fin) : ' · en curso';
      const duracion = alerta.fin ? ' · ' + FLOTA.duracionTexto(alerta.fin - alerta.inicio) : '';
      const reapariciones = alerta.reapariciones ? '<span class="reapariciones">×' + alerta.reapariciones + '</span>' : '';
      return '<div class="historial-item">' +
        '<span class="chip chip--' + estado + '">' + escapar(etiqueta) + '</span>' +
        '<div><strong>' + escapar(alerta.titulo) + '</strong>' +
          '<small>' + escapar(FLOTA.fechaHora(alerta.inicio) + fin + duracion) + '</small></div>' +
        reapariciones +
      '</div>';
    }).join('');

    const extra = alertas.length > visibles.length
      ? '<button type="button" class="btn-enlace" data-accion="abrir-registro">Ver las ' + alertas.length + ' fallas en el registro completo</button>'
      : '';
    return items + extra;
  }

  function procesoHTML(proceso, sensorEspacio) {
    if (!proceso) return '<p class="sin-datos-texto">Sin lectura de proceso.</p>';

    const sondas = ['temp1', 'temp2', 'temp3', 'temp4', 'temp5', 'presion_baja', 'presion_alta'];
    const celdas = sondas.map((clave) => {
      const sonda = CFG.sondas[clave];
      let nombre = sonda.nombre;
      if (clave === sensorEspacio && clave !== 'temp2') nombre = 'T. espacio (' + sonda.nombre + ')';
      return '<div class="proceso-item"><span>' + escapar(nombre) + '</span>' +
        '<strong>' + numero(proceso[clave], sonda.decimales) + ' <small>' + sonda.unidad + '</small></strong></div>';
    }).join('');

    const sh = proceso.recalentamiento;
    const sc = proceso.subenfriamiento;
    const rc = proceso.relacion;
    const shClase = sh < CFG.limites.recalentamiento.min || sh > CFG.limites.recalentamiento.max ? 'aviso' : 'ok';
    const scClase = sc < CFG.limites.subenfriamiento.min || sc > CFG.limites.subenfriamiento.max ? 'aviso' : 'ok';
    const rcClase = rc > CFG.limites.relacionCompresion.alarma ? 'alarma' : rc > CFG.limites.relacionCompresion.aviso ? 'aviso' : 'ok';
    const pmBaja = Number.isFinite(proceso.presionEsperada) &&
      proceso.presionMinima <= proceso.presionEsperada - CFG.limites.ciclajePresion.presionBajaPsi;
    const pmClase = pmBaja ? 'alarma' : 'ok';
    const ciclos = proceso.ciclaje ? proceso.ciclaje.total : 0;
    const ciclosAlarma = ciclos >= CFG.limites.ciclajePresion.minimoCiclos &&
      proceso.ciclaje && proceso.ciclaje.reciente;
    const ciclosClase = ciclosAlarma ? 'alarma' : 'ok';

    const derivados =
      '<div class="derivado ' + shClase + '"><span>Recalentamiento</span><strong>' + numero(sh, 1) + ' K</strong></div>' +
      '<div class="derivado ' + scClase + '"><span>Subenfriamiento</span><strong>' + numero(sc, 1) + ' K</strong></div>' +
      '<div class="derivado ' + rcClase + '"><span>Relación de compresión</span><strong>' + numero(rc, 1) + ' : 1</strong></div>' +
      '<div class="derivado ' + pmClase + '"><span>P. succión mínima</span><strong>' + numero(proceso.presionMinima, 0) + ' PSI</strong></div>' +
      '<div class="derivado ' + ciclosClase + '"><span>Ciclos de succión</span><strong>' + ciclos + (ciclos === 1 ? ' ciclo' : ' ciclos') + '</strong></div>';
    const notaCiclaje = ciclosAlarma
      ? '<p class="nota-ciclaje">Ciclaje detectado: recalentamiento y relación de compresión se calculan con la P. succión mínima (' +
        numero(proceso.presionBase, 0) + ' PSI).</p>'
      : '';

    return '<div class="proceso-grid">' + celdas + '</div><div class="derivados">' + derivados + '</div>' + notaCiclaje;
  }

  function opcionesFalla(seleccionada) {
    return Object.keys(CFG.fallas).map((clave) => {
      const activa = seleccionada === clave ? ' selected' : '';
      return '<option value="' + clave + '"' + activa + '>' + escapar(CFG.fallas[clave].nombre) + '</option>';
    }).join('');
  }

  function renderDrawer(equipoId) {
    const equipo = FLOTA.equipo(equipoId);
    if (!equipo) return;

    const estado = FLOTA.estadoEquipo(equipo);
    const lectura = FLOTA.lectura(equipo.id);
    const proceso = FLOTA.proceso(equipo);
    const activas = FLOTA.alertasActivasDe(equipo.id);
    const historial = FLOTA.alertasDe(equipo.id);
    const limites = limitesEspacio(equipo);
    const tipo = CFG.tipos[equipo.tipo] || CFG.tipos.MBP;
    const temperatura = lectura ? numero(lectura.tempEspacio, 1) : '—';
    const sensor = CFG.sondas[equipo.sensorEspacio] || CFG.sondas.temp2;
    const mensaje = estado.alertaPrincipal
      ? estado.alertaPrincipal.titulo + (estado.reconocida ? ' · en revisión' : '')
      : 'Todo dentro de los límites configurados.';

       const cabecera =
      '<div class="drawer-cabecera">' +
        '<div><p class="eyebrow">' + escapar(etiquetaTipo(equipo.tipo)) + ' · ' + escapar(equipo.refrigerante) + '</p>' +
          '<h2 id="drawerTitulo">' + escapar(equipo.nombre) + '</h2>' +
          '<p>' + escapar(equipo.ubicacion) + ' · ' + escapar(equipo.expansion) + ' · ' + escapar(equipo.compresor) + '</p>' +
        '</div>' +
        '<div style="display: flex; gap: 6px; align-items: center;">' +
          '<button type="button" class="icono-cerrar btn-peligro-header" data-accion="eliminar-equipo" aria-label="Eliminar cuadro" title="Eliminar cuadro">🗑️</button>' +
          '<button type="button" class="icono-cerrar" data-cerrar-drawer aria-label="Cerrar detalle">×</button>' +
        '</div>' +
      '</div>';

    const principal =
      '<div class="detalle-principal detalle-principal--' + estado.nivel + '">' +
        '<div class="detalle-temp"><strong>' + temperatura + '</strong><span>°C</span></div>' +
        '<div class="detalle-rango">Objetivo ' + numero(limites.objetivo, 1) + ' °C · Rango normal ' +
          numero(limites.avisoBajo, 1) + '…' + numero(limites.avisoAlto, 1) + ' °C</div>' +
        '<div class="detalle-estado"><span class="chip chip--' + estado.nivel + '">' + escapar(estado.etiqueta) + '</span>' +
          '<p>' + escapar(mensaje) + '</p></div>' +
        '<div class="detalle-rango" style="margin-top:6px">' + (lectura ? 'Última lectura ' + escapar(FLOTA.tiempoRelativo(Date.now() - lectura.ts)) : 'Sin lectura') + '</div>' +
      '</div>';

    const alertasHTML = activas.length
      ? '<div class="lista-alertas">' + activas.map(alertaHTML).join('') + '</div>'
      : '<div class="sin-alertas">Sin alarmas activas. El equipo está dentro de los límites configurados.</div>';

    const seccionAlertas =
      '<section><h3 class="seccion-titulo">Diagnóstico <span>' + activas.length + ' activa' + (activas.length === 1 ? '' : 's') + '</span></h3>' +
      alertasHTML + '</section>';

    const seccionProceso =
      '<details class="proceso" id="procesoDetalle">' +
        '<summary>Variables de proceso <span class="solo-tecnico">Para técnico</span></summary>' +
        procesoHTML(proceso, equipo.sensorEspacio) +
      '</details>';

    const ficha =
      '<section class="ficha"><h3 class="seccion-titulo">Ficha del equipo</h3><dl>' +
        '<dt>Refrigerante</dt><dd>' + escapar(equipo.refrigerante) + '</dd>' +
        '<dt>Tipo</dt><dd>' + escapar(tipo.corto + ' · ' + tipo.nombre) + '</dd>' +
        '<dt>Expansión</dt><dd>' + escapar(equipo.expansion) + '</dd>' +
        '<dt>Compresor</dt><dd>' + escapar(equipo.compresor) + '</dd>' +
        '<dt>Lubricante</dt><dd>' + escapar(equipo.aceite) + '</dd>' +
        '<dt>Sensor de espacio</dt><dd>' + escapar(sensor.nombre) + '</dd>' +
        '<dt>Instalado</dt><dd>' + escapar(FLOTA.fechaHora(equipo.creado)) + '</dd>' +
        '<dt>Falla simulada</dt><dd>' + escapar(equipo.falla ? CFG.fallas[equipo.falla].nombre : 'Ninguna') + '</dd>' +
      '</dl></section>';

    const historialSeccion =
      '<section><h3 class="seccion-titulo">Historial de fallas <span>' + historial.length + ' episodio' + (historial.length === 1 ? '' : 's') + '</span></h3>' +
      '<div class="historial-equipo">' + historialHTML(historial) + '</div></section>';

    const simulacion =
      '<section class="simulacion-equipo">' +
        '<h3 class="seccion-titulo">Modo simulación</h3>' +
        '<p>Provoca una falla para ver cómo cambia el estado y cómo queda guardado el registro.</p>' +
        '<div class="sim-fila">' +
          '<select id="selectFalla" aria-label="Falla a simular">' +
            '<option value="">Sin falla</option>' + opcionesFalla(equipo.falla) +
          '</select>' +
          '<button type="button" class="btn-mini" data-accion="aplicar-falla">Aplicar</button>' +
          '<button type="button" class="btn-mini" data-accion="corregir-falla">Corregir</button>' +
        '</div>' +
      '</section>';

       ids.drawerContenido.innerHTML = cabecera +
      '<div class="drawer-cuerpo">' + principal + seccionAlertas + seccionProceso + ficha + historialSeccion + simulacion + '</div>';
  }

  function abrirDrawer(equipoId, silencioso) {
    const equipo = FLOTA.equipo(equipoId);
    if (!equipo) return;

    if (!silencioso) {
      const enfocado = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.tarjeta') : null;
      ui.ultimoFoco = enfocado ? enfocado.dataset.id : null;
      cerrarModales();
      ids.drawer.classList.add('abierto');
      ids.drawer.setAttribute('aria-hidden', 'false');
      ids.drawer.setAttribute('tabindex', '-1');
      ids.overlay.hidden = false;
      ids.drawer.focus({ preventScroll: true });
    }

    ui.equipoAbierto = equipoId;
    renderDrawer(equipoId);
  }

  function cerrarDrawer() {
    ids.drawer.classList.remove('abierto');
    ids.drawer.setAttribute('aria-hidden', 'true');
    ids.overlay.hidden = true;
    ui.equipoAbierto = null;
    if (ui.ultimoFoco) {
      const tarjeta = ids.grid.querySelector('[data-id="' + ui.ultimoFoco + '"]');
      if (tarjeta) tarjeta.focus({ preventScroll: true });
      ui.ultimoFoco = null;
    }
  }

  function actualizarDrawer() {
    if (!ui.equipoAbierto) return;
    const activo = document.activeElement;
    if (activo && ids.drawer.contains(activo) && ['SELECT', 'INPUT', 'TEXTAREA'].indexOf(activo.tagName) >= 0) return;

    const scroll = ids.drawer.scrollTop;
    const detalle = ids.drawer.querySelector('#procesoDetalle');
    const abierto = detalle ? detalle.open : false;
    renderDrawer(ui.equipoAbierto);
    ids.drawer.scrollTop = scroll;
    const nuevoDetalle = ids.drawer.querySelector('#procesoDetalle');
    if (nuevoDetalle) nuevoDetalle.open = abierto;
  }

  /* -------------------------------- MODALES -------------------------------- */

  function poblarSelects() {
    ids.refrigerante.innerHTML = Object.keys(CFG.refrigerantes).map((clave) =>
      '<option value="' + clave + '">' + clave + '</option>'
    ).join('');
    ids.expansion.innerHTML = CFG.expansiones.map((valor) =>
      '<option value="' + escapar(valor) + '">' + escapar(valor) + '</option>'
    ).join('');
    ids.aceite.innerHTML = CFG.aceites.map((valor) =>
      '<option value="' + valor + '">' + valor + '</option>'
    ).join('');
    ids.compresor.innerHTML = CFG.compresores.map((valor) =>
      '<option value="' + escapar(valor) + '">' + escapar(valor) + '</option>'
    ).join('');
  }

  function renderTiposCrear() {
    ids.tiposCrear.innerHTML = Object.keys(CFG.tipos).map((clave, indice) => {
      const tipo = CFG.tipos[clave];
      return '<label class="tipo-opcion">' +
        '<input type="radio" name="tipo" value="' + clave + '"' + (indice === 0 ? ' checked' : '') + '>' +
        '<span><b>' + clave + '</b><small>' + escapar(tipo.nombre) + '</small><small>' + escapar(tipo.descripcion) + '</small></span>' +
      '</label>';
    }).join('');
  }

  function tipoSeleccionado() {
    const marcado = ids.formCrear.querySelector('input[name="tipo"]:checked');
    return marcado ? marcado.value : 'LBP';
  }

  function actualizarAyudaObjetivo() {
    const tipo = CFG.tipos[tipoSeleccionado()] || CFG.tipos.LBP;
    const valor = Number(ids.objetivo.value);
    if (!Number.isFinite(valor)) {
      ids.ayudaObjetivo.textContent = 'Escribe una temperatura objetivo válida.';
      return;
    }
    const bajo = valor - tipo.margenes.avisoBajo;
    const alto = valor + tipo.margenes.avisoAlto;
    ids.ayudaObjetivo.textContent = 'Rango normal: ' + numero(bajo, 1) + ' a ' + numero(alto, 1) + ' °C.';
  }

  function abrirModalCrear() {
    cerrarDrawer();
    cerrarModales();
    ids.formCrear.reset();
    ids.refrigerante.value = 'R-404A';
    ids.expansion.value = 'Termostática';
    ids.aceite.value = 'POE';
    ids.compresor.value = 'Hermético';
    ids.objetivo.value = '-18';
    const primero = ids.tiposCrear.querySelector('input[name="tipo"]');
    if (primero) primero.checked = true;
    actualizarAyudaObjetivo();
    ids.modalCrear.hidden = false;
    setTimeout(() => ids.nombre.focus(), 40);
  }

  function cerrarModal(idModal) {
    const modal = $(idModal);
    if (modal) modal.hidden = true;
  }

  function cerrarModales() {
    ids.modalCrear.hidden = true;
    ids.modalRegistro.hidden = true;
  }

  function crearDesdeFormulario(evento) {
    evento.preventDefault();
    const nombre = ids.nombre.value.trim();
    const objetivo = Number(ids.objetivo.value);

    if (!nombre) {
      toast('Escribe un nombre para el cuadro.', true);
      ids.nombre.focus();
      return;
    }
    if (!Number.isFinite(objetivo)) {
      toast('La temperatura objetivo no es válida.', true);
      ids.objetivo.focus();
      return;
    }

    const equipo = FLOTA.crearEquipo({
      nombre: nombre,
      ubicacion: ids.ubicacion.value.trim(),
      refrigerante: ids.refrigerante.value,
      expansion: ids.expansion.value,
      tipo: tipoSeleccionado(),
      objetivo: objetivo,
      aceite: ids.aceite.value,
      compresor: ids.compresor.value,
      sensorEspacio: $('sensorEquipo').value
    });

    cerrarModal('modalCrear');
    ui.filtro = 'todos';
    ui.busqueda = '';
    ids.buscar.value = '';
    ui.firmaResumen = '';
    renderTodo();
    abrirDrawer(equipo.id);
    toast('Cuadro creado: ' + equipo.nombre);
  }

  /* -------------------------------- REGISTRO ------------------------------- */

  function poblarFiltroEquipos() {
    const equipos = FLOTA.equipos().slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const valorActual = ids.filtroEquipo.value || 'todos';
    ids.filtroEquipo.innerHTML = '<option value="todos">Todos</option>' + equipos.map((equipo) =>
      '<option value="' + escapar(equipo.id) + '">' + escapar(equipo.nombre) + '</option>'
    ).join('');
    ids.filtroEquipo.value = equipos.some((equipo) => equipo.id === valorActual) ? valorActual : 'todos';
  }

  function abrirRegistro() {
    cerrarDrawer();
    cerrarModales();
    poblarFiltroEquipos();
    ids.filtroEstado.value = ui.logEstado;
    ids.filtroEquipo.value = ui.logEquipo;
    ids.modalRegistro.hidden = false;
    renderRegistro();
  }

  function renderRegistro() {
    if (ids.modalRegistro.hidden) return;
    const filtroEstado = ids.filtroEstado.value;
    const filtroEquipo = ids.filtroEquipo.value;
    let alertas = FLOTA.alertas().slice();

    if (filtroEstado !== 'todas') {
      alertas = alertas.filter((alerta) => alerta.estado === filtroEstado);
    }
    if (filtroEquipo !== 'todos') {
      alertas = alertas.filter((alerta) => alerta.equipoId === filtroEquipo);
    }

    alertas.sort((a, b) => (b.inicio || 0) - (a.inicio || 0));

    if (!alertas.length) {
      ids.registroCuerpo.innerHTML = '<tr><td colspan="7" class="sin-registros">No hay fallas con este filtro.</td></tr>';
      return;
    }

    ids.registroCuerpo.innerHTML = alertas.map((alerta) => {
      const equipo = FLOTA.equipo(alerta.equipoId);
      const fin = alerta.fin ? FLOTA.fechaHora(alerta.fin) : '—';
      const duracion = alerta.fin ? FLOTA.duracionTexto(alerta.fin - alerta.inicio) : 'En curso';
      const reapariciones = alerta.reapariciones ? '× ' + alerta.reapariciones : '—';
      return '<tr>' +
        '<td>' + escapar(FLOTA.fechaHora(alerta.inicio)) + '</td>' +
        '<td>' + escapar(equipo ? equipo.nombre : alerta.equipoId) + '</td>' +
        '<td>' + escapar(alerta.titulo) + '</td>' +
        '<td><span class="chip chip--' + alerta.estado + '">' + escapar(FLOTA.etiquetaEstadoAlerta(alerta.estado)) + '</span></td>' +
        '<td>' + escapar(fin) + '</td>' +
        '<td>' + escapar(duracion) + '</td>' +
        '<td>' + escapar(reapariciones) + '</td>' +
      '</tr>';
    }).join('');
  }

  function descargarCSV() {
    const csv = FLOTA.exportarCSV();
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'registro-fallas-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Registro exportado.');
  }

  /* --------------------------------- EVENTOS -------------------------------- */

  function manejarAccionDrawer(evento) {
    if (evento.target.closest('[data-cerrar-drawer]')) {
      cerrarDrawer();
      return;
    }

    const boton = evento.target.closest('[data-accion]');
    if (!boton || !ui.equipoAbierto) return;
    const accion = boton.dataset.accion;

    if (accion === 'reconocer') {
      FLOTA.reconocerAlerta(boton.dataset.alertaId);
      actualizarTodo();
      toast('Alerta reconocida. Sigue visible hasta que se corrija.');
      return;
    }

    if (accion === 'aplicar-falla') {
      const selector = ids.drawer.querySelector('#selectFalla');
      const tipo = selector ? selector.value : '';
      FLOTA.aplicarFalla(ui.equipoAbierto, tipo || null);
      actualizarTodo();
      toast(tipo ? 'Falla simulada: ' + CFG.fallas[tipo].nombre : 'Falla retirada.');
      return;
    }

    if (accion === 'corregir-falla') {
      FLOTA.aplicarFalla(ui.equipoAbierto, null);
      actualizarTodo();
      toast('Falla corregida. El registro conserva el episodio.');
      return;
    }

    if (accion === 'eliminar-equipo') {
      const id = ui.equipoAbierto;
      const equipo = FLOTA.equipo(id);
      if (!equipo) return;
      const confirmado = confirm('¿Eliminar el cuadro “' + equipo.nombre + '”?\n\nSe borrarán sus lecturas y su historial de alertas. Esta acción no se puede deshacer.');
      if (!confirmado) return;
      const eliminado = FLOTA.eliminarEquipo(id);
      if (!eliminado) {
        toast('No se pudo eliminar el cuadro.', true);
        return;
      }
      cerrarDrawer();
      actualizarTodo();
      toast('Cuadro eliminado de la flota.');
      return;
    }

    if (accion === 'abrir-registro') {
      abrirRegistro();
    }
  }

  function conectarEventos() {
    ids.grid.addEventListener('click', (evento) => {
      const tarjeta = evento.target.closest('.tarjeta');
      if (!tarjeta) return;
      abrirDrawer(tarjeta.dataset.id);
    });

    ids.chips.addEventListener('click', (evento) => {
      const chip = evento.target.closest('[data-filtro]');
      if (!chip) return;
      ui.filtro = chip.dataset.filtro;
      ui.firmaResumen = '';
      actualizarResumen(true);
      renderGrid();
    });

    ids.buscar.addEventListener('input', (evento) => {
      ui.busqueda = evento.target.value;
      renderGrid();
    });

    ids.drawer.addEventListener('click', manejarAccionDrawer);
    ids.overlay.addEventListener('click', cerrarDrawer);

    document.addEventListener('click', (evento) => {
      const cerrar = evento.target.closest('[data-cerrar-modal]');
      if (cerrar) cerrarModal(cerrar.dataset.cerrarModal);
    });

    [ids.modalCrear, ids.modalRegistro].forEach((modal) => {
      modal.addEventListener('click', (evento) => {
        if (evento.target === modal) cerrarModal(modal.id);
      });
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Escape') return;
      if (!ids.modalCrear.hidden) {
        cerrarModal('modalCrear');
      } else if (!ids.modalRegistro.hidden) {
        cerrarModal('modalRegistro');
      } else if (ui.equipoAbierto) {
        cerrarDrawer();
      }
    });

    ids.formCrear.addEventListener('submit', crearDesdeFormulario);
    ids.tiposCrear.addEventListener('change', () => {
      const tipo = CFG.tipos[tipoSeleccionado()];
      if (tipo) ids.objetivo.value = tipo.objetivo;
      actualizarAyudaObjetivo();
    });
    ids.refrigerante.addEventListener('change', () => {
      const catalogo = CFG.refrigerantes[ids.refrigerante.value];
      if (catalogo && catalogo.aceite) ids.aceite.value = catalogo.aceite;
    });
    ids.objetivo.addEventListener('input', actualizarAyudaObjetivo);

    $('btnCrear').addEventListener('click', abrirModalCrear);
    $('btnRegistro').addEventListener('click', abrirRegistro);
    $('btnExportar').addEventListener('click', descargarCSV);

    $('btnPausa').addEventListener('click', () => {
      const activa = FLOTA.simulacionActiva();
      FLOTA.pausar(!activa);
      actualizarSimulacion();
      toast(activa ? 'Simulación en pausa.' : 'Simulación reanudada.');
    });

    $('btnFalla').addEventListener('click', () => {
      const resultado = FLOTA.provocarFallaAleatoria();
      if (!resultado) {
        toast('No hay equipos disponibles para simular.', true);
        return;
      }
      ui.filtro = 'todos';
      ui.busqueda = '';
      ids.buscar.value = '';
      ui.firmaResumen = '';
      actualizarTodo();
      abrirDrawer(resultado.equipo.id);
      toast('Falla simulada: ' + resultado.equipo.nombre + ' · ' + CFG.fallas[resultado.tipo].nombre);
    });

    $('btnReiniciar').addEventListener('click', () => {
      if (!confirm('¿Reiniciar la simulación con los 20 equipos de ejemplo? Se borrarán los cuadros y fallas creados.')) return;
      FLOTA.reiniciar();
      ui.filtro = 'todos';
      ui.busqueda = '';
      ui.firmaResumen = '';
      ids.buscar.value = '';
      cerrarDrawer();
      cerrarModales();
      renderTodo();
      toast('Simulación reiniciada con 20 equipos.');
    });

    ids.filtroEstado.addEventListener('change', () => {
      ui.logEstado = ids.filtroEstado.value;
      renderRegistro();
    });
    ids.filtroEquipo.addEventListener('change', () => {
      ui.logEquipo = ids.filtroEquipo.value;
      renderRegistro();
    });
  }

  /* --------------------------------- ARRANQUE -------------------------------- */

  function iniciar() {
    FLOTA.init();
    poblarSelects();
    renderTiposCrear();
    actualizarReloj();
    renderTodo();
    conectarEventos();

    const equipoHash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (equipoHash && FLOTA.equipo(equipoHash)) {
      setTimeout(() => abrirDrawer(equipoHash), 60);
    }

    const parametros = new URLSearchParams(location.search);
    if (parametros.get('crear') === '1') setTimeout(abrirModalCrear, 80);
    if (parametros.get('registro') === '1') setTimeout(abrirRegistro, 80);

    setInterval(actualizarReloj, 1000);
    setInterval(() => {
      FLOTA.tick();
      actualizarTodo();
    }, CFG.simulacion.tickMs);
  }

  iniciar();

})();
