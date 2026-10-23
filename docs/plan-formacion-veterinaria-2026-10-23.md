# Plan de formación veterinaria y cierre de frontend P1/P2

Fecha: **23 de octubre de 2026**, zona `America/Bogota`.

Este documento planifica el incremento sobre frontend
`6b0fd61d41cd74dde494755d53030b6957c6349f`. No acredita su implementación,
pruebas o publicación. El corte anterior entregó consulta administrativa de
avisos y pasó 700 pruebas en 44 archivos. El usuario aclaró que **P3/clínica
está fuera del alcance de esta entrega y no bloquea el cierre del frontend**.
La secuencia restante se limita a P1/P2 y al contrato disponible.

## Fuentes y trazabilidad

La [selección Jira](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/jira-seleccion.json)
se obtuvo el **23/10 a las 16:52:27 UTC**, en modo de solo lectura.

| Incidencia                                                                | Estado consultado | Relación con el incremento                                                                                 |
| ------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| [SCRUM-10](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-10) | En curso          | Personal y perfiles profesionales autorizados.                                                             |
| [SCRUM-33](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-33) | Finalizado        | Implementación backend; su cierre no acredita pantallas.                                                   |
| [SCRUM-34](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-34) | En curso          | Gestión de personal con confirmaciones comprensibles; aquí se completa formación/diplomas.                 |
| [SCRUM-35](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-35) | En curso          | Validación de permisos y estados, independiente de la revisión compartida y del alcance clínico histórico. |

No se modificaron estados, comentarios o asignaciones. Las descripciones de
Jira conservan cortes históricos y no sustituyen la evidencia del código actual.

El [OpenAPI real](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/openapi-live.json)
respondió **200 a las 16:53:14.144833 UTC**, versión **0.9.0**. La
[comparación seleccionada](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/openapi-comparison.json)
confirma cuatro rutas y tres esquemas iguales entre servicio, HEAD y árbol local
del backend `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`. El
[contrato de fuente](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/contrato-formacion-fuente.json)
conserva nueve fuentes con líneas y huellas, iguales a HEAD. La descarga pública
no usó autenticación ni mutaciones; no prueba los flujos reales autenticados.

## Incremento actual: administración de formación y diplomas

Añadir la entrada «Formación académica» desde el detalle de un veterinario.
Listar el título base primero y los adicionales en el orden del servidor;
permitir consulta, alta, edición y eliminación de títulos adicionales, así
como gestión del diploma de cada título. Reutilizar campos, diálogos,
carga/error/vacío, foco y control de operaciones del área administrativa.

El acceso exige rol **ADMINISTRATOR activo** y `VETERINARIAN_MANAGE`.
SUPER_ADMIN, VETERINARIAN y OWNER no heredan esta función. El veterinario
destino puede estar activo, desactivado o pendiente; no añadir una restricción
local de estado que el servicio no exige. La fuente aplica estas reglas en
[StaffManagementService.java:301](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/service/StaffManagementService.java:301).

Todas las rutas siguientes parten de `/api/v1/veterinarians/{veterinarianId}`
y requieren Bearer. No se crean endpoints nuevos.

| Recurso                                                 | Operaciones y respuesta                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/qualifications`                                       | GET: arreglo sin paginación. POST: 201 con DTO y `Location`.                                    |
| `/qualifications/{qualificationId}`                     | GET/PUT: 200 con DTO. DELETE: 204 para título adicional.                                        |
| `/qualifications/{qualificationId}/diploma`             | GET: 200 PDF administrativo. PUT multipart: 200 DTO. DELETE: 204, incluso si ya no hay diploma. |
| `/qualifications/{qualificationId}/diploma/publication` | PATCH `{published: boolean}`: 200 DTO; exige diploma existente.                                 |

El [controlador](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/controller/VeterinarianQualificationController.java:29)
define nueve operaciones. Los DTO se validarán también al recibirlos:
`id`, `type`, `title`, `institution`, `graduationYear`, `isBaseDegree`,
`diplomaAvailable`, `diplomaPublished`; el año es obligatorio en la respuesta
aunque su valor sea `null`. No se interpretará una respuesta malformada como éxito.

### Reglas del formulario y del archivo

- Máximo **20 títulos contando el base**. Tipos admitidos: `UNDERGRADUATE`,
  `SPECIALIZATION`, `MASTERS`, `DOCTORATE`. No ofrecer cursos como especialización.
- Título e institución no blancos, máximo 200 unidades UTF-16 antes de la
  normalización del servidor. Conservar Unicode y aplicar la semántica Java
  `strip/isBlank` existente; no imponer reglas académicas adicionales.
- Año opcional: `null` o entero desde 1900 hasta el año actual de Bogotá.
  El máximo técnico 9999 del esquema no autoriza años futuros.
- El título base siempre conserva `UNDERGRADUATE` y no se elimina. Cambiar
  datos académicos retira la publicación del diploma y conserva el archivo
  privado; mostrar esta consecuencia antes de guardar.
- Un diploma por título: PDF de hasta **5 MiB y 50 páginas**, sin cifrado,
  formularios, acciones o adjuntos. El navegador puede comprobar tamaño y
  selección de archivo; el servidor valida estructura y recursos. No afirmar
  certificación académica, comprobación COMVEZCOL o análisis antivirus.
- Cargar inicialmente como privado, usando el campo multipart `file` y
  `published=false`. Publicar exige una confirmación explícita de revisión
  del archivo; retirar la publicación no elimina el archivo. Un reemplazo
  inválido debe conservar el documento anterior según el servicio.
- Descargar mediante petición autenticada y Blob, sin token en URL. Verificar
  respuesta PDF y sesión después de consumir bytes; liberar Object URL al
  terminar o salir y evitar conservar documentos en almacenamiento persistente.

Estas reglas están en
[StaffManagementService.java:154](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/service/StaffManagementService.java:154),
su [validación de año:347](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/service/StaffManagementService.java:347)
y [DiplomaPdfValidator.java:27](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/service/DiplomaPdfValidator.java:27).
La descarga usa `attachment`, `nosniff`, CSP restrictiva y `private, no-store`
en [StaffBinaryResponses.java:8](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/controller/StaffBinaryResponses.java:8).

### Fallos, incertidumbre y criterios observables

La API no recibe versión esperada ni clave idempotente para estas operaciones.
Evitar doble envío inmediato y reintento automático. Ante respuesta perdida
o éxito ilegible, bloquear la repetición ciega y ofrecer una nueva consulta:
la presencia de un título no prueba qué intento lo creó, y el DTO no contiene
hash del PDF para demostrar que se almacenaron los mismos bytes. No presentar
control de concurrencia que el contrato no ofrece.

Diferenciar validación 400, sesión 401, autorización 403, recurso 404, límite
o título base 409, tamaño 413, formato 415 y validador temporalmente ocupado 503. Conservar los datos editados y el contexto; no prometer que todo 5xx
significa que nada se guardó. Capturar sesión/cuenta/título por operación,
descartar respuestas tardías tras navegación o logout y retirar datos
anteriores durante cargas. No cerrar sesión automáticamente por un 403.

La aceptación local debe observar: base protegida, alta/edición/borrado de
adicionales, límite 20, año de Bogotá, Unicode, archivo privado, revisión y
publicación explícitas, retirada y eliminación separadas, PDF inválido sin
destruir el anterior, errores y respuesta perdida sin duplicación automática.
Probar permisos, manipulación de UUID, respuestas inválidas y sesión cambiada
durante lectura. Verificar móvil 390 px, teclado, foco inicial/cancelación/
restauración y estado pendiente; coordinar HTTP/simulación para evitar resets
concurrentes. El mock no acredita PDFBox, SQL ni validación real del diploma.

## Secuencia breve del resto P1/P2 contra API existente

La auditoría del frontend base encontró estas superficies todavía sin UI;
las llamadas existentes de otros roles no equivalen a tenerlas disponibles.

| Siguiente incremento                            | Contrato disponible y límite de alcance                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWNER: directorio y formación profesional       | GET `/veterinarian-profiles` (page/size), `/{veterinarianId}`, `/{veterinarianId}/photo` y `/{veterinarianId}/qualifications/{qualificationId}/diploma`; `VETERINARIAN_PROFILE_READ`, OWNER activo. Solo veterinarios activos; documentos no publicados no descargables. Mostrar los títulos devueltos y respetar sus flags públicos. Añadir navegación desde directorio/selección de profesional sin usar endpoints ADMIN.                                         |
| VETERINARIAN: detalle/historial y agenda propia | GET `/appointments/{id}` y `/events` con `APPOINTMENT_READ_ASSIGNED`; la UI actual solo muestra tarjetas de agenda diaria. GET `/veterinarians/{propioId}/availability-slots` y `/{slotId}` con `VETERINARIAN_AVAILABILITY_READ_SELF`, rango inclusivo de 1–31 días. Consulta propia, sin crear/bloquear turnos ni consultar auditoría administrativa de disponibilidad.                                                                                            |
| VETERINARIAN: correo puntual justificado        | POST `/appointments/{id}/owner-email-accesses`, permiso `APPOINTMENT_OWNER_EMAIL_READ`, motivo no blanco de hasta 500. Solo veterinario actualmente asignado, cita `CONFIRMED` y antes de terminar su intervalo; no exige que ya haya empezado. Solicitar motivo del contacto por WhatsApp fallido y confirmación explícita. Audita y aumenta la versión de la cita; no reintentar automáticamente ni tratarlo como GET. Retirar el correo al salir/cambiar sesión. |
| Personal: foto propia                           | GET/PUT/DELETE `/users/me/profile/photo`, permisos `PROFILE_PHOTO_READ_SELF` / `PROFILE_PHOTO_UPDATE_SELF` para SUPER_ADMIN, ADMINISTRATOR y VETERINARIAN. JPEG/PNG hasta 2 MiB, 404 como ausencia y DELETE idempotente. Reutilizar cliente de foto con guardas de sesión sin llamar a `/users/me`, que es perfil OWNER.                                                                                                                                            |

La [ficha pública:45](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/controller/VeterinarianPublicProfileController.java:45)
y [proyección del servicio:370](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/service/StaffManagementService.java:370)
excluyen correo y documentos privados. La
[disponibilidad:63](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/availability/controller/VeterinarianAvailabilityController.java:63)
separa lectura propia de gestión. El
[acceso puntual al correo:155](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/appointment/controller/AppointmentController.java:155)
se audita antes de responder en
[AppointmentService.java:397](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/appointment/service/AppointmentService.java:397).

Los permisos de los roles son independientes en
[UserPermissionResolver.java:29](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/authentication/security/UserPermissionResolver.java:29).
La foto tiene controlador compartido; el
[perfil ordinario:50](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/user/service/OwnerProfileService.java:50)
exige OWNER. No convertir ADMINISTRATOR en veterinario o SUPER_ADMIN en administrador
por herencia, ni ofrecer cambio arbitrario de rol sin endpoint.

Para esta secuencia no se identificó una decisión material de negocio sin
resolver en las fuentes actuales. Antes de cada implementación se actualizarán
contrato, plan, pruebas y mock del área correspondiente. El cierre P1/P2 exige
verificar estas superficies y registrar aceptación real de sesión/RBAC,
persistencia y correo con el entorno autorizado; una simulación no los acredita.
Las plantillas de correo siguen como pendiente backend separado en
[pendientes-proyecto.md](pendientes-proyecto.md), sin escritura Jira por ello.
No se implementarán pantallas clínicas ficticias ni se inventarán sus rutas.
