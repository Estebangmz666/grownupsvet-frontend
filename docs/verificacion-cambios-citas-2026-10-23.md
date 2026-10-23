# Cambios administrativos de citas: corte local de verificación

Fecha: **23 de octubre de 2026**, zona `America/Bogota`.

**Estado del corte:** implementación local de SCRUM-45 con cancelación,
inasistencia, reprogramación y reasignación excepcional. El check final
registró **626 pruebas en 42 archivos**, TypeScript y ESLint correctos,
salida 0. La recompilación Windows y los recorridos locales de navegador
también terminaron correctamente tras el ajuste del filtro de turno original.
Commit, push, CI y despliegue quedan pendientes en este informe.
**No se acredita todavía commit/push ni publicación de este incremento.**

## Base, fuentes y alcance

Checkout frontend activo sobre `main`, base
`a9982e952b6b7555fc1c23798abd5039cd87c83e`, correspondiente al incremento
anterior de [revisión y confirmación](verificacion-citas-administrativas-2026-10-23.md).
El [plan de cambios](plan-cambios-citas-2026-10-23.md) separa las cuatro
operaciones y sus condiciones; esta evidencia pertenece al árbol local nuevo.

[SCRUM-45](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-45)
continúa la historia [SCRUM-13](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-13)
y la validación [SCRUM-46](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-46).
La [selección saneada de Jira](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/jira-seleccion.json)
conserva ocho incidencias y sus comentarios. La consulta fue de solo lectura:
no se cambiaron estados, comentarios ni asignaciones y no se declara cierre
de historias por completar pruebas locales.

La descarga del OpenAPI real obtuvo **200 a las 15:28:53 UTC**, contrato
**0.9.0**. La [comparación](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/openapi-comparison.json)
confirma igualdad de las rutas/esquemas seleccionados entre servicio, HEAD
y árbol local del backend `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`.
Las fuentes seleccionadas no difieren de HEAD; no se afirma igualdad de
todo el OpenAPI. El [resumen de contrato](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/contrato-cambios-citas.json)
identifica DTO, permisos, fechas, replay y diferencias entre operaciones.
Esta descarga pública no es una prueba autenticada del servicio.

Se preserva el trabajo previo del backend. Sus
[huellas iniciales](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/backend-huellas-iniciales.json)
se contrastaron con el [control final](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/backend-preservacion-final.json):
**33 archivos comprobados, cero diferencias** frente al corte inicial,
conservando los cambios ajenos preexistentes.
Las pruebas descritas no escriben en el backend real.

## Reglas incorporadas al incremento

Las acciones administrativas usan `APPOINTMENT_MANAGE`, sobre la lectura
autorizada existente. Los selectores requieren los permisos de consulta de
veterinarios y de sus agendas; no usan el endpoint de disponibilidad OWNER.

| Operación                  | Regla del contrato/fuente                                                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cancelar                   | `REQUESTED` o `CONFIRMED`, antes del inicio original, motivo obligatorio y versión observada. Los participantes pueden estar inactivos; el administrador debe continuar activo.                                                                                                                        |
| Inasistencia               | Solo `CONFIRMED`, desde el fin del turno, con motivo y versión. Sin tolerancia ni marcado automático.                                                                                                                                                                                                  |
| Reprogramar                | `ASSIGNED`, antes del inicio original y con corte vigente si está `REQUESTED`; participantes/veterinarios activos; destino publicado y libre desde mañana hasta el día 60 local. Acuerdo previo siempre obligatorio.                                                                                   |
| Reasignar excepcionalmente | `NEEDS_REASSIGNMENT`, veterinario original inactivo y cita todavía no terminada; otro veterinario activo. Una confirmada admite destino futuro hoy; una pendiente conserva el corte original y exige destino desde mañana con corte vigente. No existe tope de 60 días en esta operación del servicio. |

Los traslados conservan identidad, propietario, mascota y estado funcional.
El acuerdo de reasignación es obligatorio si cambia el inicio; conservar
horario con otro veterinario permite omitirlo. Canal `PHONE/WHATSAPP/OTHER`,
fecha textual ISO con offset explícito no futuro y nota no blanca de hasta
500 unidades UTF-16. Los motivos respetan el límite bruto de 1000 y Java
`strip/isBlank`, conservando Unicode que Java no elimina.

Los turnos publicados son candidatos sin indicador de ocupación: la
selección no asegura disponibilidad y el servidor vuelve a comprobarla.
El filtro final oculta el turno original y quedó incluido en el check final.
El detalle ordinario no expone `currentSlotId`, corte persistido ni correo.

PATCH conserva su replay inmediato por actor/transición/motivo/versionado.
Los POST reciben intención UUID persistente y pueden devolver la **cita
actual** después de otros cambios, por lo que el replay no exige siempre
versión+1 ni destino/estado originales. Reprogramación incluye actor en su
fingerprint; reasignación no lo incluye en la fuente actual. La interfaz
mantiene la intención dentro de la sesión capturada y no reenvía automáticamente
ante incertidumbre ni atribuye el estado consultado al intento perdido.

## Evidencia automatizada y HTTP disponible

| Conjunto                             | Resultado y artefacto                                                                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Check global final                   | **626 pruebas / 42 archivos**, tipos y lint correctos, salida 0, después del ajuste final. [Registro](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/check.log).    |
| Regresión HTTP general               | **303 peticiones** satisfactorias en simulación. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/regression-http-verification.json).                       |
| Regresión de revisión/confirmación   | **50 peticiones, 46 respuestas contra esquemas**. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/review-http-verification.json).                          |
| Verificador independiente de cambios | **71 peticiones, 56 respuestas contra esquemas**, salida 0 y reset final. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/changes-http-verification.json). |
| Cliente actual por HTTP              | **16 comprobaciones mediante 114 peticiones de producto**, salida 0. [Informe](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/client-http-verification.json).       |
| Exportación web final                | Build Windows correcto, salida 0, bundle `index-a17802d6e8f1f2e42b11d2eadf1133da.js`. [Registro](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/web-build.log).     |

Estas cifras son conjuntos diferentes: no se suman como casos unitarios ni
se presentan como recorridos de interfaz. Los informes HTTP conservan
metadatos saneados, sin tokens, credenciales, payloads o cuerpos de respuesta.

El verificador independiente comprobó: motivo/permisos y replay de
cancelación; disponibilidad del candidato liberado en el sustituto; NO_SHOW
antes/después del fin; detalle e historial originales intactos tras destino
ocupado, versión obsoleta, corte y ventana fuera de 60 días; acuerdo requerido;
offsets válidos, equivalencia con nueve decimales y conflicto por nanosegundo
distinto; replay POST que devuelve el estado actual tras cancelación;
reasignación al mismo horario sin acuerdo y a otro horario con acuerdo;
imposibilidad de eludir el corte pendiente y destino excepcional al día 70.

La revisión del mock corrigió el máximo de offset de ±18:00, la conservación
de nanosegundos en el fingerprint y el código de turno inexistente.
La ejecución final del verificador terminó correctamente y restableció
los datos ficticios; las pruebas se coordinaron sin resets concurrentes.

## Recorridos finales de navegador

Se probó el frontend web real en **8085** contra la simulación **4900**,
con datos ficticios. El viewport móvil fue **390×844**, con ancho desplazable
del DOM de **390 px**, sin desbordamiento horizontal observado.

| Recorrido               | Resultado observado                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inasistencia            | La cita terminada `…001` recibió HTTP 200 y quedó `NO_SHOW`.                                                                                                                                                                                                                                                                                                                                                           |
| Cancelación             | Sobre la confirmada `…003`, un motivo superior a 1000 caracteres bloqueó el envío local. Un motivo de 825 caracteres permitió cancelar con HTTP 200. [Captura móvil](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/cancelacion-movil.png).                                                                                                                                      |
| Diálogo largo y teclado | El modal limitó su altura y permitió desplazar el contenido: 579 px visibles para 714 px de contenido. Cancelar recibió foco inicial; Shift+Tab pasó al texto desplazable y luego a Confirmar; Tab volvió al texto. Escape devolvió el foco al disparador.                                                                                                                                                             |
| Reprogramación          | Luna, solicitud 3, `…005`, se trasladó al **26/10 a las 19:30**. Se comprobaron páginas de candidatos de 20 y 5, exclusión del turno original y acuerdo WhatsApp del **23/10 a las 09:17**. [Resultado](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/reprogramacion-escritorio.png).                                                                                           |
| Destino ocupado         | Nala `…004` recibió **409**; conservó el **24/10 a las 08:30** y las decisiones quedaron bloqueadas hasta consultar. [Conflicto](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/conflicto-destino.png).                                                                                                                                                                          |
| Respuesta perdida       | Una intención nueva para `…004`, **26/10 a las 18:00**, se aplicó y perdió la respuesta: el gateway devolvió **502**. La UI bloqueó el reenvío; GET de detalle/historial mostró el estado actual con un evento de reprogramación, sin otro POST ni atribución del resultado al intento perdido. [Captura](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/respuesta-perdida.png). |
| Reasignación            | Tras la fixture de veterinario inactivo, `…026` conservó el **24/10 a las 19:30**, cambió a Veterinario Uno y quedó `REQUESTED` + `ASSIGNED`, con un evento de reasignación. [Resultado](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/reasignacion-escritorio.png).                                                                                                            |
| Solo consulta y salida  | La sesión de lectura abrió `…007` sin acciones de gestión. Se comprobó logout en ambas modalidades y la [consola final](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/browser-console.json) quedó vacía.                                                                                                                                                                        |

La [auditoría HTTP del navegador](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/browser-http-audit.json)
conserva **59 eventos completos**. El POST cuya respuesta se cortó no emite
un evento completo en Postman y no se añade a esa cifra. El
[registro del gateway](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-cambios-citas-2026-10-23/gateway-browser.log)
documenta su 502 y la consulta GET posterior sin otro POST.
Los servidores locales quedaron detenidos y la pestaña de prueba se cerró.

## Simulación y límites

El destino de los verificadores está fijo en **127.0.0.1:4900**, miembro local
Postman, sin opción de dirigir esos scripts al servicio remoto.
La fixture `prepare-appointment-changes` enlaza las citas ficticias a sus
turnos de origen y añade candidatos paginados; `appointment-state` controla
tiempos/corte/participantes/versiones y
`appointment-veterinarian-unavailable` prepara la falta de profesional.
Son controles explícitos de simulación, ajenos a la API de producción.

El sustituto vive en memoria y no acredita SQL, transacciones, restricciones,
bloqueos ni concurrencia PostgreSQL reales. La conservación/liberación
observada es la del modelo local, no una prueba de rollback o persistencia
del servicio. No se enviaron avisos, no se ejecutaron colas/SMTP ni se
acreditan recordatorios o entrega en un buzón. La constancia de acuerdo
registra datos y no verifica un contacto externo.

## Pendientes para publicar y aceptar

- Acreditar commit/push, CI, despliegue Pages y comprobación HTTPS de este
  incremento. Un artefacto local o la publicación anterior no lo sustituyen.
- Mantener separada la aceptación integrada SCRUM-13/44/45/46, las pruebas
  de persistencia reales y la revisión compartida de contrato por los tres.

No se incluyen clínica, reapertura de terminales, autoservicio OWNER,
cambios de reglas backend ni nuevas reglas de avisos.
Las [plantillas de correo](pendientes-proyecto.md) continúan pendientes por
separado. Los informes enlazados son artefactos locales fuera del repositorio,
bajo `output/frontend-cambios-citas-2026-10-23`, no URLs públicas.
