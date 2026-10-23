# Disponibilidad por lotes: implementación y verificación

Fecha: **23 de octubre de 2026**, America/Bogota.

**Resultado:** implementada y verificada localmente la generación de turnos
por lotes desde el portal administrativo. Pasaron TypeScript, ESLint,
**446 pruebas en 38 archivos** y la exportación web. El navegador y el cliente
real se comprobaron contra una simulación local del contrato **OpenAPI 0.9.0**,
con identidades y agendas ficticias. **La publicación de este incremento y su
aceptación con el servicio real siguen pendientes** en este corte.

## Base y alcance

Checkout activo: `grownupsvet-frontend`, rama `main`, commit base
**`2d4f894256899d7399c94412cc055bba0357cb9b`**. Las comprobaciones corresponden
al árbol local que añade este incremento; no equivalen a probar solamente
ese commit ni acreditan un commit nuevo publicado.

El trabajo continúa la [gestión individual de disponibilidad](verificacion-disponibilidad-2026-10-23.md)
y el [plan de lotes](plan-lotes-disponibilidad-2026-10-23.md). Aporta a
[SCRUM-37](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-37),
su historia [SCRUM-11](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-11)
y la validación [SCRUM-38](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-38).
En la consulta realizada, 37 está Por iniciar, 11/38 En curso y 36/78
Finalizado. La subtarea 37 no tiene descripción; se utilizaron los criterios
del padre, la validación y el contrato vigente. No se modificaron estados,
comentarios ni asignaciones de Jira.

La [selección saneada de Jira](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/jira-seleccion.json)
conserva las fuentes y distingue criterios explícitos de recomendaciones.
El backend y el OpenAPI consultado no se modificaron para añadir esta interfaz.

## Comportamiento implementado

El recorrido es **Administrador → Veterinarios → detalle → Gestionar
disponibilidad → Generar lote de turnos**. Requiere
`VETERINARIAN_AVAILABILITY_MANAGE` y un veterinario activo; el backend conserva
la autorización definitiva. No se concede esta gestión a otros roles por
herencia.

- Fechas inicial y final inclusivas, entre 1 y 31 fechas; días ISO únicos del
  1 al 7 y una franja diaria sobre cuadrícula de 30 minutos.
- Entre 1 y 1000 turnos. Todos los inicios realmente generados deben ser
  futuros en Bogotá. No se rechaza por sí sola una frontera inicial pasada
  si solo se generan días futuros; no se aplica la ventana del propietario
  de mañana a 60 días.
- Fin diario exclusivo: `24:00` solo puede usarse al terminar la jornada y
  representa las 00:00 del día siguiente. No crea otro turno que comience
  a esa hora dentro de la misma fecha.
- Vista previa con cantidad y desglose por fecha, seguida de confirmación.
  La previsión no consulta conflictos ni reserva horarios. Tras un éxito,
  el resultado se presenta como **Selección confirmada**, separado de la
  previsión y de la consulta posterior del estado vigente.
- Una sola petición al endpoint existente
  `POST /api/v1/veterinarians/{veterinarianId}/availability-slot-batches`,
  con `startDate`, `endDate`, `daysOfWeek`, `dailyStartTime` y `dailyEndTime`.
  No se divide la selección en altas individuales ni se omiten colisiones.
  El contrato establece creación atómica: un conflicto, incluso con un turno
  bloqueado, rechaza el conjunto.
- Validación estricta del HTTP 201 y del resultado
  `{createdCount,items,timeZone}`: cantidad completa, veterinario, identidad
  de turnos, horarios esperados, estado y zona horaria. Un cuerpo vacío,
  malformado o incompatible no se muestra como éxito.
- Pérdida de respuesta, HTTP 408/5xx o éxito incompatible producen resultado
  incierto. El formulario conserva y bloquea sus datos y el envío; no
  repite el POST. La consulta posterior recorre todas las fechas y páginas
  del rango, sin filtrar por estado. Volver al formulario mantiene el bloqueo.
- La lectura muestra horarios previstos publicados, bloqueados, no
  encontrados y otros turnos actuales. **Encontrar un turno no demuestra
  que lo creó el intento incierto**: no existe identificador de lote ni
  clave idempotente que permitan esa atribución. La lectura secuencial de
  páginas tampoco constituye una fotografía transaccional del rango.

Las mutaciones y lecturas capturan el contexto de sesión; las continuaciones
de una sesión anterior o de una pantalla abandonada se descartan. El
cliente comprueba nuevamente la sesión después del consumo asíncrono del
cuerpo de la respuesta.

## Comprobaciones automatizadas y HTTP

| Comprobación                 | Resultado y evidencia                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`              | TypeScript y ESLint correctos; **446 pruebas en 38 archivos**, salida 0. [Registro local](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/check.log).                                                                                                                                                                                                                     |
| Pruebas nuevas               | **56 casos en tres archivos** para calendario/tamaño, contrato de creación y conciliación, y presentación de resultados. Cubren 31 fechas, 1000 turnos, `24:00`, días seleccionados futuros, errores de respuesta, incertidumbre y cambio de sesión durante la lectura del cuerpo. Están incluidos en las 446; no se suman otra vez.                                                                   |
| `npm run web:build`          | Exportación y preparación web correctas, salida 0. Bundle local final `index-eddb6619accf694cd3acc8c7e55a4772.js`. [Registro local](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/web-build.log).                                                                                                                                                                       |
| Verificador HTTP de contrato | **303 peticiones verificadas**; **256** con validación de respuesta contra esquemas del OpenAPI 0.9.0. Las otras 47 corresponden a fixtures o fallos controlados identificados, sin atribuirles conformidad de esquema. [Informe local](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/http-verification.json).                                                          |
| Cliente real por HTTP        | **Seis comprobaciones adicionales mediante 13 peticiones de producto**. Incluyen medianoche, rechazo atómico con conflicto tardío, 144 turnos consultados en dos páginas sin filtro y respuestas perdidas, vacías, malformadas o con 408 después de aplicar la escritura. [Informe local](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/client-http-verification.json). |

Las cifras describen conjuntos distintos: pruebas del proyecto, verificador
de contrato y comprobaciones del cliente por HTTP. No se suman como si
fueran casos unitarios ni recorridos de interfaz. Los avisos de tipo de
módulo de ESLint y variables de color del build no impidieron los gates.

La revisión independiente contrastó modelo, API y UI con el contrato y los
criterios de Jira. Se corrigieron durante ella la comprobación explícita de
201, la validación del tipo de contenido, las guardas tras leer el cuerpo
y la distinción entre previsión y selección confirmada. No quedaron
hallazgos bloqueantes en ese corte.

## Recorridos observados en navegador

Se utilizó la exportación web local en **8085**, con el gateway dirigido a la
simulación **4900**. Se usaron exclusivamente datos ficticios.

| Recorrido                                | Resultado observado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Revisión y publicación                   | Rango del **25 al 27/10/2026**, seleccionando domingo y martes, de **23:30 a 24:00**. La revisión mostró dos turnos en dos fechas. El 201 confirmó el conjunto y la consulta encontró ambos. [Confirmación](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/lote-confirmacion.png) y [resultado](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/lote-publicado.png).                                                                                                                                                                                                                                                                                          |
| Colisión y atomicidad del sustituto      | Para el **25/10**, la selección **23:00–24:00** colisionó con el turno de 23:30 anterior. El 409 rechazó todo el lote: la agenda conservó un único turno y no apareció uno nuevo de 23:00. [Captura](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/lote-conflicto.png).                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Respuesta perdida                        | Desde una agenda filtrada por Bloqueado se prepararon **29–31/10**, jueves/viernes/sábado, **00:00–24:00**: 144 turnos. El sustituto aplicó el lote y cortó la respuesta; el gateway devolvió 502. La UI bloqueó campos y revisión. [Captura](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/lote-respuesta-perdida.png).                                                                                                                                                                                                                                                                                                                                                                  |
| Consulta completa del resultado incierto | Se consultaron dos páginas sin filtro de estado y se encontraron los **144 horarios previstos, cero no encontrados**, sin atribuir su creación al intento. No hubo reenvío del POST. Volver al formulario conservó el bloqueo. [Consulta](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/lote-reconciliado.png).                                                                                                                                                                                                                                                                                                                                                                           |
| Teclado                                  | Space activó el checkbox nativo; Tab mostró foco. Enter abrió el diálogo con Cancelar enfocado. Tab/Shift+Tab recorrieron su ciclo, Escape lo cerró y devolvió el foco al origen; Enter permitió confirmar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Presentación móvil final                 | A **390 × 844**, formulario y consulta tuvieron ancho desplazable de 390 px, sin desbordamiento horizontal observado. Las etiquetas de días usaron fuente del sistema a **18 px**. Se observó un diálogo de **1 turno en 1 fecha seleccionada**, con Cancelar visible/enfocado; Escape volvió a la revisión y la cancelación no añadió un POST. [Formulario final](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/formulario-final-movil.png), [diálogo final](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/confirmacion-final-movil.png) y [consulta móvil](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/lote-movil.png). |
| Consola y salida                         | Las consultas finales de advertencias y errores de consola devolvieron listas vacías. Se comprobó el cierre de sesión.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

La [auditoría final saneada del navegador](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-lotes-2026-10-23/browser-request-audit.json)
contiene **19 eventos HTTP completos: 18 de API y uno de fixture**. Conserva
solo fecha UTC, método, ruta y estado, sin cuerpos, cabeceras, credenciales
ni tokens. No son 19 recorridos de interfaz y no equivalen a las 13 peticiones
del verificador independiente del cliente.

El POST cuya respuesta se cortó no genera un evento HTTP completo del mock
y no se añade a esa cifra. El corte se acredita mediante el 502 del gateway,
la pantalla de resultado incierto y la lectura posterior de 144 turnos.
Ese 502 es un fallo inyectado después de una escritura, no una respuesta
atribuida al contrato del backend.

## Límites y publicación pendiente

La simulación demuestra el comportamiento del frontend y la coherencia del
sustituto con el contrato usado. No acredita transacciones, bloqueos o
concurrencia reales en PostgreSQL, firma JWT de producción, integración
aceptada con cuentas reales ni entrega de correos. El sustituto recibe JSON
interpretado y no demuestra la distinción léxica del parser real entre
`1`, `1.0` y `1e0`.

Las observaciones de teclado, foco, semántica y ancho móvil no constituyen
conformidad formal de accesibilidad. Siguen pendientes lector de pantalla,
ampliación y evaluación con personas usuarias, además de Android/iOS,
instalación y funcionamiento sin conexión de la PWA.

No se añadieron gestión administrativa de citas, cancelación/reprogramación
del propietario, clínica P3, endpoints, migraciones, dependencias o cambios
de reglas del backend. No se declara terminada una historia de Jira por
publicar código.

**Commit, push y despliegue del lote quedan pendientes en este informe.** La
[publicación anterior](publicacion-cloudflare-2026-10-23.md) conserva su
propio commit y alcance, que no incluyen este incremento. La publicación
nueva deberá acreditarse mediante su commit, gate remoto, despliegue y
comprobaciones HTTPS; un fingerprint local no sustituye esa evidencia.

Los informes y capturas enlazados son artefactos locales fuera del
repositorio, bajo `output/frontend-lotes-2026-10-23`. No se presentan como
URLs públicas.

## Reproducción local

Desde la raíz, `npm run check` y `npm run web:build` reproducen los gates del
código y la exportación. La [guía Postman](../postman/README.md) describe
cómo iniciar la simulación local. Sin otro recorrido usando esos datos:

```powershell
python postman/scripts/verify_roles_http.py `
  --spec '..\GrownupsVet\grownupsvet-backend\docs\openapi\openapi.json'
node postman/scripts/verify_availability_batch_client_http.mjs
```

Los verificadores reinician los datos ficticios; no deben ejecutarse durante
una sesión de navegador que dependa de ellos ni dirigirse al servicio real.
