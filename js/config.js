/* ============================================================================
   FLOTA DE REFRIGERACIÓN · CONFIGURACIÓN
   ----------------------------------------------------------------------------
   Prototipo de supervisión para 20 equipos de un hipermercado.
   No usa Supabase: los datos se simulan en el navegador y las fallas se
   guardan en localStorage.
   ========================================================================== */

window.CONFIG_FLOTA = {
  zonaHoraria: 'America/Caracas',

  simulacion: {
    tickMs: 3000,
    historiaMin: 15,
    maxLecturas: 400,
    debounceTicks: 2,
    reaparicionMin: 30,
    pausaInicial: false
  },

  frescura: {
    avisoMs: 45000,
    alarmaMs: 180000
  },

  tipos: {
    LBP: {
      nombre: 'Baja temperatura',
      corto: 'LBP',
      descripcion: 'Congelados, helados y cámaras',
      objetivo: -18,
      margenes: { avisoAlto: 3, alarmaAlto: 6, avisoBajo: 4, alarmaBajo: 7 }
    },
    MBP: {
      nombre: 'Media temperatura',
      corto: 'MBP',
      descripcion: 'Carnes, lácteos y pescadería',
      objetivo: 2,
      margenes: { avisoAlto: 4, alarmaAlto: 6, avisoBajo: 4, alarmaBajo: 7 }
    },
    HBP: {
      nombre: 'Alta temperatura',
      corto: 'HBP',
      descripcion: 'Frutas, verduras y bebidas',
      objetivo: 10,
      margenes: { avisoAlto: 3, alarmaAlto: 5, avisoBajo: 4, alarmaBajo: 6 }
    }
  },

  /* Tablas aproximadas de saturación (presión manométrica en PSI).
     Se usan solo para la simulación y el diagnóstico demostrativo. */
  refrigerantes: {
    'R-404A': {
      aceite: 'POE',
      pt: [[-40, 3], [-30, 9], [-20, 24], [-10, 42], [0, 68], [10, 101], [20, 143], [30, 198], [40, 267], [50, 352]]
    },
    'R-448A': {
      aceite: 'POE',
      pt: [[-40, 1], [-30, 6], [-20, 21], [-10, 38], [0, 63], [10, 95], [20, 136], [30, 190], [40, 258], [50, 342]]
    },
    'R-449A': {
      aceite: 'POE',
      pt: [[-40, 1], [-30, 6], [-20, 21], [-10, 38], [0, 63], [10, 95], [20, 136], [30, 190], [40, 258], [50, 342]]
    },
    'R-507A': {
      aceite: 'POE',
      pt: [[-40, 4], [-30, 10], [-20, 26], [-10, 45], [0, 72], [10, 106], [20, 150], [30, 207], [40, 279], [50, 367]]
    },
    'R-134a': {
      aceite: 'POE',
      pt: [[-40, 0], [-30, 2], [-20, 8], [-10, 17], [0, 29], [10, 46], [20, 70], [30, 101], [40, 142], [50, 193]]
    },
    'R-22': {
      aceite: 'Mineral',
      pt: [[-40, 0], [-30, 6], [-20, 20], [-10, 38], [0, 61], [10, 92], [20, 132], [30, 182], [40, 245], [50, 322]]
    },
    'R-410A': {
      aceite: 'POE',
      pt: [[-40, 11], [-30, 24], [-20, 40], [-10, 61], [0, 90], [10, 127], [20, 174], [30, 233], [40, 306], [50, 395]]
    },
    'R-32': {
      aceite: 'POE',
      pt: [[-40, 9], [-30, 21], [-20, 36], [-10, 56], [0, 83], [10, 118], [20, 162], [30, 217], [40, 286], [50, 371]]
    },
    'R-290': {
      aceite: 'Mineral',
      pt: [[-40, 6], [-30, 15], [-20, 27], [-10, 43], [0, 65], [10, 94], [20, 131], [30, 177], [40, 233], [50, 301]]
    },
    'R-717': {
      aceite: 'Mineral',
      pt: [[-40, 10], [-30, 24], [-20, 41], [-10, 65], [0, 88], [10, 120], [20, 160], [30, 209], [40, 268], [50, 338]]
    }
  },

  expansiones: ['Termostática', 'Electrónica', 'Capilar'],
  compresores: ['Hermético', 'Semihermético', 'Scroll'],
  aceites: ['POE', 'Mineral', 'PAG', 'PVE'],

  sondas: {
    temp1: { nombre: 'T. succión', unidad: '°C', decimales: 1 },
    temp2: { nombre: 'T. espacio', unidad: '°C', decimales: 1 },
    temp3: { nombre: 'T. descarga', unidad: '°C', decimales: 1 },
    temp4: { nombre: 'T. líquido', unidad: '°C', decimales: 1 },
    temp5: { nombre: 'T. ambiente', unidad: '°C', decimales: 1 },
    presion_baja: { nombre: 'P. succión', unidad: 'PSI', decimales: 0 },
    presion_alta: { nombre: 'P. descarga', unidad: 'PSI', decimales: 0 }
  },

  limites: {
    descarga: {
      aviso: 90,
      alarma: 105,
      avisoMineral: 85,
      alarmaMineral: 100
    },
    relacionCompresion: { aviso: 10, alarma: 13 },
    recalentamiento: { min: 2, max: 15 },
    subenfriamiento: { min: 2, max: 10 },
    aumentoAmbiente: { ventanaMin: 15, aviso: 4 },
    aumentoEspacio: { ventanaMin: 15, aviso: 5 },
    ciclajePresion: {
      ventanaMin: 12,
      minimoCiclos: 3,
      saltoPsi: 20,
      toleranciaPsi: 3,
      duracionMinSeg: 25,
      duracionMaxSeg: 120,
      ultimoCicloMin: 3,
      presionBajaPsi: 5,
      periodoFugaMs: 60000,
      periodoContactorMs: 30000
    }
  },

  fallas: {
    espacio_alto: {
      nombre: 'Temperatura alta en el espacio',
      gravedad: 'alarma',
      titulo: 'Temperatura alta en el espacio',
      detalle: 'La temperatura del espacio refrigerado supera el límite permitido.',
      sugerencia: 'Revisar puerta, cortina, desescarche y ventilación del evaporador. Avisar al técnico si continúa.'
    },
    descarga_alta: {
      nombre: 'Descarga del compresor alta',
      gravedad: 'alarma',
      titulo: 'Descarga del compresor alta',
      detalle: 'La temperatura de descarga está por encima del límite del compresor.',
      sugerencia: 'Revisar condensador, ventiladores, carga de refrigerante y lubricación. No manipule el equipo.'
    },
    ambiente_sube: {
      nombre: 'Aumento repentino de temperatura ambiente',
      gravedad: 'aviso',
      titulo: 'Aumento repentino de temperatura ambiente',
      detalle: 'La temperatura ambiente subió más de lo normal en los últimos 15 minutos.',
      sugerencia: 'Verificar ventilación de la sala, puertas abiertas y posibles fuentes de calor cercanas.'
    },
    espacio_sube: {
      nombre: 'Aumento repentino de temperatura del espacio',
      gravedad: 'aviso',
      titulo: 'Aumento repentino de temperatura del espacio',
      detalle: 'La temperatura del espacio subió rápidamente en los últimos 15 minutos.',
      sugerencia: 'Revisar carga reciente, puerta abierta, cortina o desescarche antes de que llegue a alarma.'
    },
    espacio_bajo: {
      nombre: 'Temperatura baja en el espacio',
      gravedad: 'alarma',
      titulo: 'Temperatura baja en el espacio',
      detalle: 'La temperatura del espacio refrigerado está por debajo del límite permitido.',
      sugerencia: 'Revisar control de temperatura, sensor y posible exceso de refrigeración. Avisar al técnico.'
    },
    relacion_alta: {
      nombre: 'Relación de compresión alta',
      gravedad: 'alarma',
      titulo: 'Relación de compresión alta',
      detalle: 'La diferencia entre la presión de descarga y la de succión es excesiva para el compresor.',
      sugerencia: 'Revisar condensador, succión y posibles obstrucciones. No manipule el equipo.'
    },
    recalentamiento_bajo: {
      nombre: 'Recalentamiento bajo',
      gravedad: 'sugerencia',
      titulo: 'Recalentamiento bajo',
      detalle: 'La diferencia entre la temperatura de succión y la de saturación es demasiado baja.',
      sugerencia: 'Revisar la válvula de expansión y el sensor de succión. Posible sobrealimentación.'
    },
    recalentamiento_alto: {
      nombre: 'Recalentamiento alto',
      gravedad: 'sugerencia',
      titulo: 'Recalentamiento alto',
      detalle: 'La diferencia entre la temperatura de succión y la de saturación es demasiado alta.',
      sugerencia: 'Revisar carga de refrigerante, obstrucción del circuito o válvula de expansión.'
    },
    subenfriamiento_bajo: {
      nombre: 'Subenfriamiento bajo',
      gravedad: 'sugerencia',
      titulo: 'Subenfriamiento bajo',
      detalle: 'El líquido llega al evaporador con poco margen de subenfriamiento.',
      sugerencia: 'Revisar carga de refrigerante y posibles burbujas en la línea de líquido.'
    },
    subenfriamiento_alto: {
      nombre: 'Subenfriamiento alto',
      gravedad: 'sugerencia',
      titulo: 'Subenfriamiento alto',
      detalle: 'El subenfriamiento está por encima de lo esperado.',
      sugerencia: 'Revisar condensador y restricciones en la línea de líquido.'
    },
    sin_datos: {
      nombre: 'Equipo sin señal',
      gravedad: 'alarma',
      titulo: 'Equipo sin señal',
      detalle: 'No se reciben lecturas nuevas del equipo de monitoreo.',
      sugerencia: 'Revisar energía, red WiFi y conexión del equipo. Si el equipo está apagado, avisar al técnico.'
    },
    ciclaje_presion_baja: {
      nombre: 'Ciclaje por baja presión (posible fuga)',
      gravedad: 'alarma',
      titulo: 'Ciclaje por baja presión de succión',
      detalle: 'La presión de succión cae a su mínimo, sube 20 PSI o más y vuelve a caer repetidamente. El mínimo está por debajo de lo esperado para el refrigerante.',
      sugerencia: 'Buscar fugas en el circuito, revisar carga de refrigerante, presostato de baja y válvula de expansión. Si no aparece fuga, revisar también el contactor y los arranques del compresor.'
    },
    contactor_defectuoso: {
      nombre: 'Arranques repetitivos por contactor',
      gravedad: 'alarma',
      titulo: 'Arranques repetitivos del compresor',
      detalle: 'La presión de succión repite subidas y bajadas de 20 PSI o más en pocos minutos, sin que el mínimo esté claramente por debajo de lo esperado. El patrón puede corresponder a un contactor, relé o control de arranque defectuoso.',
      sugerencia: 'Revisar contactor, relé de arranque, protección térmica, borneras y alimentación del compresor. No manipule el equipo sin tomar las medidas de seguridad.'
    }
  }
};
