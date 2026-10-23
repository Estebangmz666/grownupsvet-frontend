# Citas administrativas: implementación y verificación

Fecha: **23 de octubre de 2026**, `America/Bogota`.

**Resultado:** implementadas la consulta administrativa de agenda, detalle e
historial y las decisiones de confirmar/rechazar solicitudes. Pasaron
TypeScript, ESLint, **552 pruebas en 40 archivos** y la exportación web local.
Las comprobaciones HTTP y de navegador usaron exclusivamente datos ficticios
y una simulación local derivada del contrato **OpenAPI 0.9.0**.
**Commit, push y despliegue de este incremento siguen pendientes en este corte.**

## Base y alcance

Se conserva el checkout activo, rama `main`, con commit base
`b7b735a3abee14f9a596bb9568856e1c552cc03b`. La evidencia corresponde al árbol
local que añade este incremento, no a un nuevo commit publicado.

El trabajo desarrolla el [plan de citas administrativas](plan-citas-administrativas-2026-10-23.md)
y aporta a [SCRUM-41](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-41),
su historia [SCRUM-12](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-12)
y la validación [SCRUM-42](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-42).
La [selección saneada de Jira](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/jira-seleccion.json)
conserva requisitos, estados consultados y límites de la investigación.
No se modificaron estados, comentarios ni asignaciones de Jira.

La [comparación de contrato](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/contrato-citas-admin.json)
contrasta rutas y esquemas de citas del servicio con HEAD y árbol local del
backend `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`; no afirma igualdad del
documento completo ni convierte la lectura del OpenAPI en prueba autenticada
del servicio. Este incremento no implementa endpoints ni reglas del backend.

## Comportamiento implementado

El administrador puede abrir **Citas** dentro del portal existente.
`APPOINTMENT_READ_ALL` habilita lectura y `APPOINTMENT_MANAGE` las decisiones;
un administrador con solo consulta no recibe controles de gestión ni necesita
acceso a Veterinarios. La autorización definitiva permanece en el backend.

- Agenda con fechas locales inclusivas de 1 a 31 días, estado opcional y
  paginación real. El formulario preparado y la consulta aplicada son
  independientes: editar fechas/estado no cambia los resultados hasta consultar.
- Detalle con mascota, propietario, teléfono autorizado, veterinario, motivo,
  horario de Bogotá, estado funcional y asignación independiente. El DTO
  ordinario no contiene correo y no se solicita un endpoint de revelación.
- Historial paginado en el orden ascendente del servidor por instante e
  identificador, con actor/tipo, estados, versión y motivo disponibles.
  La paginación mantiene un destino de foco estable al terminar su lectura.
- Confirmación y rechazo de `REQUESTED` con `expectedVersion`. Confirmar
  revalida el inicio futuro; el servidor comprueba además el corte persistido,
  los participantes y el turno. El cliente no codifica 06:00 como corte exacto:
  ese dato no se expone en el DTO y se conserva por solicitud.
- Rechazo con motivo no blanco de hasta 1000 caracteres enviados, respetando
  la normalización Java y Unicode. Una solicitud pasada todavía `REQUESTED`
  conserva la opción de rechazo; no hereda el límite temporal de confirmar.
- Un envío pendiente bloquea otro envío inmediato y el cambio de sección.
  Los conflictos exigen volver a consultar detalle e historial antes de
  decidir con los datos actuales. No se actualiza una versión silenciosamente
  para repetir la decisión anterior.
- Pérdida de respuesta, 408/5xx o éxito incompatible producen resultado
  incierto, sin éxito aparente ni reenvío automático. La lectura posterior
  muestra el estado vigente y no atribuye su autoría al intento perdido.
- Operaciones y lecturas capturan contexto de sesión; se descartan respuestas
  tardías tras salir o cambiar de sesión, también después de leer el cuerpo.

Se utilizan únicamente `GET /api/v1/appointments`, detalle, `/events` y
`PATCH /api/v1/appointments/{appointmentId}/status`. Este último ofrece
`CONFIRMED` o `REJECTED` y valida HTTP 200, identidad, estado y versión de
respuesta. El replay del backend es limitado a la intención/actor/versión
compatibles; no equivale a una clave idempotente general.

## Comprobaciones automatizadas y HTTP

| Comprobación                              | Resultado y evidencia local                                                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                           | TypeScript y ESLint correctos; **552 pruebas en 40 archivos**, salida 0. [Registro](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/check.log).                                                                                        |
| `npm run web:build`                       | Exportación y preparación web correctas, salida 0. Bundle Windows `index-4737f7261b50f67db9b17c2f1974bb9e.js`. [Registro](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/web-build.log).                                              |
| Regresión HTTP previa                     | **303 peticiones** satisfactorias contra el sustituto local. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/regression-http-verification.json).                                                                             |
| Verificador HTTP de citas administrativas | **50 peticiones**, **46 respuestas validadas contra esquemas** del OpenAPI real; las restantes son controles explícitos de simulación. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/appointments-http-verification.json). |
| Cliente actual por HTTP                   | **10 comprobaciones mediante 26 peticiones de producto**, compilando y ejecutando el cliente del árbol actual contra la simulación. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/client-http-verification.json).          |

Las cifras pertenecen a conjuntos diferentes; no se suman como pruebas
unitarias ni como recorridos completos de interfaz. La revisión independiente
contrastó las reglas y detectó ajustes de actor/motivo inicial, normalización
Java, validación de errores y foco del historial, que se corrigieron.

## Recorridos observados en navegador

Se probó la exportación web en **8085**, con gateway hacia la simulación **4900**.

| Recorrido                   | Resultado observado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consulta preparada/aplicada | Cambiar el borrador al 24/10 no alteró la consulta aplicada del 23/10. Al aplicar el día siguiente se observaron **25 citas en páginas de 20 y 5**. La necesidad de reasignación se mostró separada del estado funcional.                                                                                                                                                                                                                                                                                                                                                                |
| Confirmación                | Nala, solicitud 22, identificador terminado en `024`: respuesta válida, estado `CONFIRMED` y evento de confirmación en el historial. [Captura móvil](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/cita-confirmada-movil.png).                                                                                                                                                                                                                                                                                                                      |
| Rechazo                     | Nala, solicitud 24, identificador terminado en `026`: se exigió motivo; durante una demora controlada de cinco segundos quedaron bloqueadas las pestañas. El resultado fue `REJECTED` con el motivo registrado en historial. [Captura](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/cita-rechazada-movil.png).                                                                                                                                                                                                                                     |
| Conflicto de versión        | Luna, solicitud 21, identificador terminado en `023`: una fixture adelantó 21 versiones y produjo 22 eventos. El PATCH con la versión anterior devolvió **409**, sin éxito; las acciones permanecieron bloqueadas hasta consultar nuevamente detalle e historial. [Conflicto](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/conflicto-version-movil.png).                                                                                                                                                                                           |
| Paginación del historial    | Se consultó la segunda página y se comprobó el traslado de foco al encabezado estable del historial, sin mostrar eventos anteriores durante la carga. [Página 2 móvil](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/historial-pagina-2-movil.png).                                                                                                                                                                                                                                                                                                 |
| Respuesta perdida           | Luna, solicitud 23, identificador terminado en `025`: el sustituto aplicó la confirmación y cortó la respuesta; el gateway devolvió **502**. La pantalla bloqueó decisiones y no reenvió el PATCH. La consulta posterior mostró `CONFIRMED` y dos eventos, con texto que conserva la incertidumbre sobre el intento. [Fallo](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/respuesta-perdida-movil.png) y [consulta posterior](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/consulta-tras-perdida-movil.png). |
| Teclado y diálogo           | Enter abrió el diálogo con Cancelar enfocado; Tab/Shift+Tab recorrieron su ciclo. Escape cerró el diálogo y restauró el foco al disparador.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Solo consulta               | Login mediante fixture local de administrador con lectura y recarga de sesión: GET autorizado, entrada Citas disponible, sin sección Veterinarios ni acciones de confirmar/rechazar. Se comprobó cierre de sesión en ambas modalidades.                                                                                                                                                                                                                                                                                                                                                  |
| Móvil y consola             | Viewport **390×844**, ancho desplazable del DOM **390 px**, sin desbordamiento horizontal observado; las capturas móviles miden **390×843**. Las consultas finales de advertencias y errores de consola tras la recarga devolvieron listas vacías.                                                                                                                                                                                                                                                                                                                                       |

La captura [solo consulta](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/solo-consulta-movil.png)
acredita únicamente la navegación de esa modalidad; no se utiliza como
evidencia visual del detalle o de sus controles. Las observaciones anteriores
de permisos incluyen la inspección de la interfaz y las peticiones autorizadas.

## Auditoría y límites de la evidencia

Al finalizar, los servidores locales 4900/8085 quedaron detenidos. El
coordinador confirmó a las **14:16:31 UTC** que las huellas de los 33 archivos
backend seguidos permanecían iguales al corte inicial, conservando el trabajo
previo ajeno a este incremento.

La [auditoría saneada del navegador](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/browser-request-audit.json)
contiene **63 eventos completos**: 33 GET de producto, dos PATCH 200 y un
PATCH 409, dos POST de login, 23 controles de fixture y dos cierres de sesión.
No son 63 recorridos. El PATCH cuya respuesta se cortó no tiene evento HTTP
completo en esa auditoría y no se añade a la cifra. El
[registro del gateway](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/gateway-browser.log),
el 502, la pantalla de incertidumbre y la lectura posterior documentan ese fallo.
El 502 es una consecuencia inyectada del corte, no una respuesta atribuida
al contrato del backend.

La simulación conserva datos en memoria, sin PostgreSQL, transacciones,
bloqueos ni concurrencia SQL reales. Sus citas ficticias no enlazan una
reserva persistente con todos los turnos del módulo de disponibilidad:
estos recorridos no prueban liberación real de ocupación o nueva reserva.
Las fixtures modifican estados deliberadamente y no son endpoints de producción.
El sustituto tampoco acredita el sondeo/configuración persistente del corte,
colas de avisos, despacho SMTP, recordatorios o entrega de correo.

Las pruebas de navegador y cliente acreditan el comportamiento local del
frontend ante esas respuestas. No certifican autenticación productiva,
aceptación integrada con cuentas reales, concurrencia de persistencia ni
revisión compartida de los tres integrantes exigida por Jira.
Las observaciones de teclado, foco y tamaño móvil no son una certificación
formal de accesibilidad.

## Publicación y trabajo pendiente

**Este informe deja pendientes commit, push, gate remoto y despliegue del
incremento de citas administrativas.** El fingerprint local no prueba qué
bundle está publicado. La [publicación histórica](publicacion-cloudflare-2026-10-23.md)
conserva su propio alcance; el nuevo despliegue necesita evidencia separada
de commit, estado remoto, Pages y comprobación HTTPS.

No se incluyen cancelación, reprogramación, reasignación ni inasistencia de
SCRUM-45, autoservicio del propietario, clínica ni cambios de reglas backend.
La mejora de [plantillas de correo](pendientes-proyecto.md) sigue pendiente
por separado. Publicar esta interfaz no declara terminadas SCRUM-12/42 ni
sustituye su aceptación integrada.

Los informes y capturas enlazados viven localmente fuera del repositorio en
`output/frontend-citas-admin-2026-10-23`; no se presentan como URLs públicas.
