# SupervisionMercado · Flota de refrigeración

Prototipo de consola para supervisar **20 equipos de refrigeración** de un hipermercado. Muestra únicamente la **temperatura del espacio refrigerado** y las fallas que necesitan atención; las otras temperaturas y presiones quedan disponibles en el detalle de cada equipo.

No usa Supabase ni ningún backend: los equipos y las fallas se guardan en `localStorage` del navegador y las lecturas se generan con un motor de simulación.

> El panel anterior de un solo equipo sigue disponible en `../supervision/` como versión legada. El prototipo nuevo vive en esta carpeta `flota/`.

---

## Cómo abrirlo

No requiere instalación, compilación ni dependencias.

1. Sirve la carpeta raíz del proyecto con un servidor estático. Por ejemplo, desde la raíz:

   ```bash
   python -m http.server 8788
   ```

2. Abre:

   ```text
   http://localhost:8788/flota/
   ```

También se puede abrir `flota/index.html` directamente con `file://`, pero un servidor local evita restricciones del navegador y se parece más al entorno real.

### Enlaces de prueba

| Enlace | Resultado |
| --- | --- |
| `/flota/#eq-03` | Abre el detalle del equipo `eq-03` |
| `/flota/?crear=1` | Abre el formulario “Crear cuadro” |
| `/flota/?registro=1` | Abre el registro completo de fallas |

---

## Qué muestra la pantalla principal

- **20 tarjetas**, una por equipo, ordenadas por gravedad: alarma → sin datos → aviso → sugerencia → normal.
- Cada tarjeta muestra solo:
  - nombre del equipo y ubicación;
  - tipo (LBP/MBP/HBP) y refrigerante;
  - temperatura del espacio;
  - objetivo configurado;
  - estado y mensaje principal;
  - una pequeña sparkline de la temperatura del espacio.
- **Resumen** con filtros por estado: todos, alarmas, avisos, sugerencias, sin datos y normales.
- **Buscador** por nombre, pasillo, tipo, refrigerante, expansión, compresor o lubricante.
- **Detalle del equipo** al hacer clic en una tarjeta:
  - temperatura del espacio y rango normal;
  - diagnóstico con alertas activas, detalle y sugerencia;
  - botón **Reconocer** para las alertas activas;
  - sección plegable **Variables de proceso** con las 5 temperaturas y las 2 presiones;
  - recalentamiento, subenfriamiento y relación de compresión calculados;
  - ficha técnica del equipo;
  - historial de fallas del equipo;
  - modo simulación para aplicar o corregir una falla;
  - botón **Eliminar cuadro** con confirmación, que borra el equipo y su historial de alertas.
- **Registro de fallas** global con filtros por estado y por equipo, y exportación a CSV.

Las variables de proceso están en segundo plano: no se muestran en la tarjeta principal, solo dentro del detalle.

---

## Variables simuladas

Cada equipo genera una lectura cada **3 segundos**:

| Variable | Descripción |
| --- | --- |
| `temp1` | Temperatura de succión |
| `temp2` | Temperatura del evaporador / espacio (sensor por defecto) |
| `temp3` | Temperatura de descarga |
| `temp4` | Temperatura de líquido |
| `temp5` | Temperatura ambiente |
| `presion_baja` | Presión de succión, en PSI |
| `presion_alta` | Presión de descarga, en PSI |

El sensor de espacio se puede cambiar al crear un cuadro en **Opciones avanzadas**. Por defecto es `temp2`. El motor de diagnóstico siempre usa las 7 variables, independientemente de cuál se muestre como temperatura del espacio.

Las presiones se obtienen con tablas P-T aproximadas y demostrativas para estos refrigerantes:

`R-404A`, `R-448A`, `R-449A`, `R-507A`, `R-134a`, `R-22`, `R-410A`, `R-32`, `R-290` y `R-717`.

> **Importante:** las tablas P-T y los límites son aproximados y sirven para demostrar el flujo de diagnóstico. No son valores certificados de fabricante ni reemplazan la documentación del equipo.

---

## Tipos de equipo y límites

Cada tipo tiene un objetivo por defecto y márgenes de aviso/alarma alrededor de ese objetivo:

| Tipo | Nombre | Objetivo por defecto | Aviso alto | Alarma alta | Aviso bajo | Alarma bajo |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `LBP` | Baja temperatura | −18 °C | +3 °C | +6 °C | −4 °C | −7 °C |
| `MBP` | Media temperatura | 2 °C | +4 °C | +6 °C | −4 °C | −7 °C |
| `HBP` | Alta temperatura | 10 °C | +3 °C | +5 °C | −4 °C | −6 °C |

Ejemplo: un `LBP` con objetivo −18 °C tiene aviso alto desde −15 °C y alarma alta desde −12 °C.

Además se evalúan:

- **Descarga del compresor:** aviso desde 90 °C y alarma desde 105 °C para lubricante sintético; con lubricante mineral, aviso desde 85 °C y alarma desde 100 °C.
- **Relación de compresión:** aviso por encima de 10:1 y alarma por encima de 13:1.
- **Recalentamiento:** rango esperado de 2 a 15 K; fuera de ese rango se genera una sugerencia.
- **Subenfriamiento:** rango esperado de 2 a 10 K; fuera de ese rango se genera una sugerencia.
- **Ciclaje de presión de succión:** se toma como referencia la presión mínima de los últimos 12 minutos. Si el mínimo se repite y la presión sube 20 PSI o más antes de volver a bajar, se analiza como posible fuga o problema de contactor.
- **Aumento repentino de temperatura del espacio:** aviso si sube 5 °C o más en la ventana de 15 minutos.
- **Aumento repentino de temperatura ambiente:** aviso si sube 4 °C o más en la ventana de 15 minutos.
- **Frescura de la lectura:** aviso a los 45 segundos sin datos y alarma a los 3 minutos sin datos.
- **Equipo sin señal:** se muestra como estado “Sin datos” y no se mezcla con las demás alertas del equipo.

Los umbrales están en `js/config.js` para poder ajustarlos.

### Detección de ciclaje y baja presión

El diagnóstico de presión no usa solo un umbral fijo:

1. Toma la **presión de succión más baja de los últimos 12 minutos** y la usa como línea base.
2. Busca ciclos completos: la presión baja al mínimo, sube al menos **20 PSI** y vuelve al mínimo.
3. Exige al menos **3 ciclos**, con una duración de **25 a 120 segundos**, y que el último haya terminado en los últimos **3 minutos**.
4. Compara el mínimo con la presión de saturación esperada para el objetivo del equipo:
   - si está **5 PSI o más por debajo**, genera **“Ciclaje por baja presión (posible fuga)”**;
   - si está cerca de lo esperado, genera **“Arranques repetitivos del compresor”**, asociado a contactor, relé o control de arranque.

En el detalle del equipo, dentro de **Variables de proceso**, se muestran la **P. succión mínima** y los **ciclos de succión** detectados. Esto es una ayuda de diagnóstico: no reemplaza una prueba de fugas ni una revisión eléctrica del contactor.

---

## Estados de una falla

Las fallas no se borran al corregirse. Cada falla conserva su serie y su historial:

```text
activa ──(Reconocer)──> reconocida ──(deja de cumplirse)──> corregida
   ^                                                        │
   └────────── reaparición dentro de 30 minutos ────────────┘
```

- **Activa:** la condición se está cumpliendo.
- **Reconocida:** el operador ya la vio, pero sigue visible hasta que la condición desaparezca.
- **Corregida:** la condición dejó de cumplirse. La falla queda en el historial con hora de inicio, hora de fin y duración.
- **Reaparición:** si la misma falla vuelve dentro de los **30 minutos** posteriores a la corrección, se reabre la **misma alerta** y se incrementa el contador de reapariciones. No se crea una fila nueva.
- **Antirrebote:** una condición debe mantenerse durante 2 ciclos (unos 6 segundos) antes de abrir una alerta nueva o cerrar una existente.

El registro completo se puede filtrar por estado y por equipo, y exportar en CSV.

---

## Crear un cuadro

El botón **Crear cuadro** abre un formulario con:

- nombre del cuadro;
- ubicación;
- refrigerante;
- expansión: termostática, electrónica o capilar;
- tipo: LBP, MBP o HBP;
- temperatura objetivo;
- lubricante: POE, mineral, PAG o PVE;
- opciones avanzadas: tipo de compresor y sensor de espacio.

Al crearlo, el equipo se agrega a la flota, se le genera un historial inicial y se abre su detalle. El título de la cabecera cambia automáticamente a la cantidad real de equipos.

---

## Controles de simulación

En la barra superior:

- **Pausar / Reanudar:** detiene o reanuda la generación de lecturas.
- **Provocar falla:** elige un equipo sin falla y le aplica una falla aleatoria.
- **Reiniciar:** vuelve a los 20 equipos de ejemplo y borra los cuadros y fallas creados. Pide confirmación.

Dentro del detalle de un equipo:

- **Aplicar:** aplica la falla seleccionada al equipo.
- **Corregir:** retira la falla simulada; la alerta pasa a “corregida” y se conserva el episodio.
- **Eliminar cuadro:** pide confirmación y quita el equipo de la flota, junto con sus lecturas y su historial de alertas. Esta acción no se puede deshacer; **Reiniciar** recupera los 20 equipos de ejemplo, pero también borra los cuadros creados.

Las fallas disponibles para simular son:

- temperatura alta en el espacio;
- temperatura baja en el espacio;
- descarga del compresor alta;
- aumento repentino de temperatura ambiente;
- aumento repentino de temperatura del espacio;
- relación de compresión alta;
- recalentamiento bajo o alto;
- subenfriamiento bajo o alto;
- ciclaje por baja presión, con mínimo bajo y pulsos de presión;
- arranques repetitivos por contactor, con pulsos más rápidos;
- equipo sin señal.

---

## Datos de ejemplo

La simulación arranca con 20 equipos. Algunos vienen con fallas para que se pueda ver el flujo completo:

| Equipo | Falla inicial |
| --- | --- |
| `eq-03` · Helados · Mural 1 | Temperatura alta en el espacio |
| `eq-07` · Lácteos · Mural 1 | Descarga del compresor alta |
| `eq-12` · Charcutería | Aumento repentino de temperatura ambiente |
| `eq-15` · Delicatessen | Recalentamiento bajo |
| `eq-18` · Cárnicos · Cámara 1 | Equipo sin señal |
| `eq-20` · Postres · Vitrina | Ciclaje por baja presión (posible fuga) |

También se siembran alertas históricas ya corregidas para `eq-02`, `eq-05`, `eq-09`, `eq-14` y `eq-19`, de modo que el registro no empieza vacío.

---

## Persistencia local

Se usan dos claves de `localStorage`:

| Clave | Contenido |
| --- | --- |
| `hiper_flota_equipos_v1` | Equipos creados y fallas simuladas activas |
| `hiper_flota_alertas_v1` | Alertas, estados, historial y reapariciones |

Para empezar de cero sin usar el botón **Reiniciar**, abre la consola del navegador y ejecuta:

```js
localStorage.removeItem('hiper_flota_equipos_v1');
localStorage.removeItem('hiper_flota_alertas_v1');
location.reload();
```

Las lecturas y el historial de proceso no se guardan en `localStorage`; se regeneran al cargar la página.

---

## Estructura

```text
flota/
├── index.html              Estructura de la consola
├── css/
│   └── estilos.css         Diseño, tarjetas, drawer, modales y responsive
└── js/
    ├── config.js           Tipos, refrigerantes, tablas P-T, límites y catálogo de fallas
    ├── simulacion.js       Generación de lecturas, diagnóstico, estados y persistencia
    └── app.js              Render de la interfaz, filtros, drawer, modales y eventos
```

### API interna de simulación

`window.FLOTA` expone funciones útiles para pruebas desde la consola:

```js
FLOTA.equipos();                 // lista de equipos
FLOTA.equipo('eq-03');           // un equipo por id
FLOTA.alertas();                 // todas las alertas
FLOTA.resumen();                 // conteo por estado
FLOTA.estadoEquipo(equipo);      // estado calculado de un equipo
FLOTA.proceso(equipo);           // última lectura + derivados
FLOTA.reiniciar();               // vuelve a los 20 equipos de ejemplo
FLOTA.provocarFallaAleatoria();  // aplica una falla aleatoria
FLOTA.exportarCSV();             // devuelve el CSV como texto
```

---

## Responsive

La consola está pensada para escritorio, pero se adapta a tablet y móvil:

- escritorio ancho: varias columnas de tarjetas;
- ancho medio: dos columnas;
- móvil: una columna, cabecera y controles apilados, y drawer a pantalla completa.

Las capturas de referencia usadas durante el desarrollo están en `%TEMP%\opencode\flota-*.png`.

---

## Limitaciones y siguiente paso

Este prototipo es una simulación local. Para llevarlo a datos reales falta:

- una fuente de lecturas reales con `equipo_id` (en Supabase, `lecturas_hvac` no tiene ese campo actualmente);
- la lista real de equipos, refrigerantes, aceites y límites de fabricante;
- tablas P-T certificadas;
- autenticación y roles (operador, técnico, supervisor);
- persistencia centralizada para que varios usuarios vean el mismo registro;
- notificaciones y auditoría de reconocimientos.

Mientras eso no esté disponible, `flota/` permite validar la experiencia, el diagnóstico y el flujo de fallas sin tocar la base de datos.
