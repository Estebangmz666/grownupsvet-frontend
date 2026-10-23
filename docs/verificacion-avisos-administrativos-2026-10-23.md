# Avisos administrativos de citas: corte local de verificación

Fecha: **23 de octubre de 2026**, zona `America/Bogota`.

**EN ESTE CORTE, commit, push, CI y despliegue están pendientes.** Este
informe acredita implementación y pruebas locales sobre la base frontend
`78cfcfe74d21a43b18a7419307d8e0e1dfdd7005`; no acredita publicación del incremento.
El check final terminó con **700 pruebas en 44 archivos**, TypeScript y
ESLint correctos, salida 0. La exportación web Windows también terminó con salida 0.

## Fuentes y alcance

El [plan](plan-avisos-administrativos-2026-10-23.md) define la consulta de
avisos desde el detalle de una cita. El
[inventario administrativo](inventario-portal-administrativo-2026-10-23.md)
separa capacidades entregadas y pendientes. La
[selección Jira](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/jira-seleccion.json)
se obtuvo en modo de solo lectura: no se cambiaron estados, comentarios ni asignaciones.

El [OpenAPI real](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/openapi-live.json)
respondió **200 a las 16:24:46.969721 UTC**, versión **0.9.0**. La
[comparación](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/openapi-comparison.json)
confirma igualdad de la operación y los dos esquemas seleccionados entre
servicio, HEAD y árbol local. La descarga pública no usó autenticación ni
mutaciones y no constituye una prueba autenticada contra producción.
El [contrato de fuente](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/contrato-avisos-fuente.json)
conserva cinco fuentes con líneas y huellas del backend.

La pantalla usa `GET /api/v1/appointments/{appointmentId}/notifications`,
páginas de 20, con `APPOINTMENT_READ_ALL`; admite administradores de solo
consulta sin exigir permisos de modificación de citas o de veterinarios.
Conserva el orden del servidor y valida los nueve campos del DTO, sus
pertenencias, siete tipos y cinco estados. No expone destinatarios ni correos.
`SENT` describe aceptación por el servidor de correo, sin afirmar entrega o
lectura; un fallo anterior no sustituye el estado actual de un aviso pendiente.

## Verificación automatizada y HTTP

| Conjunto                              | Resultado y evidencia                                                                                                                                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Check global final                    | **700 pruebas / 44 archivos**, tipos y lint correctos, salida 0. [Registro](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/check.log).                                                                                                   |
| Pruebas nuevas incluidas en el global | **60 de API y 14 de presentación**: DTO, pertenencia, sesión, siete tipos, cinco estados y fechas de Bogotá. No se suman otra vez al total.                                                                                                                                   |
| Cliente actual por HTTP               | **16 comprobaciones / 30 GET de producto**, cero escrituras de negocio y cero callbacks `onUnauthorized`. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/client-http-verification.json).                                       |
| Verificador HTTP independiente        | **34 solicitudes / 24 respuestas validadas estructuralmente / 21 GET de producto**, salida 0, cero mutaciones de producto y reset final. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/notifications-http-verification.json). |
| Exportación web Windows               | Salida 0; bundle `index-eee7e403c27354869defc1a97a95a9d9.js`. [Registro](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/web-build.log).                                                                                                  |

El verificador cubrió seis perfiles, acceso administrativo de solo consulta,
401/403/404, paginación inválida, vacíos, página posterior al total y origen
sin cambios. ADMIN obtuvo **20+6** avisos; OWNER, **20+5**, sin el aviso interno
administrativo. Las inyecciones de JSON inválido, campo extra y cita ajena
están identificadas como fallos intencionales: pasar el esquema estructural
no acredita pertenencia semántica. Los informes conservan metadatos saneados.

## Recorridos finales de navegador

Se ejecutó el frontend real en **8085**, mediante gateway hacia la simulación
local **4900**, con datos ficticios. No se usó un dispatcher SMTP ni una base SQL real.

| Recorrido            | Resultado observado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada y paginación | Desde Citas, fecha del 24/10 y Luna 1 (`…003`), un botón abrió 26 avisos en páginas de 20 y 6. Cambiar página o actualizar llevó el foco al encabezado exacto. El contexto mostró mascota e identificador sin GET adicional.                                                                                                                                                                                                                                                                                                                         |
| Fechas y estados     | La fecha prevista `23/10 04:30Z` apareció como **22/10 23:30 Bogotá**, separada del envío **23/10 11:00**. Un `PENDING` conservó el último fallo SMTP y su próximo intento **15:00**. `SENDING`, `FAILED` y `SUPERSEDED` tuvieron explicaciones propias; el aviso 26 fue interno.                                                                                                                                                                                                                                                                    |
| Diseño y teclado     | En móvil **390×844**, `scrollWidth=390`, sin desbordamiento horizontal observado. En escritorio de 1280 px hubo dos columnas. Tab desde el encabezado pasó a «Volver al detalle». [Móvil](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/avisos-movil.png), [tarjetas](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/tarjetas-avisos-movil.png), [escritorio](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/avisos-escritorio.png). |
| Fallo temporal       | Actualizar la segunda página con 503 retiró las tarjetas anteriores. Reintentar recuperó esa misma página. [Captura](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/error-avisos-movil.png).                                                                                                                                                                                                                                                                                                                    |
| Respuesta inválida   | Una respuesta 200 con campo extra fue rechazada: no mostró el correo ficticio inyectado ni tarjetas anteriores.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Permiso y vacío      | Un 403 no cerró la sesión automáticamente; volver al detalle recargó detalle e historial. La cita `…004` mostró correctamente cero avisos.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Cambio de sesión     | Con una actualización de `…004` demorada 5000 ms, se cerró sesión y se ingresó con otro administrador de solo consulta. Al abrir `…003`, aparecieron sus 26 avisos sin datos de la sesión anterior. La demora HTTP ocurrió antes de cabeceras; este recorrido no prueba una demora exclusiva del cuerpo.                                                                                                                                                                                                                                             |

Se cerraron ambas sesiones. La
[consola final](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/browser-console.json)
quedó sin advertencias ni errores registrados. La
[auditoría de navegador](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/browser-http-audit.json)
contiene **32 eventos completos: 24 GET, 2 DELETE de logout y 6 POST**
(dos logins y cuatro controles de fixture). De los diez GET de avisos,
ocho respondieron 200 —uno intencionalmente inválido—, uno 403 y uno 503.
No hubo POST de envío de correo ni mutaciones de negocio.
El [registro del gateway](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/gateway-browser.log)
complementa estos metadatos.

## Límites y pendientes del corte

Las fixtures son controles explícitos de simulación; las pruebas no acreditan
entrega real de correo, scheduler, SMTP, persistencia SQL, transacciones o
RBAC con cuentas del servicio desplegado. El incremento no añade reenvío,
cancelación manual de avisos ni escritura SMTP. La revelación de correo
exclusiva de VETERINARIAN y la UI de títulos adicionales quedan fuera de este alcance.

Los 33 archivos con cambios previos del backend conservaron sus huellas SHA-256,
con cero diferencias en la [comprobación final](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-avisos-admin-2026-10-23/backend-preservacion-final.json). **EN ESTE CORTE siguen pendientes
commit, push, CI y despliegue.** Un informe externo posterior podrá acreditar
la publicación sin cambiar el significado de este corte local versionado.
