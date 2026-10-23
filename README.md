# GrownupsVet frontend

Sitio publicado: [grownupsvet-frontend.pages.dev](https://grownupsvet-frontend.pages.dev).
La [verificación de publicación](docs/publicacion-cloudflare-2026-10-23.md)
identifica el commit, el despliegue y los límites de las comprobaciones reales.

Aplicación web adaptable a computador y celular con Expo SDK 57, React Native
Web y TypeScript. Usa un solo runtime, un navegador raíz, un login y una sesión
común. El rol y los permisos recibidos del backend determinan las vistas
disponibles; la interfaz no solicita elegir un rol ni concede permisos por el
correo. El backend autoriza cada operación.

## Alcance implementado

| Rol             | Área inicial    | Capacidades de la interfaz                                                                          |
| --------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| `OWNER`         | Mis mascotas    | Mascotas, citas, avisos de citas y perfil, según los permisos de la sesión.                         |
| `SUPER_ADMIN`   | Administradores | Listado paginado, detalle, alta, edición, estado e invitaciones de administradores.                 |
| `ADMINISTRATOR` | Veterinarios    | Gestión de cuentas y perfil profesional base; consulta, publicación, cambio de hora, bloqueo/republicación e historial de turnos individuales. |
| `VETERINARIAN`  | Mi agenda       | Consulta de las citas asignadas del día seleccionado en el calendario de Bogotá.                    |

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

## Validación y pendientes

La [verificación de disponibilidad del 23/10/2026](docs/verificacion-disponibilidad-2026-10-23.md)
registra TypeScript, ESLint, **390 pruebas en 35 archivos**, exportación web y
recorridos locales con simulación del contrato OpenAPI 0.9.0. Incluye agenda
individual, confirmaciones, versiones, historial, reservas protegidas y
reconciliación tras una respuesta perdida. Distingue las pruebas del proyecto,
las comprobaciones HTTP y los recorridos observados en navegador.

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
  real; pruebas de Android/iOS, instalación y uso sin conexión de la PWA.
- Evaluación integral de accesibilidad con lector de pantalla y personas
  usuarias. Las comprobaciones existentes no constituyen una certificación.

No se incluyen generación de turnos por lotes, gestión administrativa de
citas, cancelación o reprogramación por el propietario, atención clínica,
títulos adicionales ni archivos de diplomas. La agenda del rol veterinario
es de consulta.

Las [vistas por rol](docs/verificacion-vistas-por-rol-2026-10-22.md), la
[gestión administrativa](docs/verificacion-incremento-administrativo-1-2026-10-22.md)
y el [acceso público accesible](docs/verificacion-login-signup-accesibilidad-2026-10-22.md)
conservan la evidencia de los incrementos anteriores y sus límites.

## Estructura

```text
grownupsvet-frontend/
  apps/
    propietario/       Mascotas, citas, avisos y perfil
    administrativo/    Personal, disponibilidad individual y agenda por rol
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
