# Primer incremento administrativo: implementación y verificación

Fecha: **22 de octubre de 2026**, America/Bogota.

**Resultado:** implementado localmente el núcleo de gestión de personal del [plan aprobado](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/grownupsvet-backend/docs/plan-implementacion-2026-10-22-frontend-administrativo-incremento-1.md). Permite consultar, crear, editar, habilitar/deshabilitar, reenviar/cancelar invitaciones y activar cuentas desde un enlace. Pasaron TypeScript, ESLint, **192 pruebas en 25 archivos** y la exportación web. Se recorrió la aplicación real contra una simulación HTTP del contrato. La aceptación con invitaciones reales y la publicación siguen pendientes.

## 1. Base y cambios implementados

Clon activo: `C:\Users\ASUS\Documents\ChatGPT\grownupsvet-frontend`, rama `codex/fix-web-cloudflare`, base `a028b06c0a744483646768fa0da7e629d3074fd2`. Se ejecutó `git fetch --no-tags origin`; HEAD y `origin/master` coinciden. Se preservaron los cambios locales anteriores. Este incremento no se comprometió ni publicó.

El OpenAPI desplegado volvió a responder versión funcional **0.9.0**. Las operaciones, campos y reglas se contrastaron además con los DTO, validadores y servicios del backend. Se consultó la [documentación exacta de Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) requerida por las instrucciones del repositorio.

| Área | Entregado |
| --- | --- |
| SUPER_ADMIN | Listado, detalle, alta, edición de nombre, estado e invitaciones de administradores. |
| ADMINISTRATOR | Listado, detalle, alta, edición del perfil profesional base, estado e invitaciones de veterinarios. |
| Activación pública | Entrada directa y recarga de `/activate-account?token=…`; validación de contraseña/confirmación, envío público sin Bearer ni cookies, resultado 204 y regreso al acceso. No hace login automático ni reemplaza otra sesión abierta. |
| Sesión y permisos | Reutiliza el proveedor, navegador raíz y permisos existentes. Aislamiento de respuestas de otra cuenta y control de doble envío. OWNER y VETERINARIAN conservan sus áreas. |
| Interacción | Mensajes por campo, foco al navegar/errores/resultados, confirmaciones con Cancelar y Escape, formularios adaptables a celular y computador. |

Correo y rol no son editables. El alta no pide contraseña al operador. El título base y la institución sí forman parte del perfil veterinario; títulos adicionales, PDF, fotos del personal, disponibilidad, gestión de citas y clínica P3 quedan fuera de este incremento.

No se añadieron endpoints, migraciones, reglas de negocio ni dependencias. Se conservó el backend. Las acciones privadas usan los contextos de sesión ya implementados; la activación es una operación pública separada.

## 2. Comprobaciones ejecutadas

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run check` | TypeScript y ESLint correctos; **192 pruebas en 25 archivos**, 71 más que las 121 del incremento anterior. Incluyen las pruebas existentes; no son 192 recorridos de navegador. |
| Pruebas nuevas | Contratos y payloads de gestión, anonimato de activación, estados, errores, contraseñas Unicode sin transformar, enlaces, formularios, paginación y coordinación de mutaciones entre sesiones. |
| `npm run web:build` | Exportación Expo y preparación Pages/PWA correctas. Bundle final: `index-2c3e01aea9d7bcf2434f5959fcafeb1d.js`. |
| Simulación Postman | **94 comprobaciones HTTP** contra el sustituto y los esquemas aplicables de OpenAPI 0.9.0. Son evidencia del entorno simulado, separada de las 192 pruebas del proyecto. |
| App real en navegador | Exportación servida por Wrangler Pages en 8085, con `/api/v1` reenviado a la simulación en 4900; recorridos descritos abajo. |
| Aplicación local para el usuario | `http://localhost:8788/` respondió 200 con el bundle final. `/api/v1/pets` sin sesión respondió 401 y `Cache-Control: no-store`, apuntando al backend real. |
| Revisión independiente | Se revisaron contratos, activación y continuaciones de sesión. Se corrigió la reconciliación del listado después de una creación de resultado incierto. |
| Espacios y preservación | `git diff --check` correcto. Se compararon huellas SHA-256 de los 32 archivos pendientes del backend antes/después: ninguno cambió durante este incremento frontend. |

ESLint conserva su aviso previo de tipo de módulo; no impidió la ejecución. La advertencia de Fast Refresh introducida durante el desarrollo se eliminó. No se actualizaron librerías ajenas al alcance para eliminar avisos de herramientas.

## 3. Recorridos observados en navegador

Todas las cuentas, matrículas y demás datos de estos recorridos son **ficticios**. Las rutas de control del simulador no pertenecen al producto.

| Recorrido | Resultado |
| --- | --- |
| Alta de administrador | Campos obligatorios, nombre/correo válidos, 201 y detalle pendiente. No se pide contraseña ni se promete entrega al buzón. |
| Edición de administrador | Se consultó el detalle actual, se cambió nombre y se conservó correo/rol inmutables. |
| Reenvío | Confirmación, foco inicial en Cancelar, Escape y retorno al botón. Reenvío inmediato 429; tras adelantar la espera mediante fixture, 202 con vencimiento en Bogotá. |
| Activación | Enlace anterior rechazado, enlace vigente con entrada directa/recarga, 204 y token retirado de la URL. La sesión de SUPER_ADMIN permaneció abierta. |
| Entrada de la cuenta activada | Después de salir de SUPER_ADMIN, la cuenta nueva inició sesión normalmente y entró a Veterinarios como ADMINISTRATOR. |
| Alta y edición de veterinario | Perfil completo, matrícula normalizada a mayúsculas, título/institución obligatorios. Editar nombre y dejar presentación vacía produjo «Sin presentación». |
| Cancelación de invitación | 204, cuenta deshabilitada y conservada. Intentar habilitarla sin contraseña produjo 409 y explicación de que necesita activación. |
| Resultado incierto | Se aplicó un alta y se cortó su respuesta mediante fixture; el proxy de Postman devolvió 502. El formulario bloqueó otro envío y «Consultar listado» hizo una consulta real que encontró la cuenta, sin otro POST. No fue un 502 atribuido al contrato del backend. |
| Respuesta tardía A → B | Mientras un alta demoraba su respuesta diez segundos, A salió y B entró como propietario. La respuesta de A llegó después del acceso de B; B conservó su identidad y su mascota, sin navegación ni refresco privado de A. |
| Invitaciones no disponibles | Alta con 503 controlado: se mantuvo el formulario y no apareció un éxito de creación o envío. |
| Correo duplicado | 409, mensaje junto al correo y conservación del nombre introducido. |
| Deshabilitar cuenta activa | Se mantuvieron dos sesiones separadas: SUPER_ADMIN deshabilitó la cuenta y el siguiente GET de esta devolvió 401, llevándola al login. SUPER_ADMIN siguió autenticado. |
| Rehabilitar | La cuenta pasó a activa, pero no recuperó la sesión anterior; un login nuevo funcionó con la misma contraseña ficticia. |
| Regresión | OWNER conservó Mis mascotas/Luna; VETERINARIAN conservó su agenda del día en Bogotá y no recibió gestión de personal. |
| Enlace sin token | Pantalla pública comprensible y opción de volver al login; sin intento de activación. |
| Presentación | Detalle veterinario a 390 × 844 y formulario a 1440 × 900 revisados visualmente. La página permite desplazamiento vertical para todos los campos/acciones. No constituye una auditoría formal de accesibilidad. |

Se corrigieron además dos detalles detectados durante la integración: el regreso desde activación vuelve a comprobar la sesión para mostrar el estado actualizado, y el error de enlace usado/vencido recibe foco sin dejarlo en un campo que ya desapareció.

## 4. Evidencia y límites de la simulación

Carpeta de evidencia:

`C:\Users\ASUS\Documents\ChatGPT\GrownupsVet\output\frontend-administrativo-incremento-1-2026-10-22`

- [Formulario veterinario en computador](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-administrativo-incremento-1-2026-10-22/veterinario-edicion-computador.png).
- [Detalle veterinario en celular](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-administrativo-incremento-1-2026-10-22/veterinario-detalle-movil.png).
- `http-verification.json`: las 94 comprobaciones HTTP del sustituto.
- `browser-http-audit-administrativo.json` y su resumen: **70 eventos completos**, 65 de la API usada por la app y cinco de las herramientas auxiliares. Solo fecha, método, ruta y estado; sin cuerpos, cabeceras ni tokens.
- `backend-cambios-locales.json`: inventario y huellas de los 32 archivos pendientes del backend.

La auditoría confirma la secuencia UTC: logout de A **17:35:17.108**, login de B **17:35:22.557**, lectura de mascotas de B **17:35:22.620**, respuesta tardía 201 de A **17:35:23.340**. Entre esta respuesta y el siguiente logout no hubo solicitudes de detalle/refresco causadas por A. La observación visual del navegador confirmó que B seguía en su portal.

La respuesta cortada se observó en navegador y gateway, pero no produjo un evento HTTP completo del mock; no se suma ficticiamente a esos 70 registros.

Se reutilizó y amplió la simulación local derivada del contrato canónico. La búsqueda del mock del equipo no había sido posible por falta de autenticación Postman al crear la base; no se afirma haber obtenido uno publicado por el equipo. Los JWT son ficticios: estas pruebas no acreditan firma de producción, PostgreSQL, envío SMTP ni recepción de correo. El detalle de reproducción y de fixtures está en [postman/README.md](../postman/README.md).

Se cerraron las sesiones y pestañas de prueba y se detuvieron los servidores temporales 8085/4900; se comprobaron cerrados sus puertos. El servidor 8788 quedó activo con destino al backend real y el login abierto para el usuario.

## 5. Qué tiene el backend local que falta en GitHub

Consulta actual tras `git fetch`: `main` y `origin/main` están en **`0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`**, con **0 commits exclusivos en cada lado**. Hay **21 archivos seguidos modificados y 11 archivos nuevos**, sin cambios preparados en el índice. Son archivos sin commit, no commits pendientes de push.

| Grupo | Cambios que no están guardados en GitHub |
| --- | --- |
| Producción y PostgreSQL externo | Perfil `application-external-postgres.yaml`, separación de Cloud SQL en `application-prod.yaml`, validación de conexión TLS y configuración antes del arranque. |
| Preparación/publicación en Cloud Run | Ampliaciones de `scripts/deploy-google-cloud.ps1`, `scripts/cloudbuild.yaml` y `.gcloudignore`. No se ejecutaron durante este incremento. |
| Gmail | Soporte del proveedor en el validador/despliegue, `scripts/configure-gmail.ps1` y guías/evidencia. El helper conserva credenciales privadas fuera de Git; ese archivo de credenciales no forma parte del inventario. |
| Comprobación HTTP y contrato | `HelloController.java`, permiso público para `GET /api/v1/hello`, descripción OpenAPI sobre Gmail y snapshot con esa ruta. |
| Pruebas | Ampliaciones de diez archivos de prueba y nuevo `SchemaStartupValidationIntegrationTests.java`: citas/correo, recuperación, disponibilidad, mascotas, configuración, personal, foto y registro. No se ejecutó Maven en este trabajo frontend. |
| Documentación | README, ejecución local, Google Cloud/Render, verificación de despliegue/Gmail, revisiones de frontend y el plan administrativo aprobado guardado en backend/docs. |

Que no estén guardados en GitHub **no significa que todo exista solamente en el computador**. En esta revisión, la ruta `/api/v1/hello` respondió 200 desde Cloud Run y el OpenAPI vivo la incluyó, junto con la descripción que menciona Gmail. Eso demuestra parte del comportamiento publicado, no identidad exacta entre todos los archivos locales y la imagen desplegada. No se verificó otra vez recepción de correo ni configuración completa del servicio.

El [inventario completo](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-administrativo-incremento-1-2026-10-22/backend-cambios-locales.json) identifica los 32 archivos y sus huellas. No se hizo commit, push, reversión ni modificación de ninguno durante esta implementación del frontend.

## 6. Pendientes reales y continuidad de Jira

1. Publicar el formulario en una URL HTTPS de activación y configurar/verificar las invitaciones del backend. Sigue pendiente acceso a Cloudflare; no se creó otro despliegue ni se cambió la nube.
2. Comprobar el recorrido completo con cuentas/destinatarios autorizados y servicio real, distinguiendo aceptación SMTP, captura Sandbox y recepción en buzón. La disponibilidad actual de invitaciones de Cloud Run no se dedujo del archivo local ni de la simulación; no se leyó su configuración durante este incremento.
3. Registrar revisión compartida y criterios pendientes de SCRUM-35/75. No se inventaron decisiones de permisos clínicos.
4. No se certificaron builds Android/iOS, todos los escenarios de accesibilidad, PWA instalada/offline ni escrituras pendientes del portal del propietario. El comportamiento de caché existente no almacena navegación con token ni respuestas privadas.

El trabajo aporta a **SCRUM-34/35**, con continuidad de **SCRUM-25/26/75** y evidencia parcial para SCRUM-80. **No se cambiaron estados ni se escribieron comentarios de Jira en este incremento**. Las tareas siguen en curso; no se las cerró con una simulación o un build. El siguiente incremento vuelve a seleccionarse desde Jira.

Para repetir las comprobaciones del proyecto: `npm run check`, `npm run web:build` y `npm run web:pages`. Para fallos reproducibles, seguir la guía Postman y dirigir únicamente el gateway de prueba al sustituto local.
