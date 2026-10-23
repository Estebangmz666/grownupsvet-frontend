# GrownupsVet frontend

Sitio publicado: [grownupsvet-frontend.pages.dev](https://grownupsvet-frontend.pages.dev).
La [verificación de publicación](docs/publicacion-cloudflare-2026-10-23.md)
identifica el commit, el despliegue y los límites de las comprobaciones reales.
La disponibilidad por lotes se publicó en el commit `b7b735a`; su
[verificación funcional](docs/verificacion-lotes-disponibilidad-2026-10-23.md)
conserva el corte local previo a esa publicación. Cada incremento documenta
por separado su implementación, pruebas y aceptación con el servicio real.

Aplicación web adaptable a computador y celular con Expo SDK 57, React Native
Web y TypeScript. Usa un solo runtime, un navegador raíz, un login y una sesión
común. El rol y los permisos recibidos del backend determinan las vistas
disponibles; la interfaz no solicita elegir un rol ni concede permisos por el
correo. El backend autoriza cada operación.

## Alcance implementado

| Rol             | Área inicial    | Capacidades de la interfaz                                                                                                                                       |
| --------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OWNER`         | Mis mascotas    | Mascotas, citas, avisos de citas y perfil, según los permisos de la sesión.                                                                                      |
| `SUPER_ADMIN`   | Administradores | Listado paginado, detalle, alta, edición, estado e invitaciones de administradores.                                                                              |
| `ADMINISTRATOR` | Administración  | Gestión de veterinarios, formación/diplomas y disponibilidad; agenda e historial de citas, decisiones, reprogramación y reemplazo de veterinario según permisos. |
| `VETERINARIAN`  | Mi agenda       | Consulta de las citas asignadas del día seleccionado en el calendario de Bogotá.                                                                                 |

El acceso público incluye login, registro de propietarios, recuperación de
contraseña en tres pasos y activación de personal mediante invitación. Login,
registro y recuperación comparten etiquetas, ayudas y errores asociados,
mostrar/ocultar contraseña, autocompletado, foco y operación por teclado. Los
formularios permanecen visibles mientras envían y evitan envíos repetidos.
Registro y recuperación muestran su resultado antes de volver al login. Un
resultado incierto de cambio de contraseña o activación bloquea otro envío
desde esa pantalla y orienta a comprobar el acceso mediante login.

En el portal del propietario se puede:

- Consultar mascotas activas y archivadas, ver detalles, crear, editar,
  archivar y reactivar. El archivado conserva la mascota y su historial.
- Consultar citas próximas hasta 60 días y anteriores en incrementos de
  31 días, hasta 12 tramos; recuperar sus páginas y abrir detalles de lectura.
- Solicitar una cita con una mascota activa, motivo obligatorio y un horario
  disponible entre mañana y los próximos 60 días. El selector permite cargar
  más páginas de mascotas y la reserva requiere confirmación.
- Consultar los avisos asociados a una cita y su estado de entrega. `SENT`
  significa aceptación por el servidor de correo, no lectura en el buzón.
- Consultar el perfil, actualizar el teléfono, agregar o quitar una foto,
  cerrar sesión y desactivar la cuenta.

El personal autorizado puede crear y editar sus cuentas permitidas, cambiar
su estado y gestionar invitaciones con confirmaciones. Correo y rol son
inmutables; el alta deja la cuenta pendiente de activación. La ruta pública
`/activate-account?token=…` permite establecer su contraseña. Abrir o recargar
el enlace no lo consume, no produce login automático y no reemplaza una sesión
ya abierta. El token no se guarda en el almacenamiento de sesión y se retira
de la URL al completar o abandonar ese recorrido.

El administrador puede abrir **Gestionar disponibilidad** desde el detalle
del veterinario. Consulta una agenda por día y estado, recorre sus páginas,
publica turnos individuales de 30 minutos, cambia su hora, los bloquea o vuelve
a publicar y consulta su historial. Cada cambio usa confirmación y la versión
observada; edición y estado requieren motivo. Los horarios se muestran en
America/Bogota. Un conflicto conserva la reserva y un resultado incierto exige
consultar antes de decidir otro envío. Requiere el permiso específico de
disponibilidad; no se concede a otros roles por herencia.

Desde esa agenda también puede **Generar lote de turnos**: selecciona entre
1 y 31 fechas inclusivas, días de la semana y una franja diaria dividida en turnos de 30 minutos,
con fin exclusivo y `24:00` permitido al terminar la jornada. La vista previa
muestra fechas y cantidad, hasta 1000 turnos, antes de confirmar. El contrato
rechaza todo el lote si hay una colisión, incluso con un turno bloqueado.
Administración puede generar cualquier inicio futuro; no usa la ventana del
propietario de mañana a 60 días. Un resultado incierto bloquea otro envío y
ofrece consultar todas las fechas y páginas, sin filtro de estado. Esa lectura
muestra la agenda vigente y no prueba qué intento creó los turnos encontrados.

En **Citas**, el administrador con `APPOINTMENT_READ_ALL` consulta una agenda
por rango de hasta 31 fechas inclusivas y estado, con páginas de 20 registros.
El detalle relee la cita actual y su historial paginado. Muestra mascota,
propietario y teléfono autorizado, veterinario, motivo, horario de Bogotá y
estados independientes de cita y asignación, sin solicitar el correo.

Con `APPOINTMENT_MANAGE` puede confirmar o rechazar una solicitud mediante
revisión y confirmación explícitas. El rechazo requiere motivo de hasta 1000
caracteres. El servidor comprueba versión, transición, participantes y corte
persistido; el cliente no inventa una hora de corte a partir del DTO. Un
conflicto o respuesta incierta exige consultar detalle e historial antes de
otra decisión. No se reenvía automáticamente el cambio ni se atribuye a un
intento previo el estado observado después.

Desde el detalle también puede cancelar una solicitud o cita confirmada
antes de su inicio, y registrar inasistencia de una confirmada al terminar
el turno. Ambas decisiones requieren motivo y confirmación; conservan la
cita y su historial, y no reabren estados terminales.

La reprogramación normal ofrece veterinarios activos y sus turnos publicados
por rangos de hasta 31 fechas y páginas de 20. Los candidatos no acreditan
capacidad libre: el servidor comprueba la ocupación al registrar el cambio.
El destino normal debe estar entre mañana y el día 60. Para citas que necesitan
reemplazo por un veterinario inactivo existe una reasignación excepcional,
posible hasta el fin original; sus reglas de destino difieren de la
reprogramación normal y no imponen ese máximo de 60 días.

El cambio de horario requiere constancia del acuerdo previo: canal, fecha,
hora de Bogotá y nota. Reprogramar siempre requiere acuerdo; reemplazar al
veterinario conservando el horario no lo exige. La interfaz convierte la fecha
y hora al contrato del servidor y conserva en memoria la intención enviada.
Una respuesta incierta bloquea otro envío y orienta a consultar el estado
actual y el historial. Un replay idempotente puede devolver una programación
posterior; no se presenta el destino inicialmente seleccionado como vigente
sin comprobar la respuesta.

Desde el detalle administrativo se puede abrir **Ver avisos de la cita**.
La consulta usa `APPOINTMENT_READ_ALL`, también para cuentas de solo lectura,
y muestra los avisos en páginas de 20. Distingue programado, en proceso,
aceptado por el servidor de correo, fallo de envío y aviso que ya no aplica.
Conserva la fecha prevista, el próximo intento pendiente, la fecha de envío
y el último código de fallo público como datos independientes. La aceptación
SMTP no confirma entrega en el buzón ni lectura. Un error de esta consulta
permite reintentar o volver al detalle; no solicita reenviar correos.

Desde el detalle del veterinario se puede **Gestionar formación y diplomas**
con `VETERINARIAN_MANAGE`, aunque la cuenta esté pendiente o deshabilitada.
Permite consultar, crear y editar hasta 20 títulos, incluido el pregrado base
obligatorio, y eliminar títulos adicionales. Los diplomas se cargan como PDF
privados; preparar la descarga, descargarlo y confirmar su revisión preceden
a la confirmación de publicación. Se puede retirar la publicación o eliminar
el PDF conservando el título. Cambiar datos académicos retira la publicación
del diploma sin eliminar su archivo. Una respuesta perdida exige consultar
los datos actuales antes de otra decisión; esa lectura no identifica qué
intento creó un título. El servidor valida la estructura y los límites del PDF.

## Validación y pendientes

La [verificación de formación veterinaria del 23/10/2026](docs/verificacion-formacion-veterinaria-2026-10-23.md)
registra **811 pruebas en 46 archivos**, tipos, lint y exportación web correctos.
Incluye 22 comprobaciones del cliente real mediante 91 peticiones, tres
solicitudes HTTP crudas adicionales y ocho comparaciones de bytes/SHA-256.
Se verificaron alta, PDF privado, descarga idéntica, revisión y publicación,
edición que retira publicación y eliminación separada de PDF/título en el
navegador, con escritorio y móvil de 390 px. Distingue la limitación multipart
de Postman de la prueba binaria loopback y de la aceptación con el servicio
real. Commit, push, CI y despliegue de este incremento quedan pendientes en
ese corte previo a publicación.

La [verificación de avisos administrativos del 23/10/2026](docs/verificacion-avisos-administrativos-2026-10-23.md)
registra **700 pruebas en 44 archivos**, tipos, lint y exportación web correctos.
Incluye 16 comprobaciones del cliente real mediante 30 peticiones y un
verificador independiente de 34 solicitudes, con 24 respuestas contra esquemas.
Se recorrieron paginación, errores, sesión, acceso de solo lectura y móvil
en el navegador, exclusivamente con datos ficticios. El
[inventario de componentes](docs/inventario-portal-administrativo-2026-10-23.md)
conserva el diagnóstico anterior a este incremento y los pendientes por área.

La [verificación de cambios de citas del 23/10/2026](docs/verificacion-cambios-citas-2026-10-23.md)
registra **626 pruebas en 42 archivos**, tipos, lint y exportación web correctos.
Incluye 71 peticiones de contrato (56 respuestas con esquema), 16 comprobaciones
del cliente real mediante 114 peticiones y recorridos locales de las cuatro
operaciones, conflicto de ocupación y respuesta perdida. Se verificaron
paginación, acuerdo con hora de Bogotá, permisos de consulta y diálogo móvil
por teclado. La simulación no acredita transacciones ni correo del servicio real.

La [verificación de citas administrativas del 23/10/2026](docs/verificacion-citas-administrativas-2026-10-23.md)
registra **552 pruebas en 40 archivos**, tipos, lint y exportación web correctos.
Incluye 50 peticiones HTTP nuevas (46 con esquema), 10 comprobaciones del
cliente real mediante 26 peticiones de producto y recorridos de navegador
con datos ficticios. Se comprobaron decisiones, versiones, resultado incierto,
historial paginado, permisos de consulta, foco y presentación móvil. El informe
distingue estos resultados de la aceptación con cuentas y transacciones reales.

La [verificación de lotes del 23/10/2026](docs/verificacion-lotes-disponibilidad-2026-10-23.md)
registra TypeScript, ESLint, **446 pruebas en 38 archivos**, exportación web y
recorridos locales con simulación del contrato OpenAPI 0.9.0. Incluye 56 casos
nuevos de calendario/límites, contrato y presentación, además de publicación,
colisión atómica, resultado incierto y consulta completa de 144 horarios en
dos páginas. Distingue las 303 peticiones del verificador HTTP, las seis
comprobaciones del cliente real y los recorridos de navegador. Se comprobaron
checkbox por teclado, foco, confirmaciones y presentación móvil a 390 px.

La [verificación individual anterior](docs/verificacion-disponibilidad-2026-10-23.md)
conserva su corte de **390 pruebas en 35 archivos**, agenda individual,
versiones, historial, reservas protegidas y reconciliación.

La [continuidad anterior del mismo día](docs/verificacion-continuidad-frontend-2026-10-23.md)
conserva la evidencia de recuperación, resultados inciertos, páginas
adicionales de mascotas, validación del motivo, transporte multipart binario
y rutas estáticas en Windows.

Esa evidencia local no acredita por sí sola una publicación pública ni la
aceptación del servicio real. Continúan pendientes:

- Integración completa con cuentas reales, PostgreSQL, JWT de producción,
  SMTP, recepción de correos e invitaciones configuradas para la URL pública.
- Recorrido completo de selección y procesamiento de una foto en navegador
  y su almacenamiento y lectura mediante el backend. Se comprobó el
  transporte binario del cliente y su aislamiento entre sesiones.
- Aceptación completa de creación de citas y concurrencia contra el servicio
  real, incluida la atomicidad de lotes sobre PostgreSQL; pruebas de
  Android/iOS, instalación y uso sin conexión de la PWA.
- Evaluación integral de accesibilidad con lector de pantalla y personas
  usuarias. Las comprobaciones existentes no constituyen una certificación.
- [Mejora de las plantillas de correo del backend](docs/pendientes-proyecto.md),
  pendiente recordado por el usuario el 23/10/2026.

P3 está **fuera del alcance de esta entrega**, según la aclaración expresa
del usuario del 23/10/2026. Las atenciones, fórmulas, controles y demás
operaciones clínicas de esa fase no son pendientes del frontend P1/P2 ni
bloquean su cierre. No se incluyen cancelación/reprogramación por el
propietario. La agenda del rol veterinario es de consulta.

Las [vistas por rol](docs/verificacion-vistas-por-rol-2026-10-22.md), la
[gestión administrativa](docs/verificacion-incremento-administrativo-1-2026-10-22.md)
y el [acceso público accesible](docs/verificacion-login-signup-accesibilidad-2026-10-22.md)
conservan la evidencia de los incrementos anteriores y sus límites.

## Estructura

```text
grownupsvet-frontend/
  apps/
    propietario/       Mascotas, citas, avisos y perfil
    administrativo/    Personal, disponibilidad individual/lotes y agenda por rol
  src/
    navigation/        Navegación raíz y entrada de activación
    screens/auth/      Login, registro, recuperación y activación
  packages/
    authentication/    Sesión común, persistencia y aislamiento
    api-client/        Operaciones HTTP tipadas
    accessibility-kit/ Componentes y utilidades compartidos
  proxy/               Gateway Node local y worker de Cloudflare Pages
  pwa/                 Manifiesto, registro y política del service worker
  postman/             Simulación local y verificadores con datos ficticios
```

La sesión web usa una instantánea versionada en `sessionStorage`; en móvil
usa `expo-secure-store`. Al recargar, la sesión se comprueba con una lectura
permitida por rol. El vencimiento absoluto no se extiende y las respuestas
tardías de una sesión anterior se descartan. Un error de red conserva una
sesión pendiente de comprobar, sin mostrar datos privados; permite reintentar
o salir. El backend sigue comprobando la firma y la autorización.

Las fotos protegidas se obtienen mediante el cliente autenticado. En web la
carga utiliza un `Blob` binario en `FormData` y conserva el contexto de sesión
capturado antes del selector. No hay renovación automática de tokens ni
funciones privadas sin conexión.

## Instalar y comprobar

Se necesita Node.js 22.13 o posterior de la rama 22. Instala desde la raíz con
el lockfile versionado:

```powershell
npm ci
npm run check
npm run web:build
npm run web:pages
```

La vista local de Pages queda en `http://localhost:8788`. El build exporta
Expo y prepara `dist/` con `index.html`, recursos estáticos, manifiesto,
service worker y el gateway `_worker.js`. Falla si faltan archivos requeridos.

| Script                                | Uso                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm start` / `npm run web`           | Servidor de desarrollo Expo; `web` abre la vista web.                                                 |
| `npm run check`                       | TypeScript, ESLint y pruebas automatizadas.                                                           |
| `npm run build` / `npm run web:build` | Exportación web completa a `dist`.                                                                    |
| `npm run web:pages`                   | Runtime local de Cloudflare Pages con el worker.                                                      |
| `npm run web:serve`                   | Gateway Node alternativo para servir `dist`; puerto 8081 por defecto.                                 |
| `npm run android` / `npm run ios`     | Desarrollo nativo; no acredita aceptación en dispositivo.                                             |
| `npm run web:deploy`                  | Publicación manual mediante Wrangler; requiere acceso, proyecto y rama verificados. No lo ejecuta CI. |

La [guía de simulación](postman/README.md) explica cómo comprobar los recorridos
con datos ficticios. Sus fixtures no pertenecen al producto, no se despliegan
como API pública y no deben utilizarse para capturar credenciales reales.

## Configurar la API

En web, la base predeterminada es `/api/v1`: el navegador y el gateway
comparten origen y el worker reenvía la petición al backend. En nativo es
`http://localhost:8080/api/v1`; para un emulador Android con el backend en la
máquina anfitriona, puede configurarse `http://10.0.2.2:8080/api/v1`.

`EXPO_PUBLIC_API_BASE_URL` cambia la dirección durante la compilación. Las
variables `EXPO_PUBLIC_*` quedan visibles en el bundle: nunca deben contener
contraseñas, claves privadas ni tokens. Para la publicación web habitual,
conserva `/api/v1` y configura el destino del gateway con `UPSTREAM` si hace
falta; no publiques una dirección local del mock.

El backend predeterminado del gateway está en `proxy/policy.mjs`. Su contrato
se mantiene en el [repositorio del backend](https://github.com/Estebangmz666/grownupsvet-backend).
Los permisos y reglas de negocio se validan allí; este repositorio no cambia
su infraestructura ni contiene sus secretos.

El ejemplo de configuración está en `.env.example`. Los archivos `.env`,
`.env.*` y `.dev.vars*` se excluyen de Git, salvo `.env.example`. También se
excluyen `node_modules`, `dist`, `.wrangler` y los registros locales Postman.

## Publicar con Cloudflare Pages y Git

La publicación utiliza la integración Git de **Cloudflare Pages** con
[Estebangmz666/grownupsvet-frontend](https://github.com/Estebangmz666/grownupsvet-frontend).
La rama de producción es **`main`**:

| Campo de Pages            | Configuración                                                       |
| ------------------------- | ------------------------------------------------------------------- |
| Repositorio               | El repositorio autorizado que conserva este trabajo y su historial. |
| Rama de producción        | `main`                                                              |
| Directorio raíz           | Raíz del repositorio.                                               |
| Comando de compilación    | `npm ci && npm run check && npm run web:build`                      |
| Directorio de salida      | `dist`                                                              |
| `NODE_VERSION`            | `22.18.0`                                                           |
| `SKIP_DEPENDENCY_INSTALL` | `1`, ya que el comando anterior instala desde el lockfile.          |

El proyecto es `grownupsvet-frontend`. `wrangler.jsonc` versiona su nombre,
salida, compatibilidad y las dos variables de compilación de la tabla.
Al usar ese archivo, esas variables se mantienen allí como fuente de configuración.
Conserva la base web
`/api/v1`, comprueba el `UPSTREAM` real y deja `PWA_DEV_ORIGINS` vacío en
producción. La guía técnica del gateway está en [proxy/README.md](proxy/README.md).

GitHub Actions ejecuta las comprobaciones y el build en pushes a todas las
ramas y en pull requests. Solo adjunta `dist` si el trabajo termina
correctamente. **No usa credenciales de Cloudflare ni despliega**; Pages
gestiona la publicación mediante su integración Git. Evita habilitar otra vía
automática que publique el mismo cambio dos veces.

Pages ejecuta sus propias comprobaciones antes de publicar: su integración Git
no espera el resultado de GitHub Actions. Si falla una prueba o la exportación,
ese despliegue no reemplaza la versión publicada.

Publicar la exportación sin su worker no proporciona el gateway de API. Tras
publicar, comprueba HTTPS, carga de recursos, cabeceras de `/api/v1` y la ruta
`/activate-account`. La aceptación de login e invitaciones con cuentas reales
requiere su propia comprobación. El informe de publicación conserva la evidencia
del despliegue observado; no sustituye la aceptación de los flujos autenticados.

El service worker conserva únicamente el shell y recursos estáticos
admitidos del mismo origen. Excluye rutas API y peticiones de recursos con
query, autorización o cookies; no almacena respuestas privadas ni tokens de
activación para uso offline. El gateway responde `Cache-Control: no-store`
para la API y añade cabeceras de seguridad.

## Historial y licencia

La copia en otra cuenta debe conservar el historial y la autoría de las
contribuciones del equipo. La licencia incluida permanece en [LICENSE](LICENSE).
Cambiar el remoto o el alojamiento no sustituye esas atribuciones.
