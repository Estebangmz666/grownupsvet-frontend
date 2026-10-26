# Verificación del endurecimiento frontend para auditoría

26 de octubre de 2026, America/Bogota.

## Alcance

Fuentes de trabajo: `tmp/audit-hardening-frontend-2026-10-26`, rama
`codex/audit-hardening-2026-10-26`, base
`492c71fc152ddeda55e34df808d0f132cd361dc7`. Esta verificación no acredita un
commit, integración ni publicación de los cambios.

- El cliente conserva `Retry-After` como metadato del error HTTP tanto en
  solicitudes JSON como binarias. Admite segundos enteros y fecha HTTP;
  descarta valores inválidos. Una fecha utiliza `Date` del servidor cuando
  está disponible para reducir diferencias de reloj.
- El acceso presenta HTTP 429 en español, con minutos/segundos cuando el
  servidor informa una espera válida. No muestra detalles de cuenta ni de
  origen. No incorpora reintentos automáticos. La pantalla de acceso no se
  modificó: sus valores permanecen en estado después de un rechazo.
- El contrato coordinado con backend es `LOGIN_RATE_LIMITED`, Problem
  Details existente y `Retry-After` en segundos. El frontend también
  conserva orientación genérica cuando falta la cabecera.
- El workflow conserva `web-dist` durante 30 días.
- README y pendientes aclaran el acceso común por roles, la API P3 del
  backend, la interfaz clínica pendiente y las plantillas de correo ya
  implementadas. Los informes fechados anteriores se preservan.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| `npm ci --no-audit --no-fund` | Correcto: instalación desde lockfile, sin cambios al lockfile. Avisos de dependencias/transporte de scripts no equivalen a evaluación de vulnerabilidades. |
| Tests focalizados del cliente HTTP y formulario | 35 pruebas correctas en 2 archivos. |
| `npm run check` | TypeScript y ESLint sin errores; 835 pruebas correctas en 47 archivos. |
| `npm run web:build` | Correcto; exportación Expo y preparación PWA/gateway. Bundle `index-849530559de64e5e8544abe625088ae4.js`. |
| `git diff --check` | Sin errores. |

Las 17 pruebas añadidas ejercitan 429 en HTTP loopback real, extracción de
cabecera para JSON/raw, fecha HTTP relativa al servidor, fechas pasadas,
valores malformados/desbordados y mensajes españoles sin detalles upstream.
Las solicitudes 429 comprobadas producen un solo envío y no activan el
manejador de sesión no autorizada. Esta prueba de transporte aislado no
acredita el rate limit ni el recorrido autenticado de Cloud Run.

## Límites

Se intentó abrir una pestaña propia para revisar el sitio publicado mediante
CUA, pero el navegador IAB no está disponible y el inventario de navegadores
automatizables está vacío. Las únicas ventanas Brave identificadas
correspondían a actividades ajenas y no se inspeccionaron ni alteraron. No
se acredita en este trabajo operación real por teclado, zoom al 200 %,
lector de pantalla ni evaluación con personas mayores.

No se enviaron credenciales a la API pública, no se crearon cuentas ni se
ejecutaron mutaciones de negocio para esta verificación. Quedan pendientes
la aceptación remota con las cuentas autorizadas, la verificación visual de
429 tras publicar y los recorridos de accesibilidad. No se declara
implementada la interfaz clínica.

## Fuentes

- Expo SDK 57 leído antes de editar código:
  https://docs.expo.dev/versions/v57.0.0/
- Contrato clínico remoto del backend:
  https://github.com/Estebangmz666/grownupsvet-backend/blob/main/docs/atenciones-clinicas.md
- Implementación y verificación de plantillas de correo:
  https://github.com/Estebangmz666/grownupsvet-backend/blob/main/docs/verificacion-plantillas-correo-2026-10-23.md

La implementación remota base del backend que conserva estas fuentes fue
identificada por el agente responsable como
`736805879fcb6ffe968242d0647439fbe0ddf3f6`. Las evidencias de SMTP y recepción
se evalúan de forma independiente.
