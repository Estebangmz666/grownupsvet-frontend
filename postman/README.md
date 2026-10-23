# Integración local de las vistas por rol

Este entorno ejecuta un stand-in HTTP del backend con Postman CLI y permite
probar el frontend real sin credenciales ni datos de Cloud Run. No publica un
mock, no modifica la nube y no reemplaza la aceptación contra el backend real.

## Origen del contrato y límites

El punto de partida se generó con `postman mock generate` desde el snapshot
OpenAPI **0.9.0** de `grownupsvet-backend/docs/openapi/openapi.json`. El handler
se ajustó a los DTOs, filtros, paginación, ámbito por rol y permisos de
`authentication/security/UserPermissionResolver.java` de ese backend. Las
respuestas de error conservan la forma de `ApiErrorResponseDTO`.

La búsqueda del mock publicado por el equipo se intentó con
`postman search workspaces grownupsvet-backend -o json` y falló por ausencia de
sesión de Postman. Por eso se utiliza este mock local derivado del contrato;
no se afirma haber revisado ni descargado un mock del propietario.

El alcance modelado es:

- Login y revocación de la sesión presentada; registro público de propietarios con recibo sin sesión.
- Perfil y mascotas propias de OWNER, incluido detalle y aislamiento entre
  dos propietarios ficticios.
- Listas de administradores y veterinarios con estado, páginas desde cero y
  tamaño 20 predeterminado / 100 máximo. Hay 23 administradores y 25 veterinarios
  para recorrer más de una página.
- Agenda con fechas locales inclusivas de Bogotá, máximo 31 días y ámbito
  propio/asignado/global según el rol. Las citas ficticias se muestran en la
  fecha de Bogotá calculada durante la consulta.
- Disponibilidad administrativa: turnos individuales, cambios de hora/estado,
  historial y generación de lotes completos con rechazo de colisiones.
- Citas administrativas: agenda global paginada, detalle e historial,
  confirmación o rechazo de solicitudes con versión observada y replay limitado.

Las operaciones restantes devuelven **501 SIMULATION_ENDPOINT_NOT_MODELED**.
No se simulan creación o edición de mascotas, fotos,
atención clínica ni operaciones fuera del alcance descrito. Un 501 es una
limitación del entorno, no una respuesta atribuida a la API real.

## Continuidad del frontend del 23/10/2026

El mismo contrato local ahora incluye los tres pasos de recuperación:
`POST /auth/password-recoveries` (202 genérico),
`POST /auth/password-recoveries/verifications` (200 con permiso de cinco minutos)
y `POST /auth/password-resets` (204, revoca sesiones anteriores sin iniciar otra).
Conserva los ceros iniciales del código y todos los caracteres de la contraseña.
Valida formato, confirmación, consumo y vencimiento del permiso; reproduce la
espera de un minuto entre solicitudes y cinco fallos por código. No reproduce
todas las cuotas distribuidas por IP/correo ni toda la lista de contraseñas
comunes, cifrado, correo o persistencia del backend real.

Solo en este entorno, `GET /api/__simulation/recovery?email=owner%40roles.test`
permite obtener el código ficticio. No es una ruta del producto y no debe
incluirse en informes ni capturas. `next-authentication` también admite
`recovery-request`, `recovery-verification` y `password-reset`, con demora,
503 o errores de campo (`code`, `newPassword`, `confirmNewPassword`). La fixture
`next-mutation` permite cortar la respuesta después de verificar o restablecer,
para probar resultados inciertos sin reenviar un permiso de un uso.

`POST /api/__simulation/fixture` con
`{"action":"expand-pets","email":"owner@roles.test"}` habilita 25 mascotas
activas: página inicial de 20 y segunda de cinco. `GET /availability-slots`
ofrece un turno ficticio mañana y respeta los rangos consultados, para revisar
el selector y validar el motivo obligatorio sin crear una cita.

Además del verificador HTTP del contrato, se puede ejecutar el cliente real:

```powershell
node postman/scripts/verify_frontend_client_http.mjs
```

Solo usa el puerto local 4900 y reinicia el simulador al empezar/terminar. Compila
el cliente TypeScript con esbuild instalado por las dependencias de desarrollo,
sin sustituir `fetch`; comprueba mascotas paginadas, recuperación, espacios en
la contraseña y revocación. Los resultados sin credenciales quedan en
`postman/.runtime/frontend-client-http.json`. No ejecutar mientras el navegador
esté utilizando las cuentas ficticias.

La foto se verifica por HTTP binario en `profile.api.test.ts`: el modo de
intercepción del simulador convierte multipart a texto y no conserva sus bytes.
Esa prueba local comprueba campo, nombre, MIME y bytes; no certifica el selector
de archivos/transformación en un navegador ni la validación real de imágenes.

Los JWT son ficticios: contienen claims coherentes de identidad, rol, permisos
y expiración, pero su firma no es válida para el backend. La simulación
comprueba sesiones emitidas por ella y su revocación mediante `pm.state`; no
acredita criptografía, SMTP, base de datos ni seguridad del servidor real.

## Revisión administrativa de citas

El entorno conserva las dos citas del día y añade 25 citas para mañana,
permitiendo recorrer dos páginas de 20. Los estados de cita y de asignación
se muestran de forma independiente. Solo el administrador con permisos de
lectura global y gestión puede decidir sobre las solicitudes. Otros roles
conservan su ámbito propio o asignado; el superadministrador no hereda acceso.

`GET /appointments/{id}` y `GET /appointments/{id}/events?page=0&size=20`
devuelven el contrato completo sin correo del propietario. El cambio usa
`PATCH /appointments/{id}/status` con `status`, `expectedVersion` y `reason`
opcional al confirmar, obligatorio para las demás decisiones. El alcance de
revisión original (`CONFIRMED` y `REJECTED`) se amplió con los cambios descritos
en el apartado siguiente; la creación de citas sigue sin modelarse.

Solo en la simulación, la fixture `appointment-state` permite seleccionar una
cita mediante `appointmentId` e inyectar `advanceVersion`, `cutoffPassed` o
`participantInactive`. `next-mutation` puede cortar, demorar o alterar la
respuesta después de aplicar una decisión. Estas rutas de control no existen
en el producto y no se incluyen en el bundle web.

El corte del sustituto usa las 06:00 de Bogotá de la fecha de la cita y puede
alterarse mediante la fixture. No demuestra la configuración, persistencia
ni ejecución del scheduler real. El frontend no recibe ni calcula ese corte.
En la revisión original, sin activar la fixture de cambios, los identificadores
de turno del historial ficticio no enlazan con disponibilidad. La fixture nueva
los enlaza solo dentro del sustituto en memoria. Ninguno de estos recorridos
acredita transacciones, bloqueos, carreras SQL ni avisos de correo.

La cuenta `read-only-administrator@roles.test` es una fixture de permisos con
solo `APPOINTMENT_READ_ALL`. Permite comprobar navegación de consulta y
restauración mediante una petición autorizada; no representa una política de
asignación de permisos o una cuenta existente en el backend real.

Desde PowerShell, con la simulación iniciada y sin un navegador usando sus
datos, ejecutar:

```powershell
python postman/scripts/verify_administrative_appointments_http.py `
  --spec '..\GrownupsVet\grownupsvet-backend\docs\openapi\openapi.json'
node postman/scripts/verify_administrative_appointments_client_http.mjs
```

Ambos verificadores se limitan al puerto local 4900 y reinician datos ficticios.
El primero contrasta respuestas con los esquemas. El segundo compila el cliente
TypeScript real y comprueba paginación, versiones, historial, motivo, corte y
respuestas perdidas/vacías/malformadas/408 después de escribir, sin sustituir
`fetch` ni reenviar automáticamente una decisión. Los informes saneados se
guardan en `postman/.runtime/administrative-appointments-http.json` y
`postman/.runtime/administrative-appointments-client-http.json`.

## Cambios administrativos de citas

El contrato local también modela `CANCELLED`, `NO_SHOW`,
`POST /appointments/{id}/reschedulings` y
`POST /appointments/{id}/veterinarian-reassignments`. Conserva sus diferencias
de plazos, acuerdo, versiones y replay. Reprogramar usa una intención que
incluye al actor; el fingerprint de reasignación del servicio actual no lo
incluye. Ambos replays devuelven la cita actual, incluso si cambió después.

Solo para este recorrido, `prepare-appointment-changes` enlaza las citas
ficticias con turnos del sustituto y añade 25 candidatos publicados y uno
bloqueado por veterinario en el día +3, además de destinos de prueba para
reemplazo a la misma hora y más allá de 60 días. La ocupación y su liberación
se modelan en memoria, sin acreditar las transacciones del backend.
`appointment-veterinarian-unavailable` deshabilita el profesional original
y marca las citas activas para reemplazo. `appointment-state` admite
`timing: ENDED` o `STARTED` para los escenarios temporales ficticios.

Los destinos administrativos se consultan por veterinario con estado
`PUBLISHED`, rango inclusivo de hasta 31 fechas y páginas de 20. No se usa
`GET /availability-slots`, exclusivo del propietario, ni se presenta un
candidato publicado como libre. El servidor vuelve a comprobar la ocupación.

```powershell
python postman/scripts/verify_appointment_changes_http.py `
  --spec '..\GrownupsVet\grownupsvet-backend\docs\openapi\openapi.json'
node postman/scripts/verify_appointment_changes_client_http.mjs
```

Ejecutar uno por vez, con la simulación iniciada y sin navegador que use esas
agendas. Solo pueden dirigirse a HTTP local en el puerto 4900. El verificador
del cliente compila el TypeScript de producción y usa `fetch` real, sin
sustituir las respuestas. Sus informes saneados quedan en `.runtime/`.

## Iniciar y detener en Windows

Requiere Postman CLI **1.70.0 o posterior**. La preparación se comprobó con
**1.74.0**. Los comandos se ejecutan en PowerShell desde la raíz del frontend:

```powershell
.\postman\scripts\roles-simulation.ps1 -Action Start
.\postman\scripts\roles-simulation.ps1 -Action Status
.\postman\scripts\roles-simulation.ps1 -Action Stop
```

El inicio es oculto y usa el puerto fijo **4900**. Si el puerto ya está ocupado,
el script falla sin detener otro proceso ni escoger un puerto distinto.
Confirma el evento `listening` antes de informar que está activo. La parada
verifica el PID y la fecha de creación del proceso que ocupa ese puerto, y
termina su árbol. Reiniciar restablece el entorno y termina las sesiones
anteriores.

Los registros y el PID permanecen en `postman/.runtime/`, ignorado por Git:

- `roles.ndjson`: eventos de la simulación y peticiones HTTP.
- `roles.err`: avisos y errores de arranque.
- `http-verification.json`: resultados de la comprobación HTTP, sin tokens.
- `availability-batch-client-http.json`: comprobación del cliente real de lotes
  sobre HTTP local, sin tokens ni cuerpos de autenticación.

Estos registros solo contienen datos ficticios en este uso. No deben
versionarse ni reutilizarse para capturar credenciales reales.

## Conectar el frontend real

La base API es `http://127.0.0.1:4900/api/v1`. La simulación utiliza `api` como
`routeKey`, por lo que conserva las rutas `/api/v1` esperadas por el cliente.

Para mantener el mismo origen del navegador, configura **solo el gateway
local** con `UPSTREAM=http://127.0.0.1:4900`. El frontend sigue consultando
`/api/v1` en su dominio local y el gateway reenvía esas peticiones a la
simulación. No configures ese destino local para un despliegue público ni
modifiques Cloud Run para esta comprobación.

Las cuentas de prueba son explícitamente ficticias:

| Rol                                  | Correo                     |
| ------------------------------------ | -------------------------- |
| Propietario                          | `owner@roles.test`         |
| Superadministrador                   | `superadmin@roles.test`    |
| Administrador                        | `administrator@roles.test` |
| Veterinario                          | `veterinarian@roles.test`  |
| Segundo propietario para aislamiento | `other-owner@roles.test`   |

También existen tres fixtures explícitas de fallo para probar la presentación
y recuperación del frontend. Utilizan la misma contraseña ficticia:

| Cuenta                           | Respuesta controlada                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `missing-permission@roles.test`  | Login con rol SUPER_ADMIN y permisos vacíos coherentes entre el DTO y los claims. La interfaz debe bloquear funciones sin hacer una consulta privada.                                             |
| `forbidden@roles.test`           | Login SUPER_ADMIN con permisos normales; la consulta de administradores devuelve 403.                                                                                                             |
| `flaky-administrator@roles.test` | Login ADMINISTRATOR normal. La primera consulta de veterinarios devuelve 200, la segunda 503 y desde la tercera vuelve a 200. El contador usa `pm.state` con prefijo del mock y clave por cuenta. |

Son respuestas de fallo inyectadas para este entorno, no cuentas ni una
política de permisos atribuida al backend real. No añaden endpoints del
producto. Reiniciar la simulación deja los contadores vacíos; no ejecutar
consultas de preparación con la cuenta intermitente antes del recorrido que
se quiera medir.

Contraseña común de simulación: `SimulationOnly!2026`. Nunca utilizarla para
una cuenta real.

## Login y registro público accesibles

`POST /api/v1/auth/registrations` modela el `UserSignupRequestDTO` real: correo,
nombre completo, fecha de nacimiento, teléfono y contraseña. Devuelve `201`
con `{id,email}`; crea una cuenta `OWNER` activa sin sesión, invitación ni
cabecera `Location`. La contraseña se conserva exactamente, incluidos espacios
y puntos de código Unicode. La cuenta puede entrar después por el login normal.
El correo duplicado devuelve `409 EMAIL_ALREADY_REGISTERED` sin `fieldErrors`;
los campos inválidos devuelven `400 VALIDATION_FAILED` con errores por campo.
No admite propiedades de rol o estado suministradas por el cliente.

Este stand-in comprueba la estructura E.164 del teléfono, no toda la metadata
internacional que valida el backend con libphonenumber. Tampoco reproduce toda
la lista de contraseñas comunes: incluye la entrada de longitud válida usada
en la verificación. Esa simplificación no certifica las validaciones reales.

La fixture existente `POST /api/__simulation/fixture` incluye estos controles
de un uso para comprobar que el formulario conserva valores, foco y estado de
carga ante respuestas lentas o fallidas. Pertenecen solo a la simulación:

| Cuerpo JSON                                                                              | Efecto                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"action":"next-authentication","operation":"login","delayMs":5000}`                    | Retrasa hasta 10 segundos la siguiente solicitud de login de estructura válida.                                                                                                                                   |
| `{"action":"next-authentication","operation":"registration","delayMs":5000}`             | Retrasa el siguiente registro válido antes de crear la cuenta.                                                                                                                                                    |
| `{"action":"next-authentication","operation":"registration","errorStatus":503}`          | Devuelve un fallo temporal inyectado sin crear la cuenta. También admite `operation: "login"`. El `503` no es una respuesta documentada de la operación de registro; representa una indisponibilidad del entorno. |
| `{"action":"next-authentication","operation":"registration","fieldError":"phoneNumber"}` | Devuelve `400 VALIDATION_FAILED` de forma controlada, aun cuando el cliente pasó su validación local. Admite cualquiera de los cinco campos del registro.                                                         |
| `{"action":"next-mutation","drop":true}`                                                 | El siguiente registro válido persiste la cuenta en memoria y pierde su respuesta. El proxy devuelve `502`; no se debe asumir que la cuenta no se creó ni reenviar automáticamente.                                |

Los controles `delayMs`, `errorStatus` y `fieldError` pueden combinarse en una
misma fixture; `errorStatus` tiene precedencia sobre `fieldError`. Se consumen
solo por la operación indicada: en registro, tras validar su estructura y sus
campos; en login, tras validar su estructura. La fixture `next-mutation` se
consume después de una escritura válida, como en el incremento de personal.
El reinicio limpia las cuentas registradas y estos controles.

Para comprobar el caso de resultado incierto sin enviar otra alta, utiliza el
login con el mismo correo y contraseña ficticios. La verificación HTTP también
comprueba que un segundo registro recibe `409` y no genera otra cuenta.

## Incremento de gestión de personal

El mismo stand-in conserva los recorridos anteriores y ahora modela:

- Detalle, alta, reemplazo de campos editables y estado de administradores y veterinarios.
- Unicidad de correo y matrícula, normalización de la matrícula y eliminación de biografía con `null` u omisión.
- Título base y pérdida de su publicación cuando cambian sus datos académicos; no se simulan archivos PDF.
- Cuenta pendiente, invitación de 48 horas, reenvío que invalida el enlace previo, cancelación idempotente, separación mínima de 60 segundos y máximo cinco emisiones en 24 horas, incluida la inicial.
- Activación pública de un uso, confirmación exacta, límites de contraseña por puntos de código y rechazo de `films+pic+galeries`, la entrada de longitud válida presente en la lista común versionada del backend consultado.
- Login posterior con la contraseña establecida; rechazo de cuentas pendientes/deshabilitadas y revocación por versión de autenticación. Rehabilitar no revive los tokens previos.

Las altas y modificaciones viven únicamente en memoria del proceso. No se envía correo, no se escribe en Cloud Run y no hay base de datos. No se certifican sus transacciones, cifrado, SMTP, toda la matriz clínica ni cambios futuros sobre citas. Los datos y las reglas se contrastaron con OpenAPI 0.9.0, `StaffManagementService`, `StaffInvitationService`, validadores de usuario y `User` del backend local.

Dos cuentas adicionales inyectan falta de configuración de invitaciones, sin bloquear las listas:

| Cuenta                                 | Efecto controlado                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `unavailable-superadmin@roles.test`    | Alta de administradores y reenvío devuelven 503 `STAFF_INVITATIONS_UNAVAILABLE`. |
| `unavailable-administrator@roles.test` | Alta de veterinarios y reenvío devuelven el mismo 503.                           |

Un alta fallida por esta causa no persiste una cuenta ni una invitación. La contraseña sigue siendo la común ficticia. Esta selección por correo es una fixture, no una política atribuida al servidor real.

### Abrir el enlace de activación sin correo

Las rutas siguientes pertenecen **solo al mock local**. No aparecen en OpenAPI, no deben añadirse al cliente de producto ni utilizarse contra Cloud Run. Permiten inspeccionar una invitación ficticia sin inventar una respuesta de la API real que entregue su token.

Después de crear una cuenta desde el frontend, recuperar su enlace ficticio así:

```powershell
$fixture = Invoke-RestMethod 'http://127.0.0.1:4900/api/__simulation/activation?email=cuenta-creada%40roles.test'
$activationLink = 'http://127.0.0.1:8085/activate-account?token=' + $fixture.token
```

Abrir `$activationLink` en el navegador. Cambiar el puerto 8085 solo por el del frontend local conectado a esta simulación. Leer esta fixture no consume el token y su resultado no debe incluirse en capturas o informes; aunque sea ficticio, conservar el mismo tratamiento prudente que para el enlace real.

La ruta `POST /api/__simulation/fixture` admite estos controles explícitos de prueba:

| Cuerpo JSON                                                                    | Efecto                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"action":"age-invitations","email":"cuenta-creada@roles.test","seconds":61}` | Envejece las fechas de emisión para probar reenvío sin esperar un minuto real. No borra el historial ni la cuota.                                                                                                 |
| `{"action":"expire-invitation","email":"cuenta-creada@roles.test"}`            | Marca vencidos los enlaces de esa cuenta ficticia.                                                                                                                                                                |
| `{"action":"next-mutation","delayMs":3000}`                                    | Retrasa hasta 10 segundos la siguiente respuesta de escritura ya aplicada; permite comprobar una respuesta tardía durante un cambio de sesión.                                                                    |
| `{"action":"next-mutation","drop":true}`                                       | Aplica la siguiente escritura y corta su respuesta. Postman la traduce a un 502 del proxy: es un resultado incierto, no una respuesta HTTP contratada del backend. Consultar después; no repetir automáticamente. |

El control se consume solo tras una mutación válida. `POST /api/__simulation/reset` restablece perfiles, invitaciones y sesiones y limpia estos controles. El verificador termina con ese reinicio para dejar una base limpia al recorrido del navegador. No ejecutar el verificador mientras otro recorrido esté usando estas cuentas.

Ejemplo de envejecimiento seguro, dirigido solo al mock:

```powershell
Invoke-RestMethod 'http://127.0.0.1:4900/api/__simulation/fixture' -Method Post -ContentType 'application/json' `
  -Body '{"action":"age-invitations","email":"cuenta-creada@roles.test","seconds":61}'
```

## Disponibilidad administrativa individual — SCRUM-37

El mismo sustituto incorpora las operaciones existentes de disponibilidad de
`VeterinarianAvailabilityController`: consultar por veterinario, fecha y estado;
publicar un turno; consultar detalle; mover su hora; bloquear/republicar; y
consultar los eventos paginados. El contrato y los DTO provienen del backend
local y del OpenAPI canónico 0.9.0. La generación por lotes queda fuera de este
bloque individual y se describe en la sección siguiente.

Solo `ADMINISTRATOR` con `VETERINARIAN_AVAILABILITY_MANAGE` escribe o consulta
eventos. `VETERINARIAN` consulta únicamente su agenda; OWNER usa las opciones
solicitables de `/availability-slots` y SUPER_ADMIN no hereda estos permisos.
Los turnos concretos duran 30 minutos, empiezan en `:00`/`:30`, requieren
offset y se devuelven en UTC con `timeZone: America/Bogota`. Administración
puede publicar un turno futuro del día actual. La ventana desde mañana hasta
60 días corresponde a la selección del propietario.

El estado vive en memoria, incluidas versiones y eventos. PUT y PATCH requieren
`expectedVersion` numérico entero y `reason` no vacío de hasta 500 unidades
UTF-16 antes de normalizarlo. Un cambio efectivo incrementa la versión y
registra el evento; repetir datos sin cambios conserva ambos. El servidor
simulado devuelve los códigos existentes de versión, colisión, fecha pasada,
veterinario inactivo, ocupación e historial de citas. La API pública de opciones
refleja publicaciones, bloqueos, ocupación y estado del profesional.

Al reiniciar, `veterinarian@roles.test` tiene estos turnos ficticios, con horas
de Bogotá:

| Momento      | Estado de prueba                               | Sufijo de UUID |
| ------------ | ---------------------------------------------- | -------------- |
| Mañana 09:00 | Publicado y libre                              | `000000000001` |
| Mañana 09:30 | Bloqueado, versión 1                           | `000000000002` |
| Mañana 10:00 | Publicado, ocupado y con referencia histórica  | `000000000003` |
| Mañana 10:30 | Publicado, únicamente con referencia histórica | `000000000004` |
| Ayer 09:00   | Publicado, pasado y no editable                | `000000000005` |

Los UUID completos usan el prefijo `f1000000-0000-4000-8000-`. Otro veterinario
activo tiene un turno independiente para comprobar el aislamiento por agenda.
La ocupación y las referencias iniciales son fixtures explícitas; no representan
citas creadas ni restricciones de una base de datos real.

Controles exclusivos del entorno local:

| Ruta o cuerpo de fixture                                                                                                          | Uso                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/__simulation/availability?email=veterinarian%40roles.test`                                                              | Devuelve los turnos e indicadores de ocupación/historia para preparar escenarios. Estos indicadores no se añaden al DTO de producto.                                                                       |
| `POST /api/__simulation/fixture` con `{"action":"availability-state","slotId":"UUID ficticio","occupied":true,"referenced":true}` | Marca el turno ficticio como ocupado y referenciado. Para dejar únicamente historia, usar `occupied:false, referenced:true`; ambos `false` retiran esas guardas de prueba. Una ocupación exige referencia. |
| `{"action":"next-mutation","drop":true}`                                                                                          | Después de una escritura válida de disponibilidad, conserva el cambio y corta su respuesta. El proxy devuelve 502; consultar la agenda o el detalle antes de decidir otro envío.                           |
| `{"action":"next-mutation","delayMs":5000}`                                                                                       | Demora la respuesta posterior a una escritura válida, para probar envío repetido y cambio de sesión en la aplicación.                                                                                      |

El fixture no sustituye las pruebas PostgreSQL de ocupación, historial,
transacciones o concurrencia. El interceptor recibe JSON ya interpretado: se
comprueba el valor entero de `expectedVersion`, pero no se acredita aquí la
distinción léxica entre `1`, `1.0` y `1e0` que valida el parser real del backend.
No hay DELETE de turnos y ninguna fixture pertenece al cliente ni al OpenAPI.

## Generación por lotes — SCRUM-37

`POST /veterinarians/{veterinarianId}/availability-slot-batches` usa exactamente
los cinco campos del DTO real: `startDate`, `endDate`, `daysOfWeek`,
`dailyStartTime` y `dailyEndTime`. La respuesta 201 contiene
`{createdCount, items, timeZone}` con los turnos completos, publicados y en
versión cero; este recibo no tiene cabecera `Location`. No es una página.
Solo escribe ADMINISTRATOR con el permiso de gestión de disponibilidad y el
veterinario debe estar activo.

El rango incluye de 1 a 31 fechas locales. Los días ISO son enteros únicos
del 1 (lunes) al 7 (domingo). Las horas usan la cuadrícula de 30 minutos;
`24:00` solo es un fin exclusivo. El resultado debe contener entre 1 y 1000
turnos, todos con inicio futuro. Una fecha pasada dentro del rango no impide
el lote si los días seleccionados la excluyen y todos los inicios generados
son futuros. Administración no hereda el horizonte de 60 días del propietario.

La simulación calcula y valida todo antes de escribir turnos o eventos. Una
colisión, incluso con un turno bloqueado, devuelve 409
`AVAILABILITY_SLOT_CONFLICT` y no deja creaciones parciales. Cada turno creado
añade un evento CREATED. Fechas/horas incompatibles, duplicados de días, un
resultado vacío, pasado o superior al máximo producen 400
`INVALID_AVAILABILITY_REQUEST`. Los errores de estructura y tipos conservan
los códigos del backend. Esta comprobación en memoria no sustituye las
pruebas de transacciones, restricciones y concurrencia de PostgreSQL.

La operación no tiene idempotencia. Para ensayar recibos inciertos, estas
fixtures de prueba alteran la respuesta **después de aplicar el lote completo**:

| Cuerpo de `POST /api/__simulation/fixture`                 | Resultado controlado                       |
| ---------------------------------------------------------- | ------------------------------------------ |
| `{"action":"next-mutation","drop":true}`                   | Corte que Postman traduce a 502 del proxy. |
| `{"action":"next-mutation","delayMs":5000}`                | Respuesta demorada; máximo 10 segundos.    |
| `{"action":"next-mutation","responseMode":"empty"}`        | 201 sin cuerpo.                            |
| `{"action":"next-mutation","responseMode":"invalid-json"}` | 201 con JSON incompleto.                   |
| `{"action":"next-mutation","responseMode":"timeout"}`      | 408 `SIMULATION_RESPONSE_TIMEOUT`.         |

Los recibos rotos y el 408 son fallos inyectados del entorno, no respuestas
conformes atribuidas al endpoint. El control se consume al responder a la
siguiente mutación válida, no exclusivamente a un lote. Para comprobar qué
se aplicó, consultar la agenda en el mismo rango, sin filtro de estado y
recorriendo todas las páginas; no reenviar automáticamente el POST.

Además del verificador Python, el cliente TypeScript real tiene este recorrido
HTTP reproducible:

```powershell
node postman/scripts/verify_availability_batch_client_http.mjs
```

Compila el cliente actual con esbuild y usa únicamente la simulación 4900.
Comprueba el fin `24:00`, colisión tardía sin creaciones parciales y la
consulta de un lote de 144 turnos en dos páginas tras perder su respuesta,
además de recibos vacíos, JSON inválido y 408. El informe saneado queda en
`postman/.runtime/availability-batch-client-http.json`. Reinicia las cuentas
ficticias al empezar y terminar; no ejecutarlo durante un recorrido del navegador.

## Comprobación HTTP y validación del contrato

Requiere Python y `jsonschema`. El parámetro `--spec` debe apuntar al snapshot
canónico del backend en el equipo. Ejemplo para la estructura de este proyecto:

```powershell
python -X utf8 .\postman\scripts\verify_roles_http.py `
  --spec '..\GrownupsVet\grownupsvet-backend\docs\openapi\openapi.json'
```

El script solo admite el puerto de simulación 4900 y rechaza destinos remotos y otros gateways locales. Comprueba login de los cuatro roles,
coherencia de claims, DTOs mediante JSON Schema, límites de páginas y fechas,
errores 400/401/403/404/409/429/503, altas, edición, estados, invitaciones,
activación, recuperación, disponibilidad individual y por lotes, aislamiento y
revocación. La ejecución del **23/10/2026** con lotes verificó **303 peticiones
HTTP**, **256** con respuesta/estado validados contra el snapshot vivo de
OpenAPI 0.9.0 guardado en `output/frontend-lotes-2026-10-23/openapi-live.json`
del directorio GrownupsVet. Incluye los recorridos anteriores; no son 303
pruebas nuevas. El resto incluye fixtures
y cortes controlados identificados, que no se presentan como respuestas del
contrato. El informe saneado quedó en
`C:\Users\ASUS\Documents\ChatGPT\GrownupsVet\output\frontend-lotes-2026-10-23\http-verification.json`.
El corte anterior de disponibilidad individual verificó 243 peticiones y
205 respuestas/estados contra el contrato.
La cifra es una observación de esa ejecución: la prueba de publicación para
el día actual se omite si ya no queda un turno futuro en la cuadrícula de ese
día. El corte anterior del 22/10 de personal verificó 94 peticiones.
Estas cifras se mantienen separadas de las pruebas unitarias y recorridos
del navegador. La ruta
`POST /api/__simulation/reset` se usa únicamente para reiniciar las sesiones
del mock al principio y al terminar: **no pertenece al contrato del backend**.

Esta comprobación acredita el comportamiento del stand-in y sus respuestas
contra el contrato. Para acreditar integración del frontend hay que ejecutar
la aplicación y comprobar sus peticiones en `roles.ndjson`, además del
resultado visible de cada recorrido. Una petición HTTP a este mock por sí
sola no demuestra el funcionamiento del frontend.

## Fallo recuperable del backend simulado

Existe una variante con condición `error: 503` aplicada por Postman a todas
las peticiones del miembro. Para observar restauración con una sesión ya
guardada, primero entrar con la variante normal y después reiniciar:

```powershell
.\postman\scripts\roles-simulation.ps1 -Action Stop
.\postman\scripts\roles-simulation.ps1 -Action Start -Mode unavailable
```

Las condiciones se aplican antes del handler: esas respuestas inyectadas no
aparecen como peticiones servidas por el mock. Esta variante solo acredita el
tratamiento de un 503 simulado si el frontend se ejecuta realmente contra
ella. Volver a `-Mode normal` termina las sesiones del proceso anterior y
requiere un nuevo login para recuperar datos privados.
