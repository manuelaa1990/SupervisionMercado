/* ============================================================================
   FLOTA · SIMULACIÓN, DIAGNÓSTICO Y REGISTRO LOCAL
   ========================================================================== */

(function () {
  'use strict';

  const CFG = window.CONFIG_FLOTA;
  const LS_EQUIPOS = 'hiper_flota_equipos_v1';
  const LS_ALERTAS = 'hiper_flota_alertas_v1';

  const estado = {
    equipos: [],
    alertas: [],
    lecturas: {},
    seguimiento: {},
    simulacionActiva: !CFG.simulacion.pausaInicial,
    listo: false,
    ultimaPersistencia: 0
  };

  let secuencia = 1;

  /* ------------------------------- UTILIDADES ------------------------------ */

  function uid(prefijo) {
    return prefijo + '-' + Date.now().toString(36) + '-' + (secuencia++).toString(36);
  }

  function ahora() {
    return Date.now();
  }

  function clamp(valor, minimo, maximo) {
    return Math.min(maximo, Math.max(minimo, valor));
  }

  function redondear(valor, decimales) {
    const factor = Math.pow(10, decimales || 0);
    return Math.round(valor * factor) / factor;
  }

  function numero(valor, decimales) {
    if (!Number.isFinite(valor)) return '—';
    return valor.toFixed(decimales == null ? 1 : decimales);
  }

  function escapar(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function leerJSON(clave) {
    try {
      const crudo = localStorage.getItem(clave);
      if (!crudo) return null;
      const valor = JSON.parse(crudo);
      return Array.isArray(valor) ? valor : null;
    } catch (error) {
      return null;
    }
  }

  function guardarJSON(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch (error) {
      /* localStorage puede estar lleno o deshabilitado: la simulación sigue. */
    }
  }

  function guardarEquipos() {
    guardarJSON(LS_EQUIPOS, estado.equipos);
  }

  function guardarAlertas(forzar) {
    const t = ahora();
    if (!forzar && t - estado.ultimaPersistencia < 10000) return;
    estado.ultimaPersistencia = t;
    guardarJSON(LS_ALERTAS, estado.alertas);
  }

  /* --------------------------------- SEMILLA ------------------------------- */

  function equiposDemo() {
    const creado = ahora();
    const base = [
      ['Congelados · Isla 1', 'Pasillo 1', 'LBP', 'R-404A', 'Termostática', -18, null],
      ['Congelados · Isla 2', 'Pasillo 1', 'LBP', 'R-448A', 'Electrónica', -18, null],
      ['Helados · Mural 1', 'Pasillo 1', 'LBP', 'R-404A', 'Termostática', -20, 'espacio_alto'],
      ['Pescadería', 'Pasillo 2', 'MBP', 'R-448A', 'Electrónica', 0, null],
      ['Carnicería · Vitrina 1', 'Pasillo 2', 'MBP', 'R-449A', 'Termostática', 2, null],
      ['Carnicería · Vitrina 2', 'Pasillo 2', 'MBP', 'R-449A', 'Electrónica', 2, null],
      ['Lácteos · Mural 1', 'Pasillo 3', 'MBP', 'R-134a', 'Termostática', 3, 'descarga_alta'],
      ['Lácteos · Mural 2', 'Pasillo 3', 'MBP', 'R-134a', 'Electrónica', 3, null],
      ['Frutería · Isla 1', 'Pasillo 4', 'HBP', 'R-134a', 'Termostática', 10, null],
      ['Frutería · Isla 2', 'Pasillo 4', 'HBP', 'R-134a', 'Electrónica', 10, null],
      ['Verduras · Mural', 'Pasillo 4', 'HBP', 'R-448A', 'Termostática', 9, null],
      ['Charcutería', 'Pasillo 2', 'MBP', 'R-449A', 'Electrónica', 2, 'ambiente_sube'],
      ['Panadería · Vitrina', 'Pasillo 5', 'HBP', 'R-134a', 'Capilar', 12, null],
      ['Bebidas · Mural', 'Pasillo 5', 'HBP', 'R-134a', 'Termostática', 9, null],
      ['Delicatessen', 'Pasillo 2', 'MBP', 'R-449A', 'Electrónica', 3, 'recalentamiento_bajo'],
      ['Sushi · Vitrina', 'Pasillo 2', 'MBP', 'R-448A', 'Termostática', 1, null],
      ['Flores · Vitrina', 'Entrada', 'HBP', 'R-134a', 'Electrónica', 12, null],
      ['Cárnicos · Cámara 1', 'Sala de cámaras', 'LBP', 'R-404A', 'Termostática', -18, 'sin_datos'],
      ['Cárnicos · Cámara 2', 'Sala de cámaras', 'LBP', 'R-448A', 'Electrónica', -18, null],
      ['Postres · Vitrina', 'Pasillo 3', 'MBP', 'R-134a', 'Termostática', 3, 'ciclaje_presion_baja']
    ];

    return base.map((fila, indice) => {
      const refrigerante = fila[3];
      const catalogo = CFG.refrigerantes[refrigerante] || {};
      return {
        id: 'eq-' + String(indice + 1).padStart(2, '0'),
        nombre: fila[0],
        ubicacion: fila[1],
        tipo: fila[2],
        refrigerante: refrigerante,
        expansion: fila[4],
        objetivo: fila[5],
        compresor: fila[2] === 'LBP' ? 'Semihermético' : 'Hermético',
        aceite: catalogo.aceite || 'POE',
        sensorEspacio: 'temp2',
        creado: creado - (20 - indice) * 86400000,
        falla: fila[6]
      };
    });
  }

  function alertaHistorica(equipo, tipo, inicio, fin, reapariciones) {
    const definicion = CFG.fallas[tipo];
    if (!definicion) return null;
    return {
      id: uid('al'),
      equipoId: equipo.id,
      tipo: tipo,
      gravedad: definicion.gravedad,
      titulo: definicion.titulo,
      detalle: definicion.detalle,
      sugerencia: definicion.sugerencia,
      estado: 'corregida',
      inicio: inicio,
      inicioOriginal: inicio,
      fin: fin,
      ultimaVez: fin,
      reapariciones: reapariciones || 0,
      valores: {}
    };
  }

  function alertasHistoricas(equipos) {
    const porId = {};
    equipos.forEach((equipo) => { porId[equipo.id] = equipo; });
    const t = ahora();
    const lista = [];
    const agregar = (id, tipo, haceInicioMin, duracionMin, reapariciones) => {
      const equipo = porId[id];
      if (!equipo) return;
      const inicio = t - haceInicioMin * 60000;
      const alerta = alertaHistorica(equipo, tipo, inicio, inicio + duracionMin * 60000, reapariciones);
      if (alerta) lista.push(alerta);
    };

    agregar('eq-02', 'ambiente_sube', 5 * 60, 22, 1);
    agregar('eq-05', 'espacio_alto', 2 * 60, 18, 0);
    agregar('eq-09', 'descarga_alta', 26 * 60, 35, 2);
    agregar('eq-14', 'recalentamiento_bajo', 3 * 24 * 60, 46, 0);
    agregar('eq-19', 'espacio_sube', 9 * 60, 14, 1);

    return lista;
  }

  /* --------------------------- PROPIEDADES P-T ----------------------------- */

  function tablaPT(refrigerante) {
    const datos = CFG.refrigerantes[refrigerante];
    return datos && datos.pt ? datos.pt : CFG.refrigerantes['R-404A'].pt;
  }

  function presionSaturacion(refrigerante, temperatura) {
    const tabla = tablaPT(refrigerante);
    const t = clamp(temperatura, tabla[0][0], tabla[tabla.length - 1][0]);
    for (let i = 0; i < tabla.length - 1; i++) {
      const a = tabla[i];
      const b = tabla[i + 1];
      if (t >= a[0] && t <= b[0]) {
        const proporcion = (t - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * proporcion;
      }
    }
    return tabla[tabla.length - 1][1];
  }

  function tempSaturacion(refrigerante, presion) {
    const tabla = tablaPT(refrigerante);
    const p = clamp(presion, tabla[0][1], tabla[tabla.length - 1][1]);
    for (let i = 0; i < tabla.length - 1; i++) {
      const a = tabla[i];
      const b = tabla[i + 1];
      if (p >= a[1] && p <= b[1]) {
        const proporcion = (p - a[1]) / (b[1] - a[1]);
        return a[0] + (b[0] - a[0]) * proporcion;
      }
    }
    return tabla[tabla.length - 1][0];
  }

  function faseDe(id) {
    let suma = 0;
    for (let i = 0; i < id.length; i++) suma += id.charCodeAt(i) * (i + 1);
    return (suma % 360) * Math.PI / 180;
  }

  /* ---------------------------- LÍMITES DE EQUIPO -------------------------- */

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

  function limitesDescarga(equipo) {
    const esMineral = String(equipo.aceite || '').toLowerCase() === 'mineral';
    return {
      aviso: esMineral ? CFG.limites.descarga.avisoMineral : CFG.limites.descarga.aviso,
      alarma: esMineral ? CFG.limites.descarga.alarmaMineral : CFG.limites.descarga.alarma
    };
  }

  /* Genera un pulso periódico de presión para simular ciclaje.
     La fase 0..1 permite subida, meseta, bajada y reposo dentro de cada ciclo. */
  function pulsoCiclo(ts, periodoMs, inicio, subida, alta, bajada) {
    const fase = (((ts % periodoMs) + periodoMs) % periodoMs) / periodoMs;
    const finSubida = inicio + subida;
    const finAlta = finSubida + alta;
    const finBajada = finAlta + bajada;
    if (fase < inicio) return 0;
    if (fase < finSubida) return (fase - inicio) / subida;
    if (fase < finAlta) return 1;
    if (fase < finBajada) return 1 - (fase - finAlta) / bajada;
    return 0;
  }

  /* ------------------------------ LECTURAS -------------------------------- */

  function generarLectura(equipo, ts, opciones) {
    const tipo = CFG.tipos[equipo.tipo] || CFG.tipos.MBP;
    const objetivo = Number.isFinite(equipo.objetivo) ? equipo.objetivo : tipo.objetivo;
    const fase = faseDe(equipo.id);
    const ruido = (escala) => (Math.random() - 0.5) * (escala || 0.4);
    const rampa = clamp(opciones && opciones.ramp != null ? opciones.ramp : 1, 0, 1);

    const espacioNormal = objetivo + Math.sin(ts / 240000 + fase) * 0.35 + ruido(0.5);
    const ambienteNormal = 24 + Math.sin(ts / 900000 + fase * 0.4) * 1.6 + ruido(0.8);
    const evap = objetivo - (equipo.tipo === 'LBP' ? 6 : 4);

    let recalentamiento = 6.2;
    if (equipo.expansion === 'Electrónica') recalentamiento = 5.2;
    if (equipo.expansion === 'Capilar') recalentamiento = 7.4;
    recalentamiento += ruido(0.8);

    const cond = ambienteNormal + 10 + ruido(1.2);
    let espacio = espacioNormal;
    let temp1 = evap + recalentamiento;
    let temp2 = espacioNormal;
    let temp3 = (equipo.tipo === 'LBP' ? 82 : equipo.tipo === 'MBP' ? 78 : 74) + ruido(3.5);
    let temp4 = cond - 5.5 + ruido(0.7);
    let temp5 = ambienteNormal;
    let presionBaja = presionSaturacion(equipo.refrigerante, evap) + ruido(1.4);
    let presionAlta = presionSaturacion(equipo.refrigerante, cond) + ruido(3);

    const cfgCiclo = CFG.limites.ciclajePresion;
    const esFugaCiclo = equipo.falla === 'ciclaje_presion_baja';
    const esContactor = equipo.falla === 'contactor_defectuoso';
    if (esFugaCiclo) presionBaja -= 6;
    let pulsoPresion = 0;
    if (esFugaCiclo) {
      pulsoPresion = pulsoCiclo(ts, cfgCiclo.periodoFugaMs, 0.30, 0.10, 0.20, 0.15);
    } else if (esContactor) {
      pulsoPresion = pulsoCiclo(ts, cfgCiclo.periodoContactorMs, 0.20, 0.06, 0.18, 0.10);
    }
    presionBaja += pulsoPresion * (esFugaCiclo ? 26 : 22);

    switch (equipo.falla) {
      case 'espacio_alto':
        espacio += 10 * rampa;
        temp2 += 10 * rampa;
        temp3 += 12 * rampa;
        temp1 += 3 * rampa;
        presionAlta += 20 * rampa;
        break;
      case 'espacio_sube':
        espacio += 6 * rampa;
        temp2 += 6 * rampa;
        break;
      case 'descarga_alta':
        temp3 += 35 * rampa;
        presionAlta += 15 * rampa;
        break;
      case 'ambiente_sube':
        temp5 += 7 * rampa;
        espacio += 2.5 * rampa;
        temp2 += 2.5 * rampa;
        presionAlta += 10 * rampa;
        break;
      case 'recalentamiento_bajo':
        temp1 -= 6 * rampa;
        break;
      case 'recalentamiento_alto':
        temp1 += 12 * rampa;
        break;
      case 'subenfriamiento_bajo':
        temp4 += 8 * rampa;
        break;
      case 'subenfriamiento_alto':
        temp4 -= 8 * rampa;
        break;
      default:
        break;
    }

    const datos = {
      ts: ts,
      temp1: redondear(temp1, 1),
      temp2: redondear(temp2, 1),
      temp3: redondear(temp3, 1),
      temp4: redondear(temp4, 1),
      temp5: redondear(temp5, 1),
      presion_baja: redondear(Math.max(0, presionBaja), 0),
      presion_alta: redondear(Math.max(0, presionAlta), 0)
    };

    const sensor = equipo.sensorEspacio && datos[equipo.sensorEspacio] != null ? equipo.sensorEspacio : 'temp2';
    datos.tempEspacio = datos[sensor];
    datos.sensorEspacio = sensor;
    return datos;
  }

  function generarHistorial(equipo, finMs) {
    const paso = CFG.simulacion.tickMs;
    const cantidad = Math.round(CFG.simulacion.historiaMin * 60000 / paso);
    const inicio = finMs - (cantidad - 1) * paso;
    const lecturas = [];
    const sinDatos = equipo.falla === 'sin_datos';
    const corte = sinDatos ? finMs - 5 * 60000 : finMs;

    for (let i = 0; i < cantidad; i++) {
      const ts = inicio + i * paso;
      if (sinDatos && ts > corte) break;
      const rampa = equipo.falla && !sinDatos ? i / Math.max(1, cantidad - 1) : 0;
      lecturas.push(generarLectura(equipo, ts, { ramp: rampa }));
    }

    estado.lecturas[equipo.id] = lecturas.slice(-CFG.simulacion.maxLecturas);
  }

  function ultimaLectura(equipoId) {
    const lista = estado.lecturas[equipoId];
    return lista && lista.length ? lista[lista.length - 1] : null;
  }

  function historialDe(equipoId) {
    return estado.lecturas[equipoId] || [];
  }

  /* Detecta ciclaje de la presión de succión tomando como referencia la
     presión mínima observada en la ventana reciente. Un ciclo válido baja
     al mínimo, sube al menos 20 PSI y vuelve al mínimo. */
  function analizarCiclajePresion(equipo, t) {
    const cfg = CFG.limites.ciclajePresion;
    const historial = historialDe(equipo.id);
    if (!historial.length) return null;

    const desde = t - cfg.ventanaMin * 60000;
    const ventana = historial.filter((lectura) => lectura.ts >= desde);
    if (ventana.length < 8) return null;

    let presionMinima = Infinity;
    ventana.forEach((lectura) => {
      if (lectura.presion_baja < presionMinima) presionMinima = lectura.presion_baja;
    });

    const umbralBajo = presionMinima + cfg.toleranciaPsi;
    const umbralAlto = presionMinima + cfg.saltoPsi;
    const ciclos = [];
    let estado = 'bajo';
    let inicioBajo = null;
    let pico = null;

    ventana.forEach((lectura) => {
      const presion = lectura.presion_baja;
      if (estado === 'bajo') {
        if (presion <= umbralBajo) {
          if (inicioBajo == null) inicioBajo = lectura.ts;
          pico = presion;
        } else if (inicioBajo != null && presion >= umbralAlto) {
          estado = 'alto';
          pico = presion;
        }
        return;
      }

      if (presion > pico) pico = presion;
      if (presion <= umbralBajo) {
        if (inicioBajo != null) {
          const duracion = lectura.ts - inicioBajo;
          if (duracion >= cfg.duracionMinSeg * 1000 && duracion <= cfg.duracionMaxSeg * 1000) {
            ciclos.push({ inicio: inicioBajo, fin: lectura.ts, duracion: duracion, pico: pico });
          }
        }
        estado = 'bajo';
        inicioBajo = lectura.ts;
        pico = presion;
      }
    });

    const tipo = CFG.tipos[equipo.tipo] || CFG.tipos.MBP;
    const objetivo = Number.isFinite(equipo.objetivo) ? equipo.objetivo : tipo.objetivo;
    const evap = objetivo - (equipo.tipo === 'LBP' ? 6 : 4);
    const presionEsperada = presionSaturacion(equipo.refrigerante, evap);
    const ultimo = ciclos.length ? ciclos[ciclos.length - 1] : null;
    const duracionMedia = ciclos.length
      ? ciclos.reduce((suma, ciclo) => suma + ciclo.duracion, 0) / ciclos.length
      : 0;

    return {
      ciclos: ciclos,
      total: ciclos.length,
      presionMinima: presionMinima,
      presionEsperada: presionEsperada,
      esBaja: presionMinima <= presionEsperada - cfg.presionBajaPsi,
      reciente: ultimo ? t - ultimo.fin <= cfg.ultimoCicloMin * 60000 : false,
      duracionMedia: duracionMedia
    };
  }

  function agregarLectura(equipo, ts) {
    if (equipo.falla === 'sin_datos') return;
    const lectura = generarLectura(equipo, ts, { ramp: 1 });
    if (!estado.lecturas[equipo.id]) estado.lecturas[equipo.id] = [];
    estado.lecturas[equipo.id].push(lectura);
    if (estado.lecturas[equipo.id].length > CFG.simulacion.maxLecturas) {
      estado.lecturas[equipo.id].splice(0, estado.lecturas[equipo.id].length - CFG.simulacion.maxLecturas);
    }
  }

  /* --------------------------- MOTOR DE DIAGNÓSTICO ------------------------ */

  const RANGO_GRAVEDAD = { sugerencia: 1, aviso: 2, alarma: 3 };

  function condicion(tipo, gravedad, detalle, valores) {
    const definicion = CFG.fallas[tipo] || {};
    return {
      tipo: tipo,
      gravedad: gravedad,
      titulo: definicion.titulo || tipo,
      detalle: detalle,
      sugerencia: definicion.sugerencia || '',
      valores: valores || {}
    };
  }

  function evaluarCondiciones(equipo, t) {
    const lectura = ultimaLectura(equipo.id);
    if (!lectura) {
      return [condicion('sin_datos', 'alarma', 'No hay lecturas disponibles de este equipo.', { edadMs: null })];
    }

    const edad = t - lectura.ts;
    if (edad > CFG.frescura.alarmaMs) {
      return [condicion('sin_datos', 'alarma',
        'Sin lecturas desde hace ' + Math.max(1, Math.round(edad / 60000)) + ' minutos.',
        { edadMs: edad })];
    }
    if (edad > CFG.frescura.avisoMs) {
      return [condicion('sin_datos', 'aviso',
        'La última lectura llegó hace ' + Math.max(1, Math.round(edad / 1000)) + ' segundos.',
        { edadMs: edad })];
    }

    const condiciones = [];
    const limites = limitesEspacio(equipo);
    const v = lectura.tempEspacio;
    const cfgCiclo = CFG.limites.ciclajePresion;
    const ciclaje = analizarCiclajePresion(equipo, t);
    const ciclajeActivo = !!ciclaje && ciclaje.reciente && ciclaje.total >= cfgCiclo.minimoCiclos;

    if (v > limites.alarmaAlto) {
      condiciones.push(condicion('espacio_alto', 'alarma',
        'Espacio a ' + numero(v, 1) + ' °C; límite de alarma ' + numero(limites.alarmaAlto, 1) + ' °C.',
        { tempEspacio: v, limite: limites.alarmaAlto }));
    } else if (v > limites.avisoAlto) {
      condiciones.push(condicion('espacio_alto', 'aviso',
        'Espacio a ' + numero(v, 1) + ' °C; empieza a alejarse del rango normal.',
        { tempEspacio: v, limite: limites.avisoAlto }));
    } else if (v < limites.alarmaBajo) {
      condiciones.push(condicion('espacio_bajo', 'alarma',
        'Espacio a ' + numero(v, 1) + ' °C; límite inferior ' + numero(limites.alarmaBajo, 1) + ' °C.',
        { tempEspacio: v, limite: limites.alarmaBajo }));
    } else if (v < limites.avisoBajo) {
      condiciones.push(condicion('espacio_bajo', 'aviso',
        'Espacio a ' + numero(v, 1) + ' °C; por debajo del rango de precaución.',
        { tempEspacio: v, limite: limites.avisoBajo }));
    }

    const descarga = limitesDescarga(equipo);
    if (lectura.temp3 > descarga.alarma) {
      condiciones.push(condicion('descarga_alta', 'alarma',
        'Descarga a ' + numero(lectura.temp3, 1) + ' °C; límite del aceite ' + numero(descarga.alarma, 0) + ' °C.',
        { tempDescarga: lectura.temp3, limite: descarga.alarma }));
    } else if (lectura.temp3 > descarga.aviso) {
      condiciones.push(condicion('descarga_alta', 'aviso',
        'Descarga a ' + numero(lectura.temp3, 1) + ' °C; se acerca al límite del compresor.',
        { tempDescarga: lectura.temp3, limite: descarga.aviso }));
    }

    const relacion = (lectura.presion_alta + 14.7) / Math.max(1, lectura.presion_baja + 14.7);
    if (relacion > CFG.limites.relacionCompresion.alarma) {
      condiciones.push(condicion('relacion_alta', 'alarma',
        'Relación de compresión ' + numero(relacion, 1) + ':1; límite ' + CFG.limites.relacionCompresion.alarma + ':1.',
        { relacion: relacion }));
    } else if (relacion > CFG.limites.relacionCompresion.aviso) {
      condiciones.push(condicion('relacion_alta', 'aviso',
        'Relación de compresión ' + numero(relacion, 1) + ':1; vigilar el condensador.',
        { relacion: relacion }));
    }

    if (!ciclajeActivo) {
      const saturacionSuccion = tempSaturacion(equipo.refrigerante, lectura.presion_baja);
      const recalentamiento = lectura.temp1 - saturacionSuccion;
      if (recalentamiento < CFG.limites.recalentamiento.min) {
        condiciones.push(condicion('recalentamiento_bajo', 'sugerencia',
          'Recalentamiento de ' + numero(recalentamiento, 1) + ' K; se esperaba al menos ' + CFG.limites.recalentamiento.min + ' K.',
          { recalentamiento: recalentamiento }));
      } else if (recalentamiento > CFG.limites.recalentamiento.max) {
        condiciones.push(condicion('recalentamiento_alto', 'sugerencia',
          'Recalentamiento de ' + numero(recalentamiento, 1) + ' K; se esperaba menos de ' + CFG.limites.recalentamiento.max + ' K.',
          { recalentamiento: recalentamiento }));
      }

      const saturacionDescarga = tempSaturacion(equipo.refrigerante, lectura.presion_alta);
      const subenfriamiento = saturacionDescarga - lectura.temp4;
      if (subenfriamiento < CFG.limites.subenfriamiento.min) {
        condiciones.push(condicion('subenfriamiento_bajo', 'sugerencia',
          'Subenfriamiento de ' + numero(subenfriamiento, 1) + ' K; puede faltar refrigerante.',
          { subenfriamiento: subenfriamiento }));
      } else if (subenfriamiento > CFG.limites.subenfriamiento.max) {
        condiciones.push(condicion('subenfriamiento_alto', 'sugerencia',
          'Subenfriamiento de ' + numero(subenfriamiento, 1) + ' K; revisar el condensador.',
          { subenfriamiento: subenfriamiento }));
      }
    }

    const historial = historialDe(equipo.id);
    const antiguo = historial.length ? historial[0] : null;
    if (antiguo && t - antiguo.ts >= 10 * 60000) {
      const deltaEspacio = v - antiguo.tempEspacio;
      if (deltaEspacio >= CFG.limites.aumentoEspacio.aviso) {
        condiciones.push(condicion('espacio_sube', 'aviso',
          'Subió ' + numero(deltaEspacio, 1) + ' °C en los últimos ' + CFG.limites.aumentoEspacio.ventanaMin + ' minutos.',
          { delta: deltaEspacio }));
      }
      const deltaAmbiente = lectura.temp5 - antiguo.temp5;
      if (deltaAmbiente >= CFG.limites.aumentoAmbiente.aviso) {
        condiciones.push(condicion('ambiente_sube', 'aviso',
          'El ambiente subió ' + numero(deltaAmbiente, 1) + ' °C en los últimos ' + CFG.limites.aumentoAmbiente.ventanaMin + ' minutos.',
          { delta: deltaAmbiente }));
      }
    }

    if (ciclajeActivo) {
      const duracionMedia = Math.max(1, Math.round(ciclaje.duracionMedia / 1000));
      if (ciclaje.esBaja) {
        condiciones.push(condicion('ciclaje_presion_baja', 'alarma',
          'La presión de succión cayó a ' + numero(ciclaje.presionMinima, 0) + ' PSI (mínimo reciente) y completó ' +
          ciclaje.total + ' ciclos de al menos ' + cfgCiclo.saltoPsi + ' PSI, con una duración media de ' +
          duracionMedia + ' s. El mínimo está ' + numero(ciclaje.presionEsperada - ciclaje.presionMinima, 0) +
          ' PSI por debajo de lo esperado.',
          {
            presionMinima: ciclaje.presionMinima,
            presionEsperada: ciclaje.presionEsperada,
            ciclos: ciclaje.total,
            saltoPsi: cfgCiclo.saltoPsi,
            duracionMedia: duracionMedia
          }));
      } else {
        condiciones.push(condicion('contactor_defectuoso', 'alarma',
          'Se detectaron ' + ciclaje.total + ' ciclos de presión de al menos ' + cfgCiclo.saltoPsi +
          ' PSI en los últimos ' + cfgCiclo.ventanaMin + ' min, con un mínimo de ' + numero(ciclaje.presionMinima, 0) +
          ' PSI cerca de lo esperado y una duración media de ' + duracionMedia +
          ' s. Patrón compatible con contactor, relé o control de arranque.',
          {
            presionMinima: ciclaje.presionMinima,
            presionEsperada: ciclaje.presionEsperada,
            ciclos: ciclaje.total,
            saltoPsi: cfgCiclo.saltoPsi,
            duracionMedia: duracionMedia
          }));
      }
    }

    return condiciones;
  }

  function alertaActiva(equipoId, tipo) {
    let encontrada = null;
    estado.alertas.forEach((alerta) => {
      if (alerta.equipoId !== equipoId || alerta.tipo !== tipo) return;
      if (alerta.estado !== 'activa' && alerta.estado !== 'reconocida') return;
      if (!encontrada || alerta.inicio > encontrada.inicio) encontrada = alerta;
    });
    return encontrada;
  }

  function alertaRecienteCorregida(equipoId, tipo, desde) {
    let encontrada = null;
    estado.alertas.forEach((alerta) => {
      if (alerta.equipoId !== equipoId || alerta.tipo !== tipo) return;
      if (alerta.estado !== 'corregida') return;
      const fin = alerta.fin || alerta.ultimaVez || 0;
      if (fin < desde) return;
      if (!encontrada || fin > (encontrada.fin || encontrada.ultimaVez || 0)) encontrada = alerta;
    });
    return encontrada;
  }

  function evaluar(forzar) {
    const t = ahora();
    let cambios = false;

    estado.equipos.forEach((equipo) => {
      const condiciones = evaluarCondiciones(equipo, t);
      const tipos = {};
      condiciones.forEach((c) => { tipos[c.tipo] = true; });
      const soloSinDatos = !!tipos.sin_datos;
      const seguimiento = estado.seguimiento[equipo.id] || (estado.seguimiento[equipo.id] = {});

      condiciones.forEach((cond) => {
        const control = seguimiento[cond.tipo] || (seguimiento[cond.tipo] = { activo: false, cuenta: 0, limpio: 0 });
        control.cuenta += 1;
        control.limpio = 0;
        const existente = alertaActiva(equipo.id, cond.tipo);

        if (existente) {
          if (RANGO_GRAVEDAD[cond.gravedad] > RANGO_GRAVEDAD[existente.gravedad]) {
            existente.gravedad = cond.gravedad;
            cambios = true;
          }
          existente.titulo = cond.titulo;
          existente.detalle = cond.detalle;
          existente.sugerencia = cond.sugerencia;
          existente.valores = cond.valores;
          existente.ultimaVez = t;
          control.activo = true;
          return;
        }

        if (!forzar && control.cuenta < CFG.simulacion.debounceTicks) return;

        const reciente = alertaRecienteCorregida(
          equipo.id,
          cond.tipo,
          t - CFG.simulacion.reaparicionMin * 60000
        );

        if (reciente) {
          reciente.estado = 'activa';
          reciente.gravedad = cond.gravedad;
          reciente.titulo = cond.titulo;
          reciente.detalle = cond.detalle;
          reciente.sugerencia = cond.sugerencia;
          reciente.inicio = t;
          reciente.fin = null;
          reciente.ultimaVez = t;
          reciente.reapariciones = (reciente.reapariciones || 0) + 1;
          reciente.valores = cond.valores;
        } else {
          estado.alertas.push({
            id: uid('al'),
            equipoId: equipo.id,
            tipo: cond.tipo,
            gravedad: cond.gravedad,
            titulo: cond.titulo,
            detalle: cond.detalle,
            sugerencia: cond.sugerencia,
            estado: 'activa',
            inicio: t,
            inicioOriginal: t,
            fin: null,
            ultimaVez: t,
            reapariciones: 0,
            valores: cond.valores
          });
        }
        control.activo = true;
        cambios = true;
      });

      if (!soloSinDatos) {
        estado.alertas.forEach((alerta) => {
          if (alerta.equipoId !== equipo.id) return;
          if (alerta.estado !== 'activa' && alerta.estado !== 'reconocida') return;
          if (tipos[alerta.tipo]) return;
          const control = seguimiento[alerta.tipo] || (seguimiento[alerta.tipo] = { activo: false, cuenta: 0, limpio: 0 });
          control.limpio += 1;
          control.cuenta = 0;
          if (forzar || control.limpio >= CFG.simulacion.debounceTicks) {
            alerta.estado = 'corregida';
            alerta.fin = t;
            alerta.ultimaVez = t;
            control.activo = false;
            control.limpio = 0;
            cambios = true;
          }
        });
      }

      Object.keys(seguimiento).forEach((tipo) => {
        if (tipos[tipo]) return;
        const control = seguimiento[tipo];
        if (control && !control.activo) {
          control.cuenta = 0;
          control.limpio = 0;
        }
      });
    });

    guardarAlertas(cambios);
    estado.listo = true;
    return cambios;
  }

  /* ------------------------------- CONSULTAS ------------------------------ */

  function etiquetaGravedad(gravedad) {
    return gravedad === 'alarma' ? 'Alarma' : gravedad === 'aviso' ? 'Aviso' : 'Sugerencia';
  }

  function etiquetaEstadoAlerta(estadoAlerta) {
    if (estadoAlerta === 'reconocida') return 'Reconocida';
    if (estadoAlerta === 'corregida') return 'Corregida';
    return 'Activa';
  }

  function compararPorGravedad(a, b) {
    const diferencia = (RANGO_GRAVEDAD[b.gravedad] || 0) - (RANGO_GRAVEDAD[a.gravedad] || 0);
    if (diferencia !== 0) return diferencia;
    return (b.inicio || 0) - (a.inicio || 0);
  }

  function alertasActivasDe(equipoId) {
    return estado.alertas
      .filter((alerta) => alerta.equipoId === equipoId && (alerta.estado === 'activa' || alerta.estado === 'reconocida'))
      .sort(compararPorGravedad);
  }

  function alertasDe(equipoId) {
    return estado.alertas
      .filter((alerta) => alerta.equipoId === equipoId)
      .sort((a, b) => (b.inicio || 0) - (a.inicio || 0));
  }

  function estadoEquipo(equipo) {
    const activas = alertasActivasDe(equipo.id);
    const sinDatos = activas.some((alerta) => alerta.tipo === 'sin_datos') || !ultimaLectura(equipo.id);
    let nivel = 'normal';

    if (sinDatos) {
      nivel = 'sin_datos';
    } else if (activas.some((alerta) => alerta.gravedad === 'alarma')) {
      nivel = 'alarma';
    } else if (activas.some((alerta) => alerta.gravedad === 'aviso')) {
      nivel = 'aviso';
    } else if (activas.some((alerta) => alerta.gravedad === 'sugerencia')) {
      nivel = 'sugerencia';
    }

    const etiquetas = {
      normal: 'Normal',
      alarma: 'Alarma',
      aviso: 'Aviso',
      sugerencia: 'Sugerencia',
      sin_datos: 'Sin datos'
    };

    return {
      nivel: nivel,
      etiqueta: etiquetas[nivel],
      alertaPrincipal: activas.length ? activas[0] : null,
      activas: activas,
      reconocida: activas.length > 0 && activas.every((alerta) => alerta.estado === 'reconocida')
    };
  }

  function resumen() {
    const conteo = { total: estado.equipos.length, alarma: 0, aviso: 0, sugerencia: 0, sin_datos: 0, normal: 0 };
    estado.equipos.forEach((equipo) => {
      const estadoActual = estadoEquipo(equipo);
      conteo[estadoActual.nivel] += 1;
    });
    return conteo;
  }

  function procesoDe(equipo) {
    const lectura = ultimaLectura(equipo.id);
    if (!lectura) return null;
    const ciclaje = analizarCiclajePresion(equipo, ahora());
    const ciclajeActivo = !!ciclaje && ciclaje.reciente &&
      ciclaje.total >= CFG.limites.ciclajePresion.minimoCiclos;
    const presionBase = ciclajeActivo ? ciclaje.presionMinima : lectura.presion_baja;
    const saturacionSuccion = tempSaturacion(equipo.refrigerante, presionBase);
    const saturacionDescarga = tempSaturacion(equipo.refrigerante, lectura.presion_alta);
    return Object.assign({}, lectura, {
      saturacionSuccion: saturacionSuccion,
      recalentamiento: lectura.temp1 - saturacionSuccion,
      saturacionDescarga: saturacionDescarga,
      subenfriamiento: saturacionDescarga - lectura.temp4,
      relacion: (lectura.presion_alta + 14.7) / Math.max(1, presionBase + 14.7),
      presionMinima: ciclaje ? ciclaje.presionMinima : lectura.presion_baja,
      presionEsperada: ciclaje ? ciclaje.presionEsperada : null,
      presionBase: presionBase,
      ciclaje: ciclaje
    });
  }

  function tiempoRelativo(ms) {
    if (!Number.isFinite(ms)) return '—';
    if (ms < 5000) return 'ahora';
    if (ms < 60000) return 'hace ' + Math.round(ms / 1000) + ' s';
    if (ms < 3600000) return 'hace ' + Math.round(ms / 60000) + ' min';
    if (ms < 86400000) return 'hace ' + Math.round(ms / 3600000) + ' h';
    return 'hace ' + Math.round(ms / 86400000) + ' d';
  }

  function duracionTexto(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const minutos = Math.max(1, Math.round(ms / 60000));
    if (minutos < 60) return minutos + ' min';
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return horas + ' h' + (resto ? ' ' + resto + ' min' : '');
  }

  const formatoFechaHora = new Intl.DateTimeFormat('es-VE', {
    timeZone: CFG.zonaHoraria,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  function fechaHora(ts) {
    if (!ts) return '—';
    return formatoFechaHora.format(new Date(ts));
  }

  /* -------------------------------- ACCIONES ------------------------------- */

  function equipoPorId(id) {
    return estado.equipos.find((equipo) => equipo.id === id) || null;
  }

  function crearEquipo(datos) {
    const tipo = CFG.tipos[datos.tipo] ? datos.tipo : 'MBP';
    const refrigerante = CFG.refrigerantes[datos.refrigerante] ? datos.refrigerante : 'R-404A';
    const objetivo = Number.isFinite(Number(datos.objetivo)) ? Number(datos.objetivo) : CFG.tipos[tipo].objetivo;
    const catalogo = CFG.refrigerantes[refrigerante];

    const equipo = {
      id: uid('eq'),
      nombre: String(datos.nombre || '').trim() || 'Cuadro sin nombre',
      ubicacion: String(datos.ubicacion || '').trim() || 'Sin ubicación',
      tipo: tipo,
      refrigerante: refrigerante,
      expansion: CFG.expansiones.indexOf(datos.expansion) >= 0 ? datos.expansion : 'Termostática',
      objetivo: objetivo,
      compresor: CFG.compresores.indexOf(datos.compresor) >= 0 ? datos.compresor : 'Hermético',
      aceite: CFG.aceites.indexOf(datos.aceite) >= 0 ? datos.aceite : (catalogo.aceite || 'POE'),
      sensorEspacio: ['temp1', 'temp2', 'temp5'].indexOf(datos.sensorEspacio) >= 0 ? datos.sensorEspacio : 'temp2',
      creado: ahora(),
      falla: null
    };

    estado.equipos.push(equipo);
    estado.seguimiento[equipo.id] = {};
    generarHistorial(equipo, ahora());
    evaluar(true);
    guardarEquipos();
    guardarAlertas(true);
    return equipo;
  }

  function aplicarFalla(equipoId, tipo) {
    const equipo = equipoPorId(equipoId);
    if (!equipo) return null;
    equipo.falla = tipo && CFG.fallas[tipo] ? tipo : null;
    generarHistorial(equipo, ahora());
    evaluar(true);
    guardarEquipos();
    guardarAlertas(true);
    return equipo;
  }

  function provocarFallaAleatoria() {
    const disponibles = estado.equipos.filter((equipo) => !equipo.falla);
    const candidatos = disponibles.length ? disponibles : estado.equipos;
    if (!candidatos.length) return null;
    const equipo = candidatos[Math.floor(Math.random() * candidatos.length)];
    const opciones = ['espacio_alto', 'descarga_alta', 'ambiente_sube', 'espacio_sube', 'recalentamiento_bajo', 'ciclaje_presion_baja', 'contactor_defectuoso', 'sin_datos'];
    const tipo = opciones[Math.floor(Math.random() * opciones.length)];
    aplicarFalla(equipo.id, tipo);
    return { equipo: equipo, tipo: tipo };
  }

  function reconocerAlerta(alertaId) {
    const alerta = estado.alertas.find((item) => item.id === alertaId);
    if (!alerta) return null;
    if (alerta.estado === 'activa') {
      alerta.estado = 'reconocida';
      alerta.ultimaVez = ahora();
      guardarAlertas(true);
    }
    return alerta;
  }

  function reiniciar() {
    estado.equipos = equiposDemo();
    estado.alertas = alertasHistoricas(estado.equipos);
    estado.lecturas = {};
    estado.seguimiento = {};
    estado.equipos.forEach((equipo) => {
      estado.seguimiento[equipo.id] = {};
      generarHistorial(equipo, ahora());
    });
    evaluar(true);
    guardarEquipos();
    guardarAlertas(true);
    return estado.equipos;
  }

  function pausar(activo) {
    estado.simulacionActiva = !!activo;
    return estado.simulacionActiva;
  }

  function tick() {
    if (!estado.simulacionActiva) return false;
    const t = ahora();
    estado.equipos.forEach((equipo) => agregarLectura(equipo, t));
    evaluar(false);
    return true;
  }

  function exportarCSV() {
    const filas = [['Inicio', 'Equipo', 'Falla', 'Estado', 'Fin', 'Duración', 'Reapariciones', 'Detalle']];
    const ordenadas = estado.alertas.slice().sort((a, b) => (b.inicio || 0) - (a.inicio || 0));
    ordenadas.forEach((alerta) => {
      const equipo = equipoPorId(alerta.equipoId);
      filas.push([
        new Date(alerta.inicio).toISOString(),
        equipo ? equipo.nombre : alerta.equipoId,
        alerta.titulo,
        etiquetaEstadoAlerta(alerta.estado),
        alerta.fin ? new Date(alerta.fin).toISOString() : '',
        alerta.fin ? duracionTexto(alerta.fin - alerta.inicio) : 'En curso',
        alerta.reapariciones || 0,
        alerta.detalle
      ]);
    });
    return filas.map((fila) => fila.map((celda) => {
      const texto = String(celda == null ? '' : celda);
      return '"' + texto.replace(/"/g, '""') + '"';
    }).join(';')).join('\r\n');
  }

  /* -------------------------------- ARRANQUE ------------------------------- */

  function normalizarEquipo(equipo) {
    const copia = Object.assign({}, equipo);
    const tipo = CFG.tipos[copia.tipo] ? copia.tipo : 'MBP';
    const refrigerante = CFG.refrigerantes[copia.refrigerante] ? copia.refrigerante : 'R-404A';
    const catalogo = CFG.refrigerantes[refrigerante];
    if (!copia.id) copia.id = uid('eq');
    copia.tipo = tipo;
    copia.refrigerante = refrigerante;
    copia.objetivo = Number.isFinite(Number(copia.objetivo)) ? Number(copia.objetivo) : CFG.tipos[tipo].objetivo;
    copia.expansion = CFG.expansiones.indexOf(copia.expansion) >= 0 ? copia.expansion : 'Termostática';
    copia.compresor = CFG.compresores.indexOf(copia.compresor) >= 0 ? copia.compresor : 'Hermético';
    copia.aceite = CFG.aceites.indexOf(copia.aceite) >= 0 ? copia.aceite : (catalogo.aceite || 'POE');
    copia.sensorEspacio = copia.sensorEspacio || 'temp2';
    copia.nombre = copia.nombre || 'Cuadro sin nombre';
    copia.ubicacion = copia.ubicacion || 'Sin ubicación';
    copia.creado = Number(copia.creado) || ahora();
    copia.falla = copia.falla && CFG.fallas[copia.falla] ? copia.falla : null;
    return copia;
  }

  function normalizarAlerta(alerta) {
    const copia = Object.assign({}, alerta);
    const definicion = CFG.fallas[copia.tipo] || {};
    if (!copia.id) copia.id = uid('al');
    if (['activa', 'reconocida', 'corregida'].indexOf(copia.estado) < 0) copia.estado = 'corregida';
    if (['alarma', 'aviso', 'sugerencia'].indexOf(copia.gravedad) < 0) copia.gravedad = definicion.gravedad || 'aviso';
    copia.inicio = Number(copia.inicio) || ahora();
    copia.inicioOriginal = Number(copia.inicioOriginal) || copia.inicio;
    copia.fin = copia.fin ? Number(copia.fin) : null;
    copia.ultimaVez = Number(copia.ultimaVez) || copia.fin || copia.inicio;
    copia.reapariciones = Number(copia.reapariciones) || 0;
    copia.titulo = copia.titulo || definicion.titulo || copia.tipo;
    copia.detalle = copia.detalle || definicion.detalle || '';
    copia.sugerencia = copia.sugerencia || definicion.sugerencia || '';
    copia.valores = copia.valores || {};
    return copia;
  }

  function init() {
    const equiposGuardados = leerJSON(LS_EQUIPOS);
    if (equiposGuardados && equiposGuardados.length) {
      estado.equipos = equiposGuardados.map(normalizarEquipo);
    } else {
      estado.equipos = equiposDemo();
      guardarEquipos();
    }

    const alertasGuardadas = leerJSON(LS_ALERTAS);
    if (alertasGuardadas && alertasGuardadas.length) {
      estado.alertas = alertasGuardadas.map(normalizarAlerta);
    } else {
      estado.alertas = alertasHistoricas(estado.equipos);
      guardarAlertas(true);
    }

    estado.lecturas = {};
    estado.seguimiento = {};
    estado.equipos.forEach((equipo) => {
      estado.seguimiento[equipo.id] = {};
      generarHistorial(equipo, ahora());
    });

    evaluar(true);
    guardarAlertas(true);
    estado.listo = true;
    return { equipos: estado.equipos, alertas: estado.alertas };
  }

  /* ---------------------------------- API --------------------------------- */

  window.FLOTA = {
    init: init,
    tick: tick,
    reiniciar: reiniciar,
    pausar: pausar,
    crearEquipo: crearEquipo,
    aplicarFalla: aplicarFalla,
    provocarFallaAleatoria: provocarFallaAleatoria,
    reconocerAlerta: reconocerAlerta,
    equipos: function () { return estado.equipos; },
    equipo: equipoPorId,
    alertas: function () { return estado.alertas; },
    alertasDe: alertasDe,
    alertasActivasDe: alertasActivasDe,
    estadoEquipo: estadoEquipo,
    resumen: resumen,
    lectura: ultimaLectura,
    historial: historialDe,
    proceso: procesoDe,
    simulacionActiva: function () { return estado.simulacionActiva; },
    exportarCSV: exportarCSV,
    tiempoRelativo: tiempoRelativo,
    duracionTexto: duracionTexto,
    fechaHora: fechaHora,
    etiquetaGravedad: etiquetaGravedad,
    etiquetaEstadoAlerta: etiquetaEstadoAlerta
  };


})();
