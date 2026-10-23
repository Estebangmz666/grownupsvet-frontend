# Incremento: cambios administrativos de citas

Fecha: **23 de octubre de 2026**, `America/Bogota`. Este plan define el
siguiente incremento; sus comprobaciones y publicación se acreditarán aparte.

## Selección y base

Se continúa [SCRUM-45](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-45)
sobre el detalle administrativo entregado en el commit frontend
`a9982e952b6b7555fc1c23798abd5039cd87c83e`. La subtarea sigue Por iniciar, sin
descripción ni comentarios. Su historia
[SCRUM-13](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-13) y
validación [SCRUM-46](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-46)
están En curso; backend SCRUM-43 Finalizado y portal propietario SCRUM-44
Por iniciar. Los textos de Jira conservan cortes históricos y no certifican
por sí solos el estado actual de las interfaces.

Se incluye la **reasignación excepcional**: SCRUM-43 contempla reasignar la
ocupación y el backend exige esa operación ante `NEEDS_REASSIGNMENT`.
La reprogramación normal devuelve `APPOINTMENT_REASSIGNMENT_REQUIRED` para
esa marca. Son recorridos distintos dentro del mismo incremento.

La [selección Jira saneada](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/jira-seleccion.json)
conserva las ocho incidencias consultadas, requisitos y comentarios completos.
No se escribieron estados ni comentarios de Jira.

Backend base: `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`. La
[comparación del 23/10 a las 15:28:53 UTC](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/openapi-comparison.json)
confirma igualdad de rutas/esquemas seleccionados entre OpenAPI 0.9.0 real,
HEAD y árbol local; las fuentes seleccionadas coinciden con HEAD.
Se preservan los 33 cambios previos ajenos del backend.
El [resumen de contrato](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/contrato-cambios-citas.json)
contrasta DTO, controladores, `AppointmentService` y `docs/citas-y-agenda.md`.
La descarga pública del contrato no implica pruebas autenticadas o mutaciones reales.

## Alcance y permisos

Ampliar el detalle administrativo existente con cancelación manual,
inasistencia, reprogramación normal y reasignación excepcional; conservar
consulta, confirmación/rechazo, historial y aislamiento de sesión ya implementados.
La lectura mantiene `APPOINTMENT_READ_ALL`; las mutaciones requieren
`APPOINTMENT_MANAGE` y administrador activo. OWNER consulta resultados propios
sin autoservicio de cambios; veterinario y superadministrador no heredan gestión.

| Operación                          | Estado y plazo del origen                                                                                                       | Destino o requisito adicional                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancelar                           | `REQUESTED` o `CONFIRMED`; `ahora < inicio original`.                                                                           | Motivo obligatorio; propietario, mascota y veterinario pueden estar inactivos.                                                                                               |
| Registrar inasistencia             | Solo `CONFIRMED`; `ahora >= fin`.                                                                                               | Motivo obligatorio; sin tolerancia, marcado automático ni requisito de participantes activos.                                                                                |
| Reprogramar                        | `REQUESTED` o `CONFIRMED`, `ASSIGNED`, antes del inicio original; pendiente conserva corte original vigente.                    | Participantes/veterinarios activos, otro turno publicado y libre, mismo u otro veterinario; fecha local desde mañana hasta el día 60 inclusive; acuerdo siempre obligatorio. |
| Reasignar por falta de veterinario | `REQUESTED` o `CONFIRMED`, `NEEDS_REASSIGNMENT`, veterinario original inactivo y `ahora < fin original`; puede haber comenzado. | Propietario/mascota activos y propios; otro veterinario activo y turno publicado/futuro. Acuerdo obligatorio si cambia el inicio.                                            |

En la reasignación, una `CONFIRMED` admite destino futuro del mismo día.
Una `REQUESTED` exige corte original vigente, fecha local de origen no pasada
y destino al menos mañana con su corte aún vigente. El servicio excepcional
**no impone el máximo de 60 días** de la reprogramación normal.
No trasladar indiscriminadamente límites entre estas operaciones.
El corte persistido no se expone en el DTO; el servidor decide su vigencia.

Las transiciones terminales no se reabren. Cancelar/inasistencia conservan
identidad e historial y liberan ocupación según el servicio. Los traslados
conservan UUID, propietario, mascota y estado funcional; reservan destino y
liberan origen atómicamente. Un fallo deja válida la reserva original.

## Contrato y selección de candidatos

Rutas existentes, relativas a `/api/v1`:

| Acción                     | Petición                                                  |
| -------------------------- | --------------------------------------------------------- |
| Cancelar / inasistencia    | `PATCH /appointments/{id}/status` con `{status: CANCELLED | NO_SHOW,expectedVersion,reason}`. |
| Reprogramar                | `POST /appointments/{id}/reschedulings`.                  |
| Reasignar excepcionalmente | `POST /appointments/{id}/veterinarian-reassignments`.     |

Ambos POST requieren `clientRequestId` UUID, `availabilitySlotId`,
`expectedAvailabilitySlotVersion`, `expectedVersion` y motivo no blanco de
hasta 1000 unidades UTF-16 del valor enviado. Se reutiliza la normalización
Java de motivos conservando Unicode y espacios que Java no elimina.

La constancia comprende `agreementChannel` (`PHONE`, `WHATSAPP`, `OTHER`),
`agreementContactedAt` textual ISO 8601 con offset explícito, no posterior al
momento del servidor, y `agreementNote` no blanca de hasta 500 unidades UTF-16.
Reprogramar exige siempre los tres; reasignar los exige si cambia el inicio.
Conservar el mismo horario con otro veterinario permite omitirlos en reasignación.
Registrar la constancia no verifica un contacto externo ni abre WhatsApp.

El selector consulta profesionales activos mediante `GET /veterinarians`
(`VETERINARIAN_MANAGE`) y sus turnos mediante
`GET /veterinarians/{id}/availability-slots?from&to&status=PUBLISHED&page&size`
(`VETERINARIAN_AVAILABILITY_MANAGE`). Cada rango contiene 1–31 fechas Bogotá;
páginas desde cero, tamaño predeterminado 20 y máximo 100.
Recorrer páginas reales; modificar borradores no altera la selección aplicada.
Cambiar profesional, rango o página debe invalidar una selección que dejó
de pertenecer a los datos consultados, sin conservar una versión oculta antigua.

Los turnos publicados son **candidatos**, no una promesa de capacidad:
su DTO no expone ocupación y el servidor vuelve a comprobar turno/mascota.
No inventar `unoccupied` ni usar `GET /availability-slots`, reservado a OWNER.
Un perfil administrativo restringido debe recibir explicación si carece de
permisos para el selector; no ampliar permisos ni sustituir la identidad.
Guardar la versión mostrada del turno. Como la cita no expone `currentSlotId`,
excluir su combinación actual de veterinario/inicio en la agenda fija de 30 minutos.

## Confirmación, replay e incertidumbre

Mostrar revisión de cita original, destino, motivo y acuerdo antes de enviar.
El diálogo conserva Cancelar inicial, ciclo Tab/Shift+Tab, Escape y retorno de
foco. Bloquear doble envío sincrónicamente y cambios de sección durante espera;
preservar el formulario y su intención mientras se conoce el resultado.

PATCH conserva el replay inmediato del mismo actor, transición y motivo
normalizado, con versión actual exactamente `expectedVersion + 1` y evento
humano correspondiente; `DAILY_CUTOFF` de SYSTEM no es cancelación humana.

Cada POST crea una intención estable antes del envío y conserva su UUID y
contenido exactos ante incertidumbre. El replay persistente devuelve **la cita
actual**, incluso si hubo cambios posteriores: validar HTTP 200, identidad y
DTO completo; no exigir siempre destino original, estado anterior o versión+1.
`RESCHEDULING` incluye actor en el fingerprint; `REASSIGNMENT` no lo incluye
en la fuente actual. El frontend conserva su intención dentro de la sesión
capturada y no ofrece reutilizarla automáticamente desde otra sesión.

Ante 409, explicar versión, plazo, asignación, participante, destino ocupado
o clave incompatible y consultar detalle/historial antes de decidir otra vez.
Los controles de campos tratan 400 por separado; 401/403/404 conservan
sesión, autorización y privacidad existentes.
Pérdida de respuesta, 408/5xx o éxito incompatible: no mostrar éxito ni reenviar
automáticamente. Mantener la intención, ofrecer consulta actual y no atribuir
la presencia de un horario o estado al intento cuya respuesta se perdió.
No regenerar silenciosamente UUID, versión o acuerdo para repetirlo.

Una respuesta de traslado puede ser replay de una intención anterior:
el resultado dirá qué operación respondió y mostrará aparte la programación
vigente. Las lecturas conservan contexto de sesión, cancelación y generación;
también descartan cambios de sesión durante el consumo del cuerpo.

La lectura de historial mantiene su orden ascendente y foco al paginar.
No prometer que exhibe toda la constancia: el DTO de eventos no devuelve
campos del acuerdo, y el motivo de `EMAIL_ACCESSED` es nulo.
No revelar correo del propietario ni afirmar que un aviso implica recepción.

## Secuencia, aceptación y límites

1. Cliente/DTO y validadores compartidos: cuatro acciones, versiones, fechas,
   Unicode, constancia, replay actual y guardas tras lectura del cuerpo.
2. Formularios de cambio dentro del detalle existente, candidatos paginados,
   revisión clara, mensajes, foco y coordinación de pendientes.
3. Simulación HTTP coherente: cancelación y nueva reserva elegible, rollback
   de destino ocupado, inasistencia antes/exacto fin, reasignación mismo
   horario/cambio de hora, extremos Bogotá, replay y fallos tras aplicar.
4. Regresión de 41, tipos/lint/pruebas y exportación; revisión independiente.
5. Navegador escritorio y móvil: cuatro recorridos, rechazo de conflictos,
   resultado incierto sin reenvío, teclado, borrador/aplicado, páginas, lectura
   sin permisos de cambio, logout y respuesta tardía de sesión anterior.
6. Documentar versión, evidencia de ambos portales, gate remoto, commit/push,
   despliegue y comprobación HTTPS por separado de la aceptación integrada.

SCRUM-46 exige cancelar y reservar de nuevo el horario, reprogramación fallida
que conserva origen y permisos correctos con resultados visibles en ambos
portales. La simulación en memoria no acredita transacciones, rollback o
concurrencia PostgreSQL; tampoco colas, SMTP o entrega de avisos reales.
Los avisos P12 ya definidos siguen siendo responsabilidad del backend:
no se añaden nuevas reglas de canal, momento ni promesas de entrega.

Criterio de parada: cuatro operaciones coherentes con contrato, ninguna
contradicción entre reprogramación y reasignación, intención/sesión aisladas,
errores sin éxito aparente y gates/recorridos con evidencia identificada.
La implementación no declara por sí sola terminadas SCRUM-13/44/45/46.

No hay una decisión nueva de negocio bloqueante para este alcance.
Autoservicio OWNER, clínica, urgencias, asignación automática, excepciones
de plazo o reapertura de terminales requieren reglas explícitas si se solicitan.
La revisión compartida de contrato por los tres sigue pendiente de evidencia:
SCRUM-79 está En revisión; SCRUM-81 figura Finalizado, aunque descripción y
comentarios conservan esa revisión pendiente. No se corrige Jira por inferencia.
Las [plantillas de correo](pendientes-proyecto.md) continúan como pendiente
separado. No se incluyen cambios backend, migraciones ni nuevas dependencias.
