# Plan de perfiles veterinarios para propietarios y foto propia del personal

Fecha: **23 de octubre de 2026**, zona `America/Bogota`.

Plan técnico posterior a formación administrativa, sobre la base frontend
`6b0fd61d41cd74dde494755d53030b6957c6349f`. No acredita implementación ni
pruebas del incremento. **P3/clínica está fuera del alcance de esta entrega**;
estas funciones pertenecen a P1/P2 y consumen únicamente API existente.

## Fuente y alcance

La [selección Jira](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/jira-seleccion.json)
del 23/10 a las 16:52:27 UTC sitúa
[SCRUM-10](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-10) y
[SCRUM-34](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-34) En curso,
[SCRUM-33](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-33) Finalizado
y [SCRUM-35](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-35) En curso.
Son referencias de personal/perfiles/permisos; no se inventa una subtarea Jira
específica para la pantalla OWNER ni se declara cerrado ese trabajo.

El [OpenAPI capturado](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/openapi-live.json)
obtuvo 200 el **23/10 a las 16:53:14.144833 UTC**, versión 0.9.0.
La lectura local de ese snapshot confirmó igualdad de las **cinco rutas,
siete operaciones y tres esquemas** de este plan con `docs/openapi/openapi.json`.
Los controladores y servicios seleccionados no difieren de HEAD backend
`0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`. Esta comprobación estructural no
acredita acceso autenticado al servicio desplegado.

## OWNER: directorio y ficha profesional

Añadir navegación para consultar veterinarios desde el módulo OWNER y
permitir abrir su ficha desde el contexto de selección de profesional cuando
esté disponible. Separar listado y detalle, con retorno a la misma página.
No se añade búsqueda, filtro de especialidad o ordenamiento que la API no ofrece.

| Operación                                                                                     | Contrato                                                                                                                   |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/v1/veterinarian-profiles?page=0&size=20`                                            | Página `{items,page,size,totalElements,totalPages}`, size 1–100; orden de creación descendente e identificador ascendente. |
| GET `/api/v1/veterinarian-profiles/{veterinarianId}`                                          | Ficha de veterinario activo, sin correo privado.                                                                           |
| GET `/api/v1/veterinarian-profiles/{veterinarianId}/photo`                                    | Bytes JPEG/PNG de la foto del titular; ausencia 404.                                                                       |
| GET `/api/v1/veterinarian-profiles/{veterinarianId}/qualifications/{qualificationId}/diploma` | PDF solo si pertenece al veterinario activo y está publicado.                                                              |

Todas exigen **OWNER activo + `VETERINARIAN_PROFILE_READ`**. «Perfil público»
significa proyección para propietarios autenticados; no es una ruta anónima.
ADMINISTRATOR, SUPER_ADMIN y VETERINARIAN no heredan este acceso.

La ficha contiene nueve campos: `id`, `fullName`, `professionalPhoneNumber`,
`professionalRegistrationNumber`, `baseDegreeTitle`, `baseDegreeInstitution`,
`biography`, `profilePhotoUrl`, `qualifications`. Biografía y ruta de foto son
claves obligatorias con valor nullable. Mostrar formación estructurada y el
título base, sin presentar cursos como especializaciones ni afirmar que la
matrícula o los títulos fueron certificados por una entidad externa.

El servicio devuelve todos los títulos académicos, pero oculta disponibilidad
de documentos privados mediante sus flags. Ofrecer descarga únicamente cuando
`diplomaAvailable` y `diplomaPublished` sean verdaderos; el servidor vuelve a
comprobar publicación, pertenencia y estado activo al descargar. Un 404 tras
una retirada o desactivación debe actualizar el estado de la pantalla.

Validar DTO, página, UUID y pertenencia del detalle. Resolver la foto mediante
la ruta autenticada esperada para ese mismo veterinario; no enviar Bearer a
URLs arbitrarias recibidas del servidor. Descargar PDF por petición autenticada
y Blob, con nombre local controlado, comprobación de `application/pdf` y
guardas de sesión después de consumir los bytes. No poner tokens en URLs ni
guardar documentos o imágenes en almacenamiento persistente; revocar Object URL.

Fuente: [VeterinarianPublicProfileController.java:45](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/controller/VeterinarianPublicProfileController.java:45),
[StaffManagementService.java:251](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/service/StaffManagementService.java:251)
y [proyección pública:370](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/staff/service/StaffManagementService.java:370).

## Personal: foto propia sin perfil OWNER

Añadir una sección «Mi foto» en el área de personal, compartida por
SUPER_ADMIN, ADMINISTRATOR y VETERINARIAN. Separar consulta y modificación
según sus permisos; no conceder gestión de otras cuentas por habilitar esta sección.

| Operación                               | Contrato                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- |
| GET `/api/v1/users/me/profile/photo`    | `PROFILE_PHOTO_READ_SELF`, 200 JPEG/PNG; 404 significa que no hay foto.    |
| PUT `/api/v1/users/me/profile/photo`    | `PROFILE_PHOTO_UPDATE_SELF`, multipart con campo `file`; 204 si se guarda. |
| DELETE `/api/v1/users/me/profile/photo` | `PROFILE_PHOTO_UPDATE_SELF`, 204 incluso si ya no hay foto.                |

Usar directamente esos recursos y la sesión autenticada. **GET `/users/me`
sigue siendo perfil OWNER** y no debe usarse para cargar o restaurar personal.
Existen helpers en
[profile.api.ts:46](C:/Users/ASUS/Documents/ChatGPT/grownupsvet-frontend/packages/api-client/src/profile.api.ts:46)
y procesamiento de selección OWNER; extraer únicamente la parte reutilizable
sin introducir el formulario completo de perfil de propietario en personal.
La modificación de la foto de un veterinario corresponde a su titular,
no al administrador que mantiene su formación.

Aceptar JPEG/PNG; el archivo enviado admite hasta **2 MiB**. El backend valida
contenido y dimensiones: máximo 8000 por lado y 20 millones de píxeles;
orienta, reduce a un máximo de 512 por lado y vuelve a codificar sin metadatos.
La previsualización o la extensión no acreditan esa validación. Diferenciar
400 por contenido/dimensiones, 413 por tamaño, 415 por tipo, 401 por sesión
y 404 por ausencia al consultar. La imagen anterior debe conservarse si el
servidor rechaza el reemplazo antes de persistir.

Conservar la selección mientras se envía, impedir doble acción y confirmar
la eliminación de forma accesible. Tras 204, separar éxito de guardado de un
fallo posterior al recargar la imagen. Ante respuesta perdida, consultar el
estado actual y explicar la incertidumbre; la mera existencia de una foto no
prueba que corresponda a los bytes del intento. No simular control de versión
o protección frente a la última escritura que la API no ofrece.

Fuente: [UserProfilePhotoController.java:56](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/user/controller/UserProfilePhotoController.java:56),
[ProfilePhotoProcessor.java:30](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/user/service/ProfilePhotoProcessor.java:30),
[UserProfilePhotoService.java:42](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/user/service/UserProfilePhotoService.java:42)
y [OwnerProfileService.java:50](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend/user/service/OwnerProfileService.java:50).

## Secuencia y aceptación

1. Validadores y cliente OWNER para página/detalle y binarios; reutilizar la
   estructura académica sin llamadas a endpoints administrativos. Endurecer
   los helpers de foto compartidos cuando sea necesario para tipo y sesión.
2. UI de foto propia de personal, con permisos separados, selección,
   previsualización, reemplazo, eliminación y estados de carga/error/ausencia.
3. Directorio OWNER paginado, ficha y foto opcional; descarga de diploma publicado.
4. Simulación local con fotos/PDF ficticios y estados de publicación. Probar
   permisos por rol, páginas, vacío, retiro/desactivación, formatos inválidos,
   demora de bytes, cambio de sesión y respuestas perdidas sin éxito aparente.
5. Verificar teclado y foco, móvil de 390 px, escritorio, logout y consola;
   ejecutar check/build y conservar evidencia separada de commit/push/CI/deploy.

No hay una decisión de negocio bloqueante identificada para estas siete
operaciones. La simulación no acredita procesado real de imágenes/PDF,
persistencia, SMTP o aceptación RBAC con cuentas reales. No se modificará
backend ni Jira como consecuencia de este plan. Después de este alcance
siguen la lectura de disponibilidad/detalle/historial de VETERINARIAN y su
revelación puntual auditada del correo, descritas en el
[plan de formación](plan-formacion-veterinaria-2026-10-23.md).
Las plantillas de correo continúan como pendiente backend separado.
