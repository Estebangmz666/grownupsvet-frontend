# Formación veterinaria y diplomas: corte local de verificación

Fecha: **23 de octubre de 2026**, zona `America/Bogota`.

**Estado del corte:** implementación local de la gestión administrativa de
formación y diplomas. `npm run check` terminó correctamente con **811 pruebas
en 46 archivos**, TypeScript y ESLint. La exportación web y el recorrido de
navegador descrito abajo también terminaron correctamente. **Commit, push,
CI y despliegue de este incremento quedan pendientes en este corte previo a
publicación.** El informe de publicación se actualizará por separado.

## Base, contrato y alcance

El incremento parte del frontend `6b0fd61d41cd74dde494755d53030b6957c6349f`
y del [plan de formación](plan-formacion-veterinaria-2026-10-23.md). El usuario
aclaró que **P3/clínica está fuera del alcance de esta entrega**; no es un
pendiente que bloquee el cierre del frontend P1/P2. Este corte completa
formación y diplomas, sin acreditar el cierre de todas las capacidades P1/P2.

La [comparación de OpenAPI](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/openapi-comparison.json)
registra una descarga pública 200 a las **16:53:14 UTC**, versión **0.9.0**.
Las cuatro rutas y tres esquemas seleccionados coinciden entre el servicio,
HEAD y el árbol local del backend `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`.
El [contrato de fuente](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/contrato-formacion-fuente.json)
conserva las fuentes inspeccionadas. No hubo peticiones autenticadas ni
mutaciones al backend real en esta comprobación pública.

El acceso usa `VETERINARIAN_MANAGE` del administrador autorizado, sin herencia
para SUPER_ADMIN, OWNER o VETERINARIAN. El veterinario destino puede estar
activo, pendiente o deshabilitado. Desde su detalle se abre **Gestionar
formación y diplomas**. Se incorporaron estas nueve operaciones existentes,
todas bajo `/api/v1/veterinarians/{veterinarianId}`:

| Recurso                                                 | Operaciones                                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/qualifications`                                       | GET de arreglo sin paginación; POST 201 con DTO y `Location`.                                                    |
| `/qualifications/{qualificationId}`                     | GET y PUT 200; DELETE 204 para títulos adicionales.                                                              |
| `/qualifications/{qualificationId}/diploma`             | GET de PDF autorizado; PUT multipart con parte `file` y parámetro `published`; DELETE 204 conservando el título. |
| `/qualifications/{qualificationId}/diploma/publication` | PATCH 200 con `{published: boolean}`.                                                                            |

La lista y los detalles validan los ocho campos académicos del DTO. El máximo
es 20 títulos contando el base. El pregrado base se puede editar, mantiene
su tipo y no se puede eliminar; los adicionales admiten los cuatro tipos del
contrato. Título e institución respetan longitud bruta y normalización Java;
el año opcional abarca de 1900 al año actual de Bogotá. Una edición académica
efectiva retira la publicación y conserva el PDF.

La interfaz carga los diplomas **privados por defecto**. Para publicar exige
preparar la descarga, descargar el PDF, declarar su revisión y confirmar la
publicación. También permite retirar la publicación, eliminar solamente el
PDF y eliminar un título adicional con su diploma, mediante confirmaciones.
La declaración manual no constituye prueba automática de lectura ni un
bloqueo de concurrencia sobre una versión del archivo.

El servidor es responsable de validar PDF, máximo 5 MiB y 50 páginas, y las
restricciones de cifrado, formularios, acciones y adjuntos. El cliente valida
límites de bytes, tipo, cabecera y terminación; no se atribuye inspección
estructural completa, conteo de páginas ni análisis antivirus al navegador o
al mock. Las descargas usan un Blob autorizado y un enlace temporal revocado
al sustituirlo, actualizar, salir o cambiar de sesión.

Un resultado incierto no produce reenvíos automáticos. La interfaz exige
consultar los datos actuales antes de otra decisión. Tras perder el recibo
de un alta, encontrar un título en la lista no demuestra qué intento lo creó.

## Pruebas automatizadas y HTTP local

El [check global](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/check.log)
registra **811 pruebas en 46 archivos**, acumuladas con los incrementos
anteriores; no son 811 pruebas nuevas de formación. El
[informe focal del cliente](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/api-client-tests.json)
conserva **91 pruebas** de las nueve operaciones, validación de DTO y entradas,
errores, PDF y sesión. Los **15 casos** del modelo de presentación cubren
normalización, año, edición sin cambios, estados del diploma, resultado
incierto, conflictos y ciclo del enlace temporal, incluido logout durante
una descarga. Estos casos forman parte del total global.

El verificador [verify_veterinarian_qualifications_client_http.mjs](../postman/scripts/verify_veterinarian_qualifications_client_http.mjs)
compila y ejecuta el cliente TypeScript real sobre HTTP local. El
[informe final](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/client-http-verification.json)
de las **17:10:09 UTC** registra **22 comprobaciones correctas**:

- **91 peticiones del cliente:** 89 a la simulación Postman 4900 y dos a un
  servidor binario loopback aislado. Los controles de fixtures quedan fuera
  de esa cifra.
- **Tres solicitudes HTTP crudas adicionales**, separadas del cliente:
  parte multipart incorrecta 400, método GET de publicación 405 y aceptación
  de `published` como parámetro de formulario.
- **Ocho comparaciones de bytes y SHA-256** correctas: siete PDF ASCII en
  Postman y un PDF con bytes no UTF-8 en el servidor binario aislado.

El recorrido cubre lista/detalle; alta, edición y eliminación; carga privada,
publicación, reemplazo y retirada; preservación del PDF al editar; protección
del título base; límite 20; veterinario deshabilitado; rechazo por rol/permiso
y ausencia de sesión. También cubre 400/503 de validación inyectados, HTML
falso, campos adicionales, identidad ajena, lectura demorada y escritura cuyo
recibo llega tras cambiar de sesión. Las altas con respuesta perdida, vacía,
JSON inválido o 408 emiten un solo POST y se consultan después explícitamente.
Las demoras HTTP se aplican antes de cabeceras; las pruebas unitarias cubren
además cambios de sesión durante el consumo de texto o Blob.

### Límite de transporte de Postman

Se conserva el [primer intento fallido](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/client-http-first-attempt.json):
un PDF con bytes no UTF-8 pasó de **621 a 629 bytes** y no conservó su SHA-256.
El interceptor de Postman decodifica el cuerpo multipart como UTF-8 antes del
handler. No se presenta ese intento como aprobado ni se relajó la comparación
de bytes. La ejecución final separa los PDF ASCII compatibles con Postman de
la prueba binaria del mismo cliente y `fetch` real, usando un servidor HTTP
loopback temporal: **619 bytes**, SHA-256
`934ef07dc1b0bedaa7eb2e3edffb510f6661033f2628d663d7217ad6ceb5ba70`
idéntico en carga y descarga. Ese servidor solo acredita transporte; no
implementa la inspección estructural del backend.

Los controles de fixtures, cortes y respuestas inválidas están documentados
en [postman/README.md](../postman/README.md#formación-veterinaria-y-diplomas).
Son fallos controlados del entorno, no endpoints ni respuestas conformes
atribuidos al producto. No se probó el directorio OWNER ni la descarga pública
de diplomas en este recorrido.

## Recorrido observado en navegador

Se usó una cuenta ADMINISTRATOR y datos ficticios, con un
[PDF sintético de 608 bytes sin validez académica](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/diploma-ficticio-sin-validez.pdf).
El recorrido observado por root fue:

1. Crear un título adicional y cargar el PDF privado.
2. Preparar y descargar el PDF; comparar 608 bytes y SHA-256 idénticos.
3. Declarar la revisión manual y publicar mediante confirmación.
4. Editar el nombre: se retira la publicación y se conserva el PDF.
5. Eliminar el PDF conservando el título; eliminar después el título adicional
   y volver a la lista con un solo pregrado base. El base no muestra botón de
   eliminación.

Como comprobación separada, después de volver al título base se abrió el
diálogo para retirar su publicación: Escape lo cerró y devolvió el foco a
**Retirar publicación del diploma**.

La [comparación del PDF del navegador](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/browser-pdf-sha.json)
registra SHA-256
`f34afbc2c231181e425954b7a4ed3f388c1baa54d31e6241c93913f3de96abc3`
en ambos extremos. La
[auditoría HTTP saneada](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/browser-http-audit.json)
conserva **26 eventos**, independientes de las peticiones del verificador.
La [consola capturada](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/browser-console.json)
quedó vacía.

Se inspeccionaron las capturas de
[escritorio a 1280 px](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/formacion-escritorio.png)
y [móvil a 390 px](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/formacion-movil.png);
el ancho de desplazamiento coincidió con el viewport en ambos tamaños. Se
cerró sesión y la pestaña, se restauró el viewport y se detuvo el gateway.
Esta ronda no recorrió en navegador la matriz de roles, el máximo 20 ni
resultados inciertos: estos últimos cuentan con la evidencia de cliente/HTTP
indicada, sin atribuirles QA visual.

## Build, preservación y límites del corte

La [exportación web Windows](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/web-build.log)
terminó con salida 0 y generó
`_expo/static/js/web/index-a159d30010dc4ab6f68ad8aa60426cfd.js`.
El [control de preservación](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-formacion-2026-10-23/backend-preservacion-final.json)
de las **17:18:35 UTC** compara **33 archivos del backend, cero diferencias**
frente a las huellas iniciales. Ese corte precede a retomar la mejora de
correos del backend, un trabajo posterior independiente.

Quedan fuera de esta evidencia la integración autenticada completa con el
backend real, almacenamiento real y validación estructural del servidor,
lectura pública/OWNER de diplomas y aceptación de concurrencia en producción.
Las comprobaciones locales no acreditan CI, commit, push ni despliegue de este
incremento. El cierre presente corresponde a formación; el siguiente trabajo
autorizado por el usuario vuelve al backend y sus correos.
