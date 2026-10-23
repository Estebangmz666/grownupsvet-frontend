# Incremento: consulta administrativa de avisos de citas

Fecha: **23 de octubre de 2026**, `America/Bogota`.
Base frontend: `78cfcfe74d21a43b18a7419307d8e0e1dfdd7005`.
Este plan acredita la investigación; la implementación, pruebas y publicación
del incremento tendrán su propio corte. Véase el
[inventario administrativo](inventario-portal-administrativo-2026-10-23.md).

La [selección Jira actual](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/jira-seleccion.json)
respalda el seguimiento fiel de estados en SCRUM-15 y su validación SCRUM-49,
ambas En curso; backend SCRUM-47 figura Finalizado. SCRUM-48 es la interfaz del
propietario: este soporte administrativo no la redefine ni declara cerrada.

## Problema y alcance

El propietario ya consulta avisos de sus citas. La base administrativa dispone
de agenda, detalle, historial y decisiones, pero carece del seguimiento de
avisos autorizado para ADMIN. Añadir una entrada **Avisos de la cita** desde
el detalle, con página de 20, navegación real, estados, fechas de Bogotá,
intentos y motivos públicos. Mantener visible qué cita se está consultando.

La consulta exige rol `ADMINISTRATOR` y `APPOINTMENT_READ_ALL`; también debe
funcionar para un administrador de solo lectura, sin `APPOINTMENT_MANAGE`
ni permisos de veterinarios/disponibilidad. No depende de que la cita siga
activa: una cancelada o rechazada puede conservar sus avisos.
No se añade otro permiso, otro endpoint ni una regla de envío.

## Contrato y fuentes comprobadas

Backend base: `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`.
El [contrato de fuente](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/contrato-avisos-fuente.json)
registra cinco archivos, líneas, SHA, operación y esquemas locales.
Las fuentes seleccionadas coinciden con HEAD. La
[comparación remota](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/openapi-comparison.json)
del 23/10 a las 16:24:46 UTC obtuvo 200 y contrato 0.9.0; operación y esquemas
seleccionados coinciden con HEAD y árbol local. No hubo peticiones autenticadas
ni mutaciones en el servicio real.

- [AppointmentController 119](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/appointment/controller/AppointmentController.java#L119):
  `GET /api/v1/appointments/{appointmentId}/notifications?page=0&size=20`,
  HTTP 200 JSON privado/no-store. Página desde 0, size 1–100, predeterminado 20.
- [AppointmentNotificationService 89](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/appointment/service/AppointmentNotificationService.java#L89):
  cuenta activa y rol OWNER/ADMIN; administrador consulta todos los avisos
  de la cita, OWNER únicamente los suyos. VETERINARIAN y SUPER_ADMIN no
  reciben acceso por herencia. Cita inexistente/ajena: 404.
- [Servicio 105](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/appointment/service/AppointmentNotificationService.java#L105):
  orden ascendente por `created_at,id`, anterior a paginar. No hay filtros
  por estado/tipo/fecha ni orden alternativo; `createdAt` no se expone en DTO.

No ordenar localmente por `scheduledAt` como si fuera el orden de creación.
La página es `{items,page,size,totalElements,totalPages}` y puede estar vacía.
No confundir cero avisos con cita inexistente ni fabricar un aviso pendiente.

El [DTO 10](https://github.com/Estebangmz666/grownupsvet-backend/blob/0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/appointment/dto/AppointmentNotificationResponseDTO.java#L10)
tiene **nueve campos obligatorios**: `id`, `appointmentId`,
`notificationType`, `status`, `scheduledAt`, `nextAttemptAt`, `sentAt`,
`attemptCount`, `errorCode`. Los campos anulables son `nextAttemptAt`,
`sentAt` y `errorCode`; deben estar presentes
incluso como null. `attemptCount` es entero no negativo.

Hay siete tipos: `ADMIN_REASSIGNMENT`, `OWNER_REASSIGNED`, `OWNER_CONFIRMED`,
`OWNER_REJECTED`, `OWNER_CANCELLED`, `OWNER_RESCHEDULED`, `OWNER_REMINDER`.
Y cinco estados: `PENDING`, `SENDING`, `SENT`, `FAILED`, `SUPERSEDED`.
El DTO no expone correo, destinatario, payload, lease, token ni detalle SMTP.

## Semántica visible y errores

| Dato            | Presentación honesta                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `scheduledAt`   | Fecha prevista del aviso, conservada aunque haya intentos posteriores.                                                |
| `nextAttemptAt` | Próximo intento solo puede tener valor en PENDING. Si es null, informar que no está disponible, sin estimar un plazo. |
| `sentAt`        | Fecha registrada cuando esté presente; null no se sustituye por fecha prevista ni hora de consulta.                   |
| `SENT`          | Aceptado por el servidor de correo; no acredita lectura ni entrega a buzón real.                                      |
| `SENDING`       | En proceso de envío; no equivale a enviado.                                                                           |
| `SUPERSEDED`    | Aviso ya no vigente; no es un nuevo fallo ni una cita cancelada.                                                      |
| `attemptCount`  | Intentos registrados; cero es válido y no promete envío inmediato.                                                    |

El servicio publica únicamente cinco códigos conocidos o null:
`NOTICE_NO_LONGER_CURRENT`, `SMTP_DELIVERY_FAILED`,
`EMAIL_CONFIGURATION_MISSING`, `DELIVERY_ATTEMPTS_EXHAUSTED`,
`NO_ACTIVE_ADMINISTRATORS`. Mostrar explicaciones españolas acotadas,
con fallback seguro para un código público no reconocido. No volcar el
cuerpo de error del transporte ni mensajes internos en la interfaz.
Un intento fallido puede seguir `PENDING`; no derivar el estado del código.

Separar carga/vacío/lectura fallida. 400 de paginación inválida no es
incertidumbre de una escritura; 401 conserva el manejo de sesión actual;
403 explica ausencia de permiso y404 que la cita no está disponible.
Permitir reintentar la **consulta**, sin controles de reenvío de correo.

## Secuencia y aceptación

1. Cliente administrativo específico con parser estricto de página y DTO,
   nueve campos, enums/UUID/instantes/nulabilidad, pertenencia a la cita,
   coherencia de página y contexto de sesión después de leer el cuerpo.
2. Vista con cita identificada, 20 registros por página, actualizar consulta
   y volver al detalle. Conservar orden del servidor; no cargar todo para
   luego presentar páginas aparentes o inventar filtros.
3. Guardas de lectura: abortar al salir, descartar respuestas de otra cita,
   página, revisión o sesión. Ocultar la página anterior durante carga/error.
   El foco vuelve al disparador o al encabezado estable al paginar.
4. Simulación coherente y HTTP real local: tipos/estados, 26 avisos en 20+6,
   vacío, 401/403/404, administrador de solo lectura, privacidad OWNER,
   campos nulos, respuesta incompatible y lecturas demoradas de sesión anterior.
5. Gates, build y revisión independiente. Navegador escritorio/móvil 390:
   entrada desde detalle, paginación/actualización, teclado/foco, lectura
   sin gestión, salida y consola. No enviar correos ni mutar citas para
   demostrar el recorrido cuando una fixture explícita suministra los avisos.
6. Documentar commit, CI, Pages y GET público por separado del recorrido
   autenticado y de la entrega real de correo.

Aceptación técnica: solo GET autorizado, contenido sin datos privados,
estado/fechas/nulos fieles al contrato, paginación real sin datos de otra
cita o sesión y sin promesas de entrega. No hay decisión nueva de negocio
bloqueante para este alcance deducido del contrato.

## Exclusiones y límites

No se implementan SMTP, envío/reenvío/cancelación manual de avisos, acceso
al payload/destinatario ni cambios en tareas o recordatorios.
La revelación auditada de correo sigue siendo del veterinario actualmente
asignado mediante su endpoint propio; no corresponde a ADMIN ni a esta vista.
No se reutiliza `/users/me` OWNER como perfil universal.

No se incluyen títulos/diplomas, foto staff, clínica, nuevas reglas P12,
[plantillas de correo](pendientes-proyecto.md), backend, migraciones o dependencias.
La simulación no acredita entrega SMTP, lectura de buzón, SQL, locks o RBAC
productivo integrado. La consulta pública del contrato tampoco los acredita.
Se conserva Jira en solo lectura; no se atribuye una subtarea nueva ni
se declara cerrado P12 o una historia por entregar esta pantalla.
