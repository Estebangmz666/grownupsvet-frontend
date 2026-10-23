# Continuidad del frontend: recuperación y correcciones verificadas

Fecha: **23 de octubre de 2026**, America/Bogota.

**Resultado:** implementadas y verificadas localmente mejoras en recuperación de acceso, activación con resultado incierto, foto web del propietario, selección de mascotas para citas y resolución de archivos del gateway en Windows. Pasaron TypeScript, ESLint, **327 pruebas en 33 archivos** y la exportación web. La aplicación se recorrió contra una simulación local del contrato **OpenAPI 0.9.0**. La aceptación con backend, correo y cuentas reales continúa pendiente.

## Base y alcance

Clon activo: `C:\Users\ASUS\Documents\ChatGPT\grownupsvet-frontend`, rama `codex/fix-web-cloudflare`, HEAD **`a028b06c0a744483646768fa0da7e629d3074fd2`**. Se ejecutó `git fetch --no-tags origin` al inicio y se comprobó que HEAD y `origin/master` coinciden en ese commit. La comprobación funcional corresponde al árbol local con sus cambios anteriores preservados, no a una versión nueva publicada de ese commit. El [inventario inicial del frontend](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/frontend-estado-inicial.txt) registra esa base de trabajo.

Este trabajo continúa la [gestión administrativa](verificacion-incremento-administrativo-1-2026-10-22.md) y las [mejoras de login y registro](verificacion-login-signup-accesibilidad-2026-10-22.md). Conserva un único acceso y sesión común. No incorpora disponibilidad administrativa, gestión clínica, nuevos roles, endpoints ni reglas de negocio.

| Área | Cambio implementado |
| --- | --- |
| Recuperación de acceso | Tres pasos con los componentes compartidos de autenticación: solicitar código, verificarlo y establecer la nueva contraseña. Etiquetas, ayudas, errores asociados, foco, teclado, Enter, estados ocupados y mostrar/ocultar contraseña. |
| Validación de recuperación | Código de seis dígitos que conserva ceros iniciales; permiso opaco y vigencia de la respuesta comprobados antes de continuar. Contraseñas de 15–128 puntos de código Unicode, con espacios y confirmación exacta. Un 400 de contraseña no se presenta como permiso vencido. |
| Operaciones pendientes | Protección contra doble envío y respuestas de una visita anterior mediante foco y generación de la operación. Una verificación de resultado incierto exige otro código; un restablecimiento incierto bloquea otro cambio y orienta a comprobar el acceso mediante login. |
| Activación de personal | Una respuesta perdida o fallo ambiguo bloquea otro envío en esa pantalla, retira el formulario y limpia ambas contraseñas. Conserva el login normal para comprobar si la cuenta se activó. Los rechazos conocidos de validación, límite e indisponibilidad conservan su tratamiento específico. |
| Foto del propietario en web | La imagen procesada se envía como `Blob` binario en la parte `file` de `FormData`, con nombre y MIME. Se captura el contexto de sesión antes del selector y se comprueba durante las continuaciones para no aplicar una operación preparada por A a la cuenta B. |
| Solicitud de cita | Selector de mascotas activas con carga de páginas adicionales, conservación de los elementos ya cargados y reintento. Motivo obligatorio de hasta 1000 unidades UTF-16, conforme al DTO, con foco en el campo cuando falta. |
| Lectura de disponibilidad | Las páginas y segmentos de fechas reutilizan el contexto de sesión capturado; las respuestas de una carga anterior no sustituyen el formulario actual. |
| Gateway local | Resolución de archivos con las funciones nativas de rutas de Node para unidades Windows y raíces UNC. Rechaza escape de la carpeta publicada, separadores inyectados, rutas de unidad y flujos alternativos. |

Los permisos y la decisión final de validación siguen en el backend. No se recortan ni normalizan contraseñas. Un 202 de recuperación solo expresa aceptación de la solicitud; no demuestra existencia de la cuenta ni recepción del correo. El restablecimiento exitoso requiere un login nuevo y no crea una sesión automáticamente.

## Comprobaciones ejecutadas

| Comprobación | Resultado y evidencia |
| --- | --- |
| `npm run check` | TypeScript y ESLint correctos; **327 pruebas en 33 archivos**. Incluye pruebas existentes y de las correcciones actuales. [Registro completo](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/check.log). |
| `npm run web:build` | Exportación Expo y preparación web correctas. Bundle **`index-156a1f6ddf5cf1f1aa2e096d20eb6651.js`**. [Registro de compilación](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/web-build.log). |
| HTTP contra simulación | **171 peticiones verificadas**, de las cuales **138** validan respuesta y estado contra los esquemas y operaciones del OpenAPI canónico 0.9.0. El resto incluye fixtures y fallos inyectados identificados. [Informe HTTP](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/http-verification.json). |
| Cliente real del frontend por HTTP | **Dos comprobaciones adicionales**: mascotas distintas de ambas páginas y recuperación que conserva espacios e invalida la sesión anterior en el sustituto. [Informe del cliente](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/frontend-client-http.json). |
| Foto por HTTP binario local | La prueba de `profile.api.test.ts`, incluida en las 327, usa un servidor HTTP en loopback y vuelve a interpretar el multipart recibido. Comprueba bytes, nombre, MIME, ruta, método y sesión capturada, además de 413/415 y cambio A→B antes de enviar. No usa el mock Postman para acreditar integridad binaria. |
| Preservación del backend | **33 archivos con huellas comparadas y cero cambios** durante este trabajo frontend. [Resultado](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/backend-preservacion.json) e [inventario inicial](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/backend-huellas-iniciales.json). |

Las cifras anteriores son conjuntos de evidencia diferentes; no se suman para presentarlas como pruebas unitarias o recorridos de navegador. Los avisos de tipo de módulo de ESLint y de las variables de color de la compilación no impidieron las comprobaciones. No se actualizaron dependencias para ocultarlos.

El verificador HTTP cubre solicitud genérica para cuenta activa, desconocida e inactiva; código mal formado, incorrecto, válido y consumido; permiso de 43 caracteres; contraseñas comunes o fuera de longitud; confirmación distinta; errores por campo; 429/503; 204; rechazo de la sesión y contraseña anteriores; login con la contraseña nueva y permiso consumido. También aplica una verificación o un restablecimiento y corta su respuesta para comprobar el estado posterior mediante consultas/login.

## Recorridos observados en navegador

Entorno de prueba: exportación web servida localmente en **8085**, con el gateway dirigido explícitamente a la simulación Postman en **4900**. Las cuentas, códigos, contraseñas, mascotas y perfiles usados son ficticios. No se usaron mutaciones reales para demostrar estos recorridos.

| Recorrido | Resultado observado |
| --- | --- |
| Solicitud de código demorada | Espera controlada de cinco segundos, campos conservados y estado ocupado. Otro Enter no produjo una segunda solicitud. |
| Verificación | Un código incorrecto produjo error; el código vigente con cero inicial permitió continuar al restablecimiento. |
| Contraseña rechazada y éxito | Una contraseña común produjo 400 y error corregible, conservando el permiso. La corrección posterior obtuvo 204 y mostró éxito. El login con la frase que incluía espacios exteriores funcionó. |
| Mascotas de otra página | Se cargaron **20 + 5 mascotas activas**. Se seleccionó la última, se escogió turno y se intentó continuar sin motivo: el campo recibió foco y no se envió un POST de cita. [Captura del selector](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/cita-mascotas-pagina-2.png). |
| Restablecimiento incierto | El sustituto cambió la contraseña y cortó la respuesta; el proxy devolvió 502. La pantalla bloqueó otro envío y el login posterior confirmó el cambio aplicado. [Captura](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/recuperacion-resultado-incierto.png). |
| Activación incierta | Se aplicó la activación y se cortó su respuesta. La pantalla ocultó el formulario, limpió las contraseñas y no permitió otra activación. El login posterior de la cuenta nueva entró a Veterinarios como ADMINISTRATOR. [Captura](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/activacion-resultado-incierto.png). |
| Presentación y semántica | Recuperación a **320 px**, con ancho del documento y desplazamiento horizontal de 320 px, sin desbordamiento horizontal observado. Idioma español, formulario, etiquetas y ayudas comprobados; la consulta final de errores de consola devolvió una lista vacía. [Captura móvil](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/recuperacion-movil-320.png). |

También se conserva la [captura de recuperación exitosa](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/recuperacion-exitosa.png).

La [auditoría saneada](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-continuidad-2026-10-23/browser-http-audit.json), en el corte revisado, contiene **32 eventos HTTP completos: 26 de rutas API y seis de fixtures**, incluida preparación del entorno. Registra solo fecha UTC, método, ruta y estado. No son 32 recorridos de interfaz ni contienen cuerpos, cabeceras, contraseñas o tokens. Las pérdidas de respuesta de restablecimiento y activación no generan eventos HTTP completos del mock y no se añaden ficticiamente a esa cifra; las acreditan el comportamiento observado en pantalla/gateway y el login posterior.

## Alcance de la evidencia y pendientes

- **Integración real pendiente:** no se acredita PostgreSQL, firma JWT de producción, envío SMTP, recepción de correo, invitaciones reales ni revocación de sesiones del servicio desplegado con estas simulaciones.
- **Foto web parcialmente verificada:** se demuestra el transporte multipart binario del cliente y sus guardas de sesión, no el recorrido completo de selección de archivo en navegador, procesamiento de una imagen real y almacenamiento/lectura del backend. El interceptor Postman convierte el multipart a texto; por ello esa integridad se probó mediante el servidor binario local separado.
- **Citas:** se comprobó la selección después de la primera página y la validación del motivo sin escritura. No se declara aceptación completa de creación, concurrencia, reasignación, atención clínica o disponibilidad administrativa.
- **Accesibilidad:** las observaciones de semántica, teclado, foco y ancho móvil no constituyen conformidad formal ni evaluación con lector de pantalla o personas usuarias. Siguen pendientes las comprobaciones integrales descritas en el informe anterior.
- **Plataformas y publicación:** no se verificaron Android/iOS, instalación/offline de la PWA ni el dominio público. Publicación, configuración y aceptación del servicio real requieren su trabajo y evidencia propios.
- **Cierre del entorno confirmado:** tras el reinicio de la aplicación se comprobaron **8085/4900 sin procesos escuchando**. La [vista local en 8788](http://localhost:8788/) quedó activa mediante el proceso **20580**, sirviendo el bundle final `index-156a1f6ddf5cf1f1aa2e096d20eb6651.js` con destino al backend real. `GET /` respondió **200** y `GET /api/v1/pets` sin sesión respondió **401**, con `Cache-Control: no-store`. Estas consultas no escribieron datos reales.

No se modificó backend ni Jira; no se hizo commit, push o despliegue. El resultado es un avance local verificable del frontend y no cierra automáticamente historias o criterios de aceptación pendientes.

## Reproducción local

Desde el clon activo, `npm run check` y `npm run web:build` reproducen las comprobaciones de código y exportación. La [guía Postman](../postman/README.md) describe el arranque y los controles de la simulación. Con el sustituto estable en 4900 y sin otro recorrido usando sus datos:

```powershell
python postman/scripts/verify_roles_http.py `
  --spec '..\GrownupsVet\grownupsvet-backend\docs\openapi\openapi.json'
node postman/scripts/verify_frontend_client_http.mjs
```

Ambos verificadores reinician los datos ficticios; deben ejecutarse antes del recorrido de navegador. Los cortes 502 son fallos controlados del proxy después de una escritura, no respuestas atribuidas al contrato del backend. El verificador Python solo permite la dirección local de la simulación y no acepta el gateway del servicio real como destino.
