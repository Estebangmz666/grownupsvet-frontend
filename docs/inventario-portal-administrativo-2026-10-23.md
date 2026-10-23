# Inventario del portal administrativo

Corte: **23 de octubre de 2026**, base publicada
`78cfcfe74d21a43b18a7419307d8e0e1dfdd7005`, antes del incremento de avisos.
El último corte entregado pasó **626 pruebas en 42 archivos**, tipos, lint,
build y comprobaciones locales/publicación. La evidencia detallada está en la
[verificación de cambios de citas](verificacion-cambios-citas-2026-10-23.md)
y el [resultado externo de publicación](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/resultado-incremento.md).
Este inventario distingue interfaz existente, API disponible y alcance futuro.

## Implementado en la base

| Capacidad                 | Alcance y límites actuales                                                                                                                                                                                              | Evidencia de código                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada única y roles     | Login, recuperación, activación y sesión compartidos; el backend entrega rol/permisos. ADMIN abre Veterinarios/Citas según permisos, SUPER_ADMIN administra administradores y VETERINARIAN consulta su agenda.          | [Selección de área](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/src/navigation/roleAccess.ts#L26) y [paneles](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/apps/administrativo/src/StaffArea.tsx#L24).                                                                                      |
| Personal autorizado       | Listado/detalle/alta/edición, estados e invitaciones del tipo de cuenta permitido. Correo y rol permanecen inmutables; no hay selector de rol arbitrario.                                                               | [Formulario de cuenta](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/apps/administrativo/src/screens/StaffAccountFormScreen.tsx#L145).                                                                                                                                                                                                               |
| Perfil profesional base   | Teléfono profesional, matrícula, título e institución base y presentación del veterinario. Modificar datos académicos retira la publicación del diploma; registrar matrícula no verifica COMVEZCOL.                     | [Campos existentes](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/apps/administrativo/src/screens/StaffAccountFormScreen.tsx#L159).                                                                                                                                                                                                                  |
| Disponibilidad individual | Agenda y páginas, publicación, cambio de hora, bloqueo/republicación e historial, con versiones y restricciones de ocupación/historia.                                                                                  | [Pantalla de disponibilidad](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/apps/administrativo/src/screens/VeterinarianAvailabilityScreen.tsx#L166).                                                                                                                                                                                                 |
| Lotes de turnos           | 1–31 fechas, días seleccionados, turnos de 30 minutos, fin exclusivo hasta 24:00 y máximo 1000; confirmación y consulta completa ante incertidumbre.                                                                    | [Entrada a lotes](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/apps/administrativo/src/screens/VeterinarianAvailabilityScreen.tsx#L182) y [verificación](verificacion-lotes-disponibilidad-2026-10-23.md).                                                                                                                                          |
| Citas administrativas     | Agenda por rango/estado, detalle e historial; confirmar/rechazar, cancelar, inasistencia, reprogramación y reasignación excepcional. Versiones, acuerdo, permisos, conflictos e incertidumbre se tratan explícitamente. | [Detalle y decisiones](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/apps/administrativo/src/screens/AdministrativeAppointmentDetailsScreen.tsx#L41) y [traslados](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/apps/administrativo/src/screens/AdministrativeAppointmentMoveScreen.tsx#L85). |

Las cuentas administrativas de solo lectura pueden consultar citas sin
`APPOINTMENT_MANAGE`. Gestionar citas no concede automáticamente los permisos
de consulta necesarios para seleccionar veterinarios/turnos de destino.
Los datos clínicos no se incorporan a estas decisiones administrativas.

## Pendientes con contrato disponible

| Pendiente                      | Qué existe y qué falta en interfaz                                                                                                                                                                                                  | Siguiente alcance                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avisos de la cita para ADMIN   | Existe `GET /appointments/{id}/notifications`, también para administrador con `APPOINTMENT_READ_ALL`; el propietario ya tiene pantalla. Falta su entrada/vista administrativa en esta base.                                         | **Incremento seleccionado ahora:** [plan de avisos](plan-avisos-administrativos-2026-10-23.md), consulta paginada y estados sin envíos/reintentos manuales. |
| Títulos adicionales y diplomas | El DTO contiene `qualifications`, pero el portal solo edita formación base. Backend permite listar/crear/editar títulos, eliminar adicionales, cargar/descargar PDF, publicar/retirar y eliminar diploma con `VETERINARIAN_MANAGE`. | Implementar un recorrido académico completo, con revisión y validación binaria del servidor, como incremento separado.                                      |
| Foto propia del personal       | Backend concede `PROFILE_PHOTO_READ_SELF` y `PROFILE_PHOTO_UPDATE_SELF` al personal y existen helpers de foto; falta un recorrido propio dentro del área staff.                                                                     | Incremento pequeño separado, accediendo al recurso de foto directamente y respetando sesión/permisos.                                                       |

Fuente de avisos: [controller 119](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/appointment/controller/AppointmentController.java#L119)
y [servicio 89](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/appointment/service/AppointmentNotificationService.java#L89).
Fuente de formación: [controller 29](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/controller/VeterinarianQualificationController.java#L29)
y [tipos del cliente 61](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/packages/api-client/src/staff.types.ts#L61).

Un veterinario admite hasta 20 títulos incluido el pregrado obligatorio,
que no se puede eliminar. El diploma es un PDF por título, máximo 5 MiB y
50 páginas; cambiar datos académicos retira su publicación y conserva el
archivo privado. Publicar confirma una revisión administrativa. Son reglas
existentes del [controller 48–135](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/controller/VeterinarianQualificationController.java#L48),
no capacidades de interfaz ya entregadas.

La foto usa `/api/v1/users/me/profile/photo`: [controller 32](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/user/controller/UserProfilePhotoController.java#L32),
[permisos 37](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/authentication/security/UserPermissionResolver.java#L37)
y [helpers 46](https://github.com/Estebangmz666/grownupsvet-frontend/blob/78cfcfe74d21a43b18a7419307d8e0e1dfdd7005/packages/api-client/src/profile.api.ts#L46).
`GET /users/me` sigue siendo perfil **OWNER**: no reutilizarlo como perfil
universal ni copiar sin adaptación la pantalla del propietario, que primero
lo consulta. [Guarda de propietario 50](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/user/service/OwnerProfileService.java#L50).

## Dependencias y alcances posteriores

**Aclaración posterior del usuario, 23/10/2026:** P3 está fuera del alcance
de esta entrega, conforme a la entrega anterior. El borrador/finalización de
atención (P08), fórmulas/controles (P09), adendas (P11) y sus contratos clínicos
pendientes en Jira no son bloqueos del frontend P1/P2. El backend no los
implementa todavía; no corresponde inventar endpoints ni añadir formularios
clínicos a esta entrega.

Siguen pendientes la aceptación integrada con cuentas reales, RBAC del
servicio en esos recorridos, concurrencia/rollback PostgreSQL y evidencia
de avisos/SMTP fuera del sustituto. La simulación y los GET públicos de
publicación no sustituyen esas comprobaciones. Las
[plantillas de correo](pendientes-proyecto.md) son otro pendiente del backend.

## Jira y trazabilidad

El [inventario Jira del 23/10 a las 16:20:18 UTC](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/jira-inventario.json)
contiene 20 incidencias consultadas en solo lectura. SCRUM-37,41 y45 figuran
Por iniciar, aunque la base identificada contiene esas interfaces; SCRUM-34
y las historias 10–13 figuran En curso. Los estados no reemplazan la evidencia
de código ni se actualizan por inferencia en este trabajo.

SCRUM-51/54/60 y contratos 82/83 figuran Por iniciar en el inventario.
En la [selección actual complementaria](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/jira-seleccion.json),
SCRUM-81 figura Finalizado pero su descripción conserva la revisión compartida
pendiente. Ese texto es histórico; no demuestra que los tres hayan revisado
el contrato ni permite declarar terminadas historias o validaciones.
No se cambiaron estados, comentarios ni asignaciones de Jira.

Esa selección también conserva SCRUM-15/49 En curso, 47 Finalizado y 48
Por iniciar. El próximo seguimiento administrativo de avisos apoya la
semántica y validación de P12; no se atribuye a la subtarea 48 del propietario
ni cierra su aceptación integrada.
