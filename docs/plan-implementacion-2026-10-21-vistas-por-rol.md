# Plan de implementación: acceso común y vistas por rol

Fecha: 21 de octubre de 2026, America/Bogota.
Estado original del 21/10: plan redactado; implementación y verificaciones futuras pendientes.
Antecedente: [plan del plan](preplan-vistas-por-rol-2026-10-21.md).

**Actualización del 22/10/2026:** Esteban autorizó ejecutar este plan. Las cuatro áreas y la sesión común quedaron implementadas localmente, con comprobaciones automáticas y recorridos web contra una simulación del contrato. La aceptación con cuentas reales de los cuatro roles y la publicación siguen pendientes. Consultar [implementación y evidencia](verificacion-vistas-por-rol-2026-10-22.md). El resto del documento conserva las decisiones y el contexto de la planificación original.

## 1. Resultado que buscamos

GrownupsVet conservará una entrada y un login. Después de autenticar, la aplicación mostrará el área correspondiente a `user.role` y únicamente las funciones respaldadas por `user.permissions`. El personal dejará de entrar a «Mis mascotas».

El incremento se considerará completo cuando los cuatro roles tengan una entrada útil, con sesión recuperable al recargar y cierre de sesión correcto:

| Rol | Destino inicial previsto | Función del incremento |
| --- | --- | --- |
| `OWNER` | Mis mascotas | Conservar y comprobar las pantallas existentes de mascotas, citas y perfil. |
| `SUPER_ADMIN` | Administradores | Listado real, paginado y filtrable por estado. |
| `ADMINISTRATOR` | Veterinarios | Listado real, paginado y filtrable por estado. |
| `VETERINARIAN` | Mi agenda | Consulta paginada de las citas asignadas para el día seleccionado. |

La propuesta anterior concreta destinos coherentes con las responsabilidades ya existentes. La creación, edición o deshabilitación de personal y la gestión de citas no forman parte de este incremento. Las entradas de administrador y veterinario se completarán después de la primera entrega de propietario/superadmin, dentro del mismo plan; esa primera entrega no se presentará como terminación de los cuatro roles.

## 2. Autorización y decisiones de partida

| Decisión | Origen y estado |
| --- | --- |
| Una entrada, un login y vistas diferentes por rol | Solicitado por Esteban. |
| Entrega orientada a navegador en computador y celular | Confirmado por Esteban; no se exige una aplicación instalable nativa. |
| Mantener Expo, React Native Web, TypeScript y React Navigation | Decisión técnica para aprovechar el código actual. No se propone otro framework ni otro runtime. |
| Usar la identidad y los permisos recibidos del backend | Solicitado por Esteban y respaldado por el contrato publicado. |
| Empezar por consultas de solo lectura para el personal | Alcance técnico propuesto en este plan, basado en operaciones existentes. Evita depender de invitaciones o de nuevas reglas clínicas. |
| Conservar almacenamiento web por pestaña | Se mantiene el comportamiento actual de `sessionStorage`; no se agrega «recordarme». |
| Esperar acceso a la cuenta de Cloudflare del compañero | Elegido por Esteban. La publicación es un pendiente separado. |

Esta instrucción autoriza redactar el plan. No autoriza ejecutar sus cambios, pruebas, instalaciones, despliegues, commits o actualizaciones de Jira. En esta revisión únicamente se consultaron fuentes y referencias remotas y se escribió este documento.

## 3. Punto de partida verificado

### Repositorios

| Repositorio | Ruta local | Rama y base |
| --- | --- | --- |
| Frontend | `C:\Users\ASUS\Documents\ChatGPT\grownupsvet-frontend` | `codex/fix-web-cloudflare`; base `a028b06c0a744483646768fa0da7e629d3074fd2`. |
| Backend | `C:\Users\ASUS\Documents\ChatGPT\GrownupsVet\grownupsvet-backend` | `main`; base `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`. |

Se ejecutó `git fetch --no-tags origin` en ambos repositorios. Las bases coinciden con `origin/master` del frontend y `origin/main` del backend: cero commits de diferencia. Ambos árboles tienen cambios locales de trabajos anteriores; esa coincidencia no incluye los cambios sin commit ni demuestra equivalencia completa con el despliegue.

Antes de crear este plan, el frontend tenía 13 archivos seguidos con cambios, 7 archivos nuevos y ningún cambio de contenido preparado en el índice. Se preservarán las correcciones web, los módulos recuperados y los documentos anteriores. No se integrarán cambios ajenos ni se publicará el conjunto de modificaciones automáticamente.

### Contrato y funcionamiento conocido

Se consultó nuevamente el [OpenAPI publicado](https://grownupsvet-backend-w5glrcsyda-uc.a.run.app/v3/api-docs): versión funcional `0.9.0`.

- La respuesta de login contiene `accessToken`, `tokenType`, `expiresIn` y `user`.
- `user` contiene `id`, `email`, `role` y `permissions`. No contiene nombre completo.
- Los cuatro roles publicados son `OWNER`, `VETERINARIAN`, `ADMINISTRATOR` y `SUPER_ADMIN`.
- Existe `DELETE /api/v1/auth/sessions/current`; no existe un `GET` de ese recurso ni un refresh token.
- `GET /api/v1/users/me` es el perfil de propietario y exige `PROFILE_READ_SELF`.
- El frontend actual monta `PropietarioApp`, cuyo proveedor de sesión y navegador pertenecen al módulo de propietario. Todo usuario autenticado termina en sus pestañas.
- La restauración actual consulta el perfil de propietario. Por eso no sirve para el personal y, además, ese perfil no devuelve `permissions`.
- En la sesión anterior se verificaron la compilación web y 50 pruebas. Esteban comprobó el login de superadmin y mostró las solicitudes en los registros de Cloud Run. Son antecedentes; no se ejecutaron nuevamente pruebas en esta planificación ni se consideran verificadas las vistas futuras.

## 4. Alcance y límites

### Incluido

- Un proveedor de autenticación compartido y un solo navegador raíz.
- Reutilización del acceso, registro y recuperación existentes como flujo público común.
- Selección exhaustiva de área por rol y comprobación de permisos antes de montar cada función.
- Restauración de sesión para los cuatro roles, vencimiento, cierre y tratamiento separado de errores de autenticación, autorización y conexión.
- Listas de administradores y veterinarios; agenda diaria asignada del veterinario.
- Paginación, filtros admitidos por el contrato y estados de carga, vacío, error y acceso denegado.
- Conservación de las pantallas de propietario y comprobación de sus recorridos afectados por el traslado de la sesión.
- Uso del gateway web existente hacia Cloud Run; ninguna modificación de infraestructura.

### Fuera del incremento

- P3: historias clínicas, atención, fórmulas, tratamientos y controles.
- Crear, editar, habilitar/deshabilitar o invitar personal; activación de cuentas y configuración del correo.
- Gestionar turnos, títulos/diplomas, reprogramar, confirmar o cancelar citas desde el área de personal.
- Perfil editable del personal, métricas de negocio y tableros con cifras no respaldadas por consultas existentes.
- Nuevos roles, herencia de permisos, selección manual de rol o cambio de rol desde la interfaz.
- Nuevos endpoints, cambios de contrato del backend, migraciones o ampliación de permisos para evitar errores visuales.
- Nuevas rutas web como `/admin`, enlaces profundos o persistencia del historial de navegación. Se conserva inicialmente la entrada `/` y la navegación en memoria.
- Operaciones privadas offline, sincronización pendiente, notificaciones push y persistencia de respuestas de API en la PWA.
- Publicación en Cloudflare, compromisos de entrega o cronogramas.

Una necesidad de contrato nueva o una contradicción con las responsabilidades vigentes se presentará a Esteban antes de implementarla. No se resolverá inventando una ruta o una regla de negocio.

## 5. Matriz de rol, permisos y vistas

El rol selecciona el área; los permisos recibidos habilitan sus funciones. No se reconstruirán permisos por el nombre del rol. La matriz indica qué permisos requiere cada vista, no una lista de privilegios que el frontend pueda conceder.

| Rol | Vista o función | Permiso requerido | Límite |
| --- | --- | --- | --- |
| `OWNER` | Mascotas y detalle | `PET_READ_SELF`; acciones existentes según `PET_CREATE_SELF` y `PET_UPDATE_SELF` | Solo recursos del propietario, comprobados por el servidor. |
| `OWNER` | Citas | `APPOINTMENT_READ_SELF`; solicitud existente según `APPOINTMENT_CREATE_SELF` | No agregar cancelación/reprogramación autónoma. |
| `OWNER` | Perfil | `PROFILE_READ_SELF`; acciones existentes según sus permisos de perfil | No reutilizar esta pantalla como perfil del personal. |
| `SUPER_ADMIN` | Administradores | `ADMINISTRATOR_MANAGE` | No hereda las vistas de veterinarios, agenda o mascotas. |
| `ADMINISTRATOR` | Veterinarios | `VETERINARIAN_MANAGE` | Lectura en este incremento. |
| `VETERINARIAN` | Mi agenda | `APPOINTMENT_READ_ASSIGNED` | El servidor filtra las citas asignadas antes de paginar. |

Disponibilidad, acciones administrativas, fotos y otros permisos del backend no implican automáticamente una pantalla nueva dentro de este alcance. Sus módulos se incorporarán en incrementos posteriores.

Se rechazará una respuesta de sesión con campos obligatorios ausentes o tipos incompatibles. Un rol desconocido nunca caerá por defecto en propietario. Una lista de permisos vacía no se reemplazará por privilegios supuestos: se mostrará un acceso controlado sin funciones habilitadas y una opción de salida. Los permisos desconocidos no habilitarán menús nuevos.

## 6. Contratos existentes que se consumirán

| Uso | Operación existente | Condiciones |
| --- | --- | --- |
| Login común | `POST /api/v1/auth/sessions` | La identidad proviene de `response.user`. No solicitar rol en el formulario. |
| Cerrar la sesión del servidor | `DELETE /api/v1/auth/sessions/current` | Revoca el token presentado. No equivale a cerrar todas las sesiones de la cuenta. |
| Restauración del propietario | `GET /api/v1/users/me` | Solo `OWNER`; no reemplaza el snapshot de permisos con un DTO que no los contiene. |
| Administradores | `GET /api/v1/administrators` | `page`, `size`, `status` opcional. |
| Veterinarios administrativos | `GET /api/v1/veterinarians` | `page`, `size`, `status` opcional. No es el directorio público del propietario. |
| Agenda del veterinario | `GET /api/v1/appointments` | `from`, `to`, `page`, `size`; `status` existe, pero no se necesita añadir ese filtro en la primera agenda diaria. |

Las listas utilizan `items`, `page`, `size`, `totalElements` y `totalPages`. Las páginas comienzan en cero; se usará inicialmente tamaño 20, con máximo contractual 100. La interfaz mostrará numeración de páginas comprensible y reiniciará a la primera al cambiar un filtro o un día.

Para administradores y veterinarios, «Todos» omite `status`. Los estados son `PENDING_ACTIVATION`, `ACTIVE` y `DISABLED`. No existe búsqueda por texto ni ordenamiento arbitrario en estos GET: no se añadirá un buscador que solo filtre la página visible y aparente buscar en todo el conjunto.

La agenda diaria calculará «hoy» en `America/Bogota` y enviará `from = to = día seleccionado` como `YYYY-MM-DD`. Mostrará horas en esa misma zona. El contrato permite rangos inclusivos de hasta 31 fechas; no se necesita ese rango completo para la primera vista diaria. No se enviarán filtros inexistentes como `veterinarianId`, `ownerId` o `assignmentStatus` a `/appointments`.

Los estados de cita son `REQUESTED`, `CONFIRMED`, `REJECTED`, `CANCELLED` y `NO_SHOW`. `assignmentStatus` es un campo separado (`ASSIGNED` o `NEEDS_REASSIGNMENT`). Un estado futuro desconocido tendrá presentación neutra, sin habilitar acciones por inferencia.

## 7. Diseño de la sesión compartida

### 7.1 Información conservada

Se propone una instantánea versionada de sesión que reúna el token, la identidad del login, rol, permisos y vencimiento absoluto. Se guardará como una unidad para evitar combinar el token de una cuenta con la identidad de otra.

- Web: mantener `sessionStorage`, con respaldo en memoria cuando el navegador impida usarlo. En ese caso, la sesión no sobrevivirá a una recarga.
- Mantener una interfaz equivalente para el almacenamiento nativo existente; no se cambia la tecnología ni se exige certificar Android/iOS en este incremento web.
- Calcular el vencimiento absoluto una sola vez con `expiresIn` de la respuesta y el instante de recepción, sin superar el `exp` del token. No recalcular «ahora + expiresIn» en cada recarga.
- No guardar contraseñas ni respuestas privadas de módulos dentro de esa instantánea.
- Los tipos TypeScript no bastan: validar la forma de la respuesta y del almacenamiento en ejecución.
- Antes de guardar o restaurar, comprobar que `user.id`, `email`, `role` y `permissions` correspondan a los claims `sub`, `email`, `role` y `permissions` del token. Comparar los permisos como conjunto y validar la forma del payload y de `exp`. Una discrepancia, token ilegible o identidad incompleta exige nuevo login, sin elegir otro rol.
- Decodificar ese payload solo detecta una instantánea incoherente: no verifica la firma ni autentica. Es importante porque `/appointments` admite varios roles; su `200` no identifica por sí solo el rol guardado en el navegador. El servidor seguirá comprobando firma, vigencia, identidad y autorización del token antes de devolver datos.
- Los datos guardados, los claims decodificados y el reloj local no prueban permisos vigentes ni estado actual de la cuenta. La comprobación remota continúa siendo necesaria al restaurar.

Para migrar el almacenamiento antiguo que contiene solo un token, se solicitará un nuevo login una vez. No se inventarán permisos ni se supondrá que el token antiguo pertenece a un propietario. Esta limpieza local no se anunciará como revocación global de sesiones.

### 7.2 Entrada y recarga

Después de un login válido, conservar la respuesta completa necesaria y seleccionar el área autorizada. Tras una recarga, restaurar la instantánea solo como **pendiente de comprobación**, sin mostrar datos privados anteriores ni presentar la cuenta como validada actualmente.

La comprobación utilizará una lectura permitida por el rol:

| Rol | Lectura para confirmar el acceso al restaurar |
| --- | --- |
| `OWNER` | Perfil propio existente. |
| `SUPER_ADMIN` | Primera página de administradores. |
| `ADMINISTRATOR` | Primera página de veterinarios. |
| `VETERINARIAN` | Primera página de citas asignadas del día de Bogotá. |

Para el personal, esa lectura será la carga real del módulo inicial: se reutilizará su resultado, sin repetir la misma consulta solo para validar la sesión. Se utilizará una función de carga por destino compartida por la restauración y la pantalla inicial, evitando que una pantalla tenga que montarse con datos privados sin comprobar para iniciar su propia validación.

Un `200` con una lista vacía también es válido. Esa respuesta acredita que el servidor aceptó la solicitud en ese momento; no garantiza vigencia permanente. El backend actual contrasta cuenta activa, versión de autenticación, rol, permisos y revocación en cada petición protegida.

### 7.3 Errores y transiciones

| Situación | Comportamiento previsto |
| --- | --- |
| No hay sesión, está incompleta o venció localmente | Limpiar la instantánea inválida y mostrar el login común. |
| `401` de una petición protegida de la sesión vigente | Limpiar una sola vez, desmontar el área privada y pedir nuevo login. |
| `403` | Mostrar acceso denegado a esa función; no confundirlo con contraseña incorrecta ni cerrar automáticamente una sesión por cualquier operación prohibida. |
| `403` en la comprobación inicial del destino | Mantener una pantalla controlada sin datos privados, con reintento y salida; no redirigir a otro rol ni recorrer endpoints para adivinar privilegios. |
| Error de red o `5xx` al restaurar | Conservar la instantánea sin confirmar, bloquear la vista privada y permitir reintentar o salir. No anunciar funcionamiento offline. |
| Error de red dentro de un módulo ya abierto | Mostrar fallo de carga y reintento, sin presentar datos anteriores como actualizados ni sustituirlos por una lista vacía ficticia. |
| Datos de sesión o rol no reconocidos | Estado controlado de acceso no disponible, sin montar módulos privados; permitir volver al acceso. |

No hay renovación de tokens en el contrato. Al vencer o recibir rechazo del servidor se requiere nuevo login. Si el backend cambia rol/permisos y rechaza el token, no se «arreglará» modificando el snapshot local.

### 7.4 Cierre, cambio de usuario y respuestas tardías

- Capturar la sesión que se cierra y desmontar inmediatamente su navegación y sus datos privados.
- Limpiar el almacenamiento local incluso si falla la revocación del servidor.
- Si el propio almacenamiento impide la limpieza, invalidar inmediatamente el estado en memoria y mostrar el fallo; no afirmar que se borró de forma persistente. No reutilizar el registro afectado dentro de la instancia ni ocultar el problema detrás de un supuesto cierre exitoso.
- La revocación deberá utilizar explícitamente el token capturado de esa sesión; nunca el de una cuenta que inicie después. No registrar ese token.
- Si la revocación no pudo confirmarse, informar que el acceso local terminó y que no se confirmó el cierre en el servidor; no afirmar una revocación exitosa.
- Mantener una generación de sesión/operación. Cada solicitud capturará token y generación de una misma instantánea antes de enviarse.
- Una restauración, login, logout, limpieza de almacenamiento, carga o `401` antiguo no podrá guardar credenciales, repoblar vistas ni modificar o cerrar una sesión posterior. Conservar la deduplicación actual de `401`, limitada a la generación afectada.
- Serializar las mutaciones del almacenamiento y comprobar su generación antes de ejecutarlas y de actualizar el contexto. El guardado de una sesión nueva debe quedar después de cualquier limpieza local anterior que ya esté en curso. La revocación remota anterior puede terminar después, pero su callback no alterará la sesión nueva.
- Cancelar solicitudes donde sea viable e ignorar de todas formas las respuestas cuya generación ya no esté vigente.
- Reiniciar navegación por identidad y generación, no solo por rol. Dos propietarios distintos tampoco deben compartir el historial o los datos de pantalla.

## 8. Organización de la aplicación

Se mantendrá un único runtime Expo en la raíz y un único `NavigationContainer`. Propietario y personal serán módulos de una misma aplicación, sin proveedores de sesión duplicados.

Los siguientes nombres y rutas nuevas son **propuestas de implementación**, no archivos ya existentes:

| Ubicación | Cambio previsto |
| --- | --- |
| `App.tsx` | Componer el proveedor común, navegador raíz y barra de estado. Dejar de montar propietario como aplicación completa para cualquier rol. |
| Nuevo `packages/authentication/src/` | Trasladar proveedor, contexto, hook y almacenamiento de sesión. Usar nombres claros como `AuthenticationProvider`, `AuthenticatedSessionSnapshot` y `useAuthentication`. |
| Nuevo `src/navigation/RootNavigator.tsx` | Resolver estados públicos, comprobación, errores y área privada según rol/permisos. |
| Nuevo `src/navigation/AuthenticationNavigator.tsx` y `src/screens/auth/` | Trasladar el flujo público existente, preservando registro, login y recuperación. No rediseñar esos formularios durante el traslado. |
| `apps/propietario/src/` | Exponer su navegación y conservar mascotas, citas y perfil, sin un segundo proveedor o contenedor. Actualizar imports de autenticación. |
| Nuevo `apps/administrativo/src/navigation/AdministrativeNavigator.tsx` | Seleccionar el módulo de personal correspondiente; sin dependencia del módulo de propietario. |
| Nuevas pantallas `AdministratorsListScreen`, `VeterinariansListScreen`, `AssignedAppointmentsScreen` | Implementar las tres consultas iniciales de personal, con contratos y límites de este plan. |
| `packages/api-client/src/` | Conservar el cliente compartido; añadir las lecturas de personal faltantes y los DTOs necesarios con nombres explícitos. Adaptar el contexto de cada solicitud y la revocación a la sesión capturada. |
| `packages/accessibility-kit/` | Reutilizar colores, tamaños, carga, vacío y error. No introducir otra biblioteca visual. |
| Manifiestos de workspaces y `tsconfig.json` | Incorporar el paquete compartido, la entrada del área administrativa y `src`, `App.tsx` e `index.ts` al alcance de tipos. Mantener el lockfile coherente. |

La configuración de URL de API se moverá a una ubicación común y se pasará al proveedor, evitando que el paquete de autenticación importe archivos del propietario. No se duplicará la política del gateway ni se cambiará Cloud Run para este trabajo.

Las pantallas privadas tendrán guardas aunque el acceso no aparezca en un menú. No se agregarán rutas web directas en este incremento: al recargar se regresará al destino inicial del rol, sin prometer restaurar una pantalla interna o un formulario en edición.

## 9. Comportamiento de las primeras vistas

### Propietario

Conservar las pestañas Mascotas, Citas y Perfil y sus operaciones existentes. No presentar ese conjunto a personal. El traslado de autenticación debe preservar sus formularios, navegación, errores y cierre de sesión; su funcionamiento completo tendrá que comprobarse, sin inferirlo únicamente por la presencia del código.

### Personal

Una estructura compartida mostrará el nombre del área, una etiqueta de rol en español, el correo del login y «Cerrar sesión». No se derivará un nombre personal del correo ni se pedirá el perfil OWNER para obtenerlo.

| Vista | Información inicial | Controles incluidos |
| --- | --- | --- |
| Administradores | Nombre, correo y estado de cada registro. El contrato también ofrece fechas, que pueden mostrarse como información secundaria. | Estado «Todos/Pendiente de activación/Activo/Deshabilitado», paginación y reintento. |
| Veterinarios | Nombre, matrícula profesional, teléfono profesional y estado. | Mismo filtro de estado, paginación y reintento. |
| Mi agenda | Día seleccionado, hora de Bogotá, mascota y estado de las citas asignadas. | Día anterior, hoy, día siguiente, paginación y reintento. |

No habrá botones de crear, editar, activar o atender que todavía no funcionen. Una lista vacía explicará que no hay registros para la consulta actual; no se confundirá con falta de permiso ni error de red.

En computador se podrán usar filas con encabezados claros; en celular, tarjetas o una distribución equivalente sin perder información ni acciones. Se conservarán etiquetas, foco visible, uso por teclado, contraste legible y controles de tamaño consistente. Estos criterios se verificarán: el uso del kit no acredita por sí solo cumplimiento completo de accesibilidad.

## 10. Secuencia de implementación futura

No es un cronograma. Cada bloque se cierra con un resultado comprobable antes de ampliar alcance.

1. **Preparar la base compartida.** Confirmar el árbol local, preservar la corrección web, trasladar autenticación y flujo público y exponer los módulos sin duplicar el runtime. El acceso público y el propietario deben seguir funcionando.
2. **Completar sesión y selección de áreas.** Instantánea versionada, restauración por rol, vencimiento, cierre e aislamiento de solicitudes. Ningún rol desconocido ni personal debe caer en propietario.
3. **Primera entrega visible: superadmin y propietario.** Lista real de administradores con estado/paginación y comprobación del portal existente. Las vistas del resto del personal aún no se declararán completas.
4. **Completar entradas de administrador y veterinario.** Lista de veterinarios y agenda asignada, reutilizando la carga inicial para confirmar cada sesión restaurada. Revisar fechas de Bogotá y aislamiento entre roles.
5. **Verificar el incremento completo.** Ejecutar las pruebas y recorridos de la sección siguiente, registrar resultados y actualizar documentación. Las partes todavía sin evidencia quedarán identificadas como pendientes.

Durante la construcción, cada destino que aún no tenga su módulo disponible permanecerá en un estado controlado con identidad y salida, sin simular consultas terminadas. Es un estado intermedio de desarrollo; no satisface las condiciones de cierre del incremento.

## 11. Verificación prevista

No se ejecutaron estas verificaciones al redactar el plan. Se aprovechará Vitest y la comprobación de tipos existentes; se comprobarán decisiones de acceso, persistencia y aislamiento observables, evitando pruebas que solo repitan el código.

| Escenario | Evidencia esperada |
| --- | --- |
| Inicio sin sesión | Login común; ninguna consulta privada anticipada. |
| Login de cada uno de los cuatro roles | Destino de la matriz y permisos recibidos; sin selector manual ni inferencia por correo. |
| Personal autenticado | No se monta el árbol OWNER ni se solicita `/users/me` o `/pets` por iniciar el área de personal. |
| Recarga con sesión válida | Conserva el destino de rol, hace su lectura permitida y admite un `200` vacío. |
| Recargas repetidas | No extienden el vencimiento absoluto. |
| Token antiguo sin snapshot o almacenamiento corrupto | Reautenticación o estado controlado, sin permisos inventados. |
| Snapshot con rol/identidad/permisos distintos de los claims del token | Rechazo antes de montar el área. Incluir token OWNER con snapshot VETERINARIAN: el acceso compartido a `/appointments` no debe permitir mostrar una vista incorrecta. |
| Rol desconocido, permiso requerido ausente y permiso nuevo desconocido | No habilitan módulos privados indebidos ni cambian el rol por defecto. |
| Token vencido, revocado o cuenta deshabilitada | Rechazo del backend y limpieza controlada de la sesión vigente. |
| Varios `401` de la misma sesión | Un único cierre y mensaje coherente. |
| `403` de una función | Acceso denegado, sin convertirlo en error de contraseña ni ampliar privilegios. |
| Red/`5xx` durante restauración | Estado pendiente sin contenido privado y reintento recuperable. |
| Logout lento o fallido | Desmontaje inmediato, limpieza local y estado de revocación informado con precisión. |
| Almacenamiento bloqueado o limpieza persistente fallida | Respaldo en memoria cuando corresponda, aviso honesto y ninguna garantía ficticia de restauración o borrado. |
| Usuario A sale y entra B, incluso con el mismo rol | Sin historial, formularios ni registros de A en B. |
| Respuesta, login o `401` de A llega después de B | No modifica ni cierra B. |
| Logout, limpieza o callback de A termina después del acceso de B | B conserva token, identidad, vista y almacenamiento; la revocación utiliza únicamente el token capturado de A. |
| Cambio de filtro/página/día durante solicitudes | Gana la consulta vigente; no se mezclan páginas ni se repueblan datos antiguos. |
| Listas con varios estados y varias páginas | Filtro contractual, conteos reales, página cero interna y reinicio al cambiar filtro. |
| Agenda con dispositivo en otra zona horaria | Día y horas coherentes con Bogotá; límites de fecha válidos. |
| Propietario existente | Acceso, registro, recuperación, mascotas, citas, perfil y cierre afectados por el traslado conservan sus recorridos. |
| Navegación y controles | Atrás no recupera datos tras salir; teclado, foco y pantallas pequeñas permiten operar. |
| PWA y gateway | No se guardan respuestas privadas para offline; se conserva la conexión de mismo origen y la compilación de Pages. |

Los casos de parser, selector de área, almacenamiento, vencimiento y respuestas tardías se cubrirán con datos ficticios y dobles de red. Los recorridos reales usarán cuentas de prueba autorizadas por rol; Esteban introducirá sus credenciales cuando corresponda. No se copiarán tokens o contraseñas a documentos, capturas ni repositorios. Para este alcance de lectura no es necesario alterar datos reales ni activar cuentas automáticamente.

Comandos previstos para PowerShell, desde la raíz del frontend:

```powershell
npm ci
npm run check
npm run web:build
npm run web:pages
```

Luego se comprobará el navegador local y se contrastarán solicitudes y estados con los registros de Cloud Run. Un login exitoso no acredita todos los módulos; una prueba simulada no acredita integración real. Si faltan cuentas de administrador o veterinario activas, su aceptación real quedará pendiente aunque los casos automatizados pasen.

## 12. Riesgos y tratamiento

| Riesgo | Tratamiento previsto |
| --- | --- |
| `/users/me` usado como sesión universal | Limitarlo a OWNER; conservar el snapshot de login y confirmar personal con una lectura autorizada. |
| Usar permisos locales como autorización definitiva | Guardas de presentación y comprobación efectiva en el servidor para cada solicitud. |
| Respuestas tardías entre usuarios | Generación de sesión, captura coherente por solicitud, cancelación/descarte y desmontaje privado. |
| Acoplamiento entre propietario y personal | Paquete común de autenticación y composición en la raíz; ningún módulo privado es dueño de la sesión global. |
| Refactorización rompe acceso/recuperación/propietario | Trasladar conservando comportamiento y comprobar regresiones antes de sumar módulos. |
| Alcance crece hasta todo el portal o P3 | Mantener lectura inicial y registrar ampliaciones como incrementos posteriores. |
| No hay acceso a Cloudflare | Verificación local independiente; publicación pendiente por decisión de Esteban. |
| Cambios web anteriores todavía sin publicar | Preservarlos y separar su evidencia de la futura implementación de roles. |
| No hay cuentas activas de los cuatro roles | Automatización con datos ficticios y aceptación real pendiente de esas cuentas; sin inventar resultados. |

No se identificó una pregunta de negocio indispensable para redactar este alcance. Si durante la implementación se pretende añadir «recordarme», uso privado offline, herencia de roles, rutas web nuevas o acciones de escritura, se detendrá esa ampliación y se consultará a Esteban.

## 13. Condiciones de cierre y documentación

El incremento solo se considerará completo cuando:

- Los cuatro roles lleguen a sus destinos con consultas reales permitidas, incluida la recarga.
- El personal no ejecute consultas propias del portal OWNER por iniciar o restaurar sesión.
- Las listas y la agenda cumplan sus filtros, paginación, fechas y estados sin datos inventados.
- El cierre, expiración, `401`, `403`, red y cambios de usuario se comporten según este plan.
- Los cambios no degraden los recorridos del propietario ni el acceso público.
- Pasen las comprobaciones apropiadas y se registre qué fue automatizado, qué se probó contra Cloud Run y qué quedó pendiente.
- El README describa una aplicación y una sesión compartida con dos áreas, y los documentos distingan vistas implementadas de módulos futuros.

Se redactará una verificación fechada con archivos afectados, comandos ejecutados, resultados, capturas sin secretos y limitaciones. Los commits, revisión, push, Jira y despliegue se registrarán como estados separados y solo se realizarán dentro de una autorización posterior aplicable. No se promete una publicación en Cloudflare antes de obtener acceso.

## 14. Fuentes de trazabilidad

Frontend, rutas relativas a este repositorio:

- `App.tsx`, `apps/propietario/src/PropietarioApp.tsx` y `apps/propietario/src/navigation/RootNavigator.tsx`: composición y destino actual.
- `apps/propietario/src/auth/AuthContext.tsx`, `auth-context.ts`, `session.ts` y `session.web.ts`: sesión existente y restauración.
- `packages/api-client/src/auth.api.ts`, `types.ts` y `client.ts`: respuesta tipada, cliente y manejo actual de errores.
- `packages/api-client/src/appointments.api.ts` y `availability.api.ts`: consultas y límites de fecha existentes.
- `packages/accessibility-kit/src/`: elementos visuales y estados reutilizables.
- [Verificación web anterior](verificacion-web-cloudflare-2026-10-21.md): evidencia histórica de este clon, sin extenderla a vistas nuevas.

Backend, bajo `src/main/java/edu/uniquindio/grownupsvet/grownupsvet_backend` de la ruta indicada en la sección 3:

- `authentication/dto/UserLoginResponseDTO.java` y `AuthenticatedUserResponseDTO.java`.
- `authentication/security/UserPermissionResolver.java` y `CurrentAccountJwtValidator.java`.
- `authentication/controller/UserSessionController.java` y `user/controller/OwnerProfileController.java`.
- `staff/controller/AdministratorController.java`, `VeterinarianController.java` y sus DTOs de página/respuesta.
- `appointment/controller/AppointmentController.java` y `appointment/service/AppointmentService.java`.
- `availability/controller/VeterinarianAvailabilityController.java` y `AvailableVeterinarianSlotController.java`, para límites de módulos posteriores.
- [Contrato OpenAPI desplegado](https://grownupsvet-backend-w5glrcsyda-uc.a.run.app/v3/api-docs), versión `0.9.0`, leído en esta revisión.

Esta entrega termina en el plan. No se implementaron sus cambios ni se ejecutaron sus verificaciones futuras.
