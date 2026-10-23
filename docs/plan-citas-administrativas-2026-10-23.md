# Incremento: revisión y confirmación administrativa de citas

Fecha del plan: **23 de octubre de 2026**, zona `America/Bogota`.
**Estado:** investigación y plan listos; este documento no acredita todavía
implementación, pruebas, publicación ni aceptación del nuevo incremento.

## Diagnóstico y fuentes

El checkout del frontend parte de `b7b735a3abee14f9a596bb9568856e1c552cc03b`.
La interfaz administrativa actual abre la gestión de veterinarios; existe
consulta separada de agenda para el veterinario y recorrido de citas del propietario.
Se conservarán esos recorridos y la entrada única por sesión/rol.

Se selecciona [SCRUM-41](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-41)
(Por iniciar): revisión, confirmación y consulta de agenda por personal autorizado.
No tiene descripción ni comentarios; se usan su historia
[SCRUM-12](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-12),
el backend [SCRUM-39](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-39)
(Finalizado) y la validación [SCRUM-42](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-42)
(En curso). SCRUM-40 figura Por iniciar; los registros de Jira no sustituyen
la inspección de las pantallas actuales ni demuestran su aceptación integrada.

El backend revisado tiene HEAD `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`.
La comparación independiente del OpenAPI 0.9.0 descargado del servicio el
23/10 confirma que las rutas y esquemas de citas coinciden con HEAD y árbol local.
No se exige igualdad del documento completo: otras rutas del árbol backend
tienen cambios ajenos. Se consultaron `AppointmentController`, `AppointmentService`,
los DTO de cita/estado/eventos, `UserPermissionResolver`, migración V12 y
`docs/citas-y-agenda.md`, además de sus pruebas HTTP y transaccionales.

Evidencia local saneada, fuera del repositorio:
[Jira](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/jira-seleccion.json),
[contrato y comparación](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-citas-admin-2026-10-23/contrato-citas-admin.json).
La lectura de Jira no modificó estados, comentarios ni asignaciones.

## Alcance de este incremento

Añadir **Citas** dentro del área administrativa existente: agenda paginada,
detalle, historial y confirmación/rechazo de solicitudes. La lectura exige
`APPOINTMENT_READ_ALL`; las acciones exigen además `APPOINTMENT_MANAGE` y
administrador activo. El backend vuelve a autorizar cada petición.
No se concede acceso de agenda al superadministrador por herencia ni se
amplían los permisos del propietario o veterinario.

Mostrar mascota, propietario y teléfono autorizado, veterinario, inicio/fin
en Bogotá, motivo, estado funcional y estado de asignación. No pedir ni mostrar
correo del propietario: el DTO ordinario no lo contiene y administración no
tiene un endpoint de revelación. El historial muestra actor/tipo, instante,
evento y motivo disponibles, con etiquetas españolas y valores nulos honestos.

## Contrato que debe consumir la interfaz

Las siguientes rutas son existentes y se expresan relativas a `/api/v1`:

| Operación            | Contrato                                                                            |
| -------------------- | ----------------------------------------------------------------------------------- |
| Agenda               | `GET /appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&page=0&size=20`         |
| Detalle              | `GET /appointments/{appointmentId}`                                                 |
| Historial            | `GET /appointments/{appointmentId}/events?page=0&size=20`                           |
| Confirmar o rechazar | `PATCH /appointments/{appointmentId}/status` con `{status,expectedVersion,reason?}` |

`from/to` son fechas locales inclusivas: entre 1 y 31 fechas, sin aplicar
el horizonte de creación del propietario. `status` es opcional. Las páginas
comienzan en cero, tamaño 1–100, predeterminado 20; agenda ordenada por inicio
e identificador, historial por instante e identificador. No existen filtros
de agenda por veterinario, propietario ni estado de asignación: no inventarlos.
Una búsqueda local tampoco debe presentarse como filtro de toda la agenda.

El PATCH de este alcance solo ofrece `CONFIRMED` y `REJECTED`, con la versión
observada, entera y no negativa. Una respuesta válida es **HTTP 200** con
`AppointmentResponseDTO` completo (17 campos), identidad y estado compatibles.
El historial tiene 14 campos obligatorios; los anulables deben estar presentes.
Las respuestas privadas no se persistirán en caché ni se incluirán en logs públicos.

## Reglas observadas y consecuencias en UI

| Regla del servicio                                                                                      | Comportamiento de interfaz                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Solo `REQUESTED` admite confirmar o rechazar.                                                           | Mostrar las acciones apropiadas sobre una lectura vigente; estados terminales no se reabren.                                   |
| Confirmar exige `ahora < corte persistido` y `inicio > ahora`, comprobados después de bloqueos.         | No prometer confirmación por la vista previa; mostrar el conflicto del servidor y actualizar el detalle.                       |
| Confirmar exige propietario activo con rol OWNER, mascota activa, veterinario activo y turno publicado. | El DTO no expone todos esos datos; no inferir elegibilidad por nombres o por disponibilidad antigua.                           |
| Rechazar exige motivo no vacío; no exige las guardas temporales de confirmar.                           | No bloquear rechazo solo por haber pasado inicio/corte si el servidor aún conserva `REQUESTED`.                                |
| Motivo opcional para confirmar; obligatorio para rechazar, máximo 1000 caracteres.                      | Validar longitud del valor enviado y contenido no blanco, preservar Unicode; el servicio normaliza con `strip`.                |
| `REQUESTED` ya retiene ocupación; `CONFIRMED` la conserva; `REJECTED` libera en la misma transacción.   | No crear otra cita ni prometer un turno libre antes de respuesta válida y nueva consulta.                                      |
| `assignmentStatus` es independiente del estado funcional.                                               | Mostrar `NEEDS_REASSIGNMENT` como advertencia de gestión pendiente; no tratarla como cancelación, liberación ni nueva reserva. |

Las 06:00 están acordadas y son el valor del perfil productivo, pero el corte
se guarda al crear/reprogramar cada solicitud y no cambia por una configuración
posterior. `AppointmentResponseDTO` no expone ese corte. No codificar 06:00
como un cálculo exacto de elegibilidad de todas las citas en el cliente.
La decisión definitiva permanece en el PATCH. La asignación pendiente no se
resolverá con una reasignación implícita dentro de este incremento.

## Versiones, reintentos y resultado incierto

El PATCH no recibe `clientRequestId`. Su replay es limitado: misma cita, actor,
estado objetivo y motivo normalizado; versión actual exactamente igual a
`expectedVersion + 1`, con el evento humano correspondiente. Cambiar motivo,
actor o transición, o existir otro cambio posterior, no es el mismo replay.
Un evento automático `DAILY_CUTOFF` no equivale a una acción humana.

Bloquear el doble envío de inmediato con una guarda sincrónica, conservar
la intención durante la espera y no permitir que una acción paralela cambie
el cuerpo/versión en vuelo. Un timeout, pérdida de respuesta, 408/5xx o éxito
vacío/malformado/incompatible deja resultado incierto: no reenviar automáticamente
ni mostrar éxito. Ofrecer consulta actual del detalle/historial. No regenerar
silenciosamente `expectedVersion` para repetir una decisión anterior.
Si se ofrece reintento explícito, debe conservar exactamente la intención
original; no atribuir el estado observado a ese intento solo por coincidir.

| Respuesta                                    | Tratamiento                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `400` o errores de campo                     | Explicar datos inválidos y conservar lo editable; distinguir validación de fallo de red.         |
| `401`                                        | Respetar la expiración de la sesión capturada sin afectar una sesión nueva.                      |
| `403`                                        | Retirar acciones no autorizadas y permitir salir; no simular otro rol.                           |
| `404`                                        | Informar que la cita no está disponible sin revelar información ajena.                           |
| `409 CONCURRENT_UPDATE`                      | Recargar; exigir una revisión de los datos actuales antes de otra intención.                     |
| `409 APPOINTMENT_TRANSITION_NOT_ALLOWED`     | Mostrar que el estado cambió/no admite la transición; no presentarlo como error temporal de red. |
| `409 APPOINTMENT_CONFIRMATION_CUTOFF_PASSED` | Informar vencimiento o inicio; no calcular ni modificar el corte desde el frontend.              |
| `409 APPOINTMENT_PARTICIPANT_INACTIVE`       | Explicar que participantes o turno dejaron de ser elegibles; conservar el estado autoritativo.   |

Capturar contexto de sesión antes de cada operación, comprobarlo también
después de consumir el cuerpo y descartar resultados tras salir/cambiar sesión.
Las cargas de lista/detalle/historial usan cancelación y generación de lectura
para que una respuesta anterior no sobrescriba el rango, página o cita actual.

## Recorrido y verificación prevista

1. Cliente y parsers estrictos para lista/detalle/historial/PATCH, reutilizando
   el transporte de sesión; pruebas de forma, nulabilidad, versiones y errores.
2. Entrada administrativa Citas y agenda por día/rango con estados, paginación
   real y vacíos/carga/error; mantener independiente el área de veterinarios.
3. Detalle e historial paginado; confirmación clara y rechazo con motivo.
   Diálogo con Cancelar inicialmente enfocado, Tab/Shift+Tab dentro, Escape
   y retorno al disparador; foco visible, errores vinculados y anuncio de resultado.
4. Simulación HTTP conforme al contrato: éxito, rechazo/liberación, corte,
   participantes inactivos, versión obsoleta, competencia confirmar/rechazar,
   replay equivalente, fallo después de aplicar y cuerpos 200 incompatibles.
5. Gates del proyecto y build; navegador de escritorio y 390×844: teclado,
   navegación atrás, actualización de agenda, cierre de sesión y respuesta
   tardía tras otra sesión. No usar datos reales para demostrar mutaciones.
6. Documentar commit, gate remoto, despliegue y comprobación HTTPS por separado
   de la aceptación integrada con servicio/cuentas reales y prueba concurrente
   de persistencia exigida por SCRUM-42.

Criterio de parada técnica: lista/detalle/historial y confirmar/rechazar cumplen
el contrato, las fallas no muestran éxito ni duplican intención, las sesiones
permanecen aisladas y los gates/recorridos previstos tienen evidencia.
No marcar SCRUM-12/42 como terminadas únicamente por una simulación o despliegue.

## Relación con SCRUM-45 y pendientes

[SCRUM-45](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-45)
(Por iniciar) pertenece a [SCRUM-13](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-13):
cancelación, reprogramación, inasistencia e historial de esos cambios.
Su backend SCRUM-43 está Finalizado y su validación SCRUM-46 En curso.
Se deja para otro incremento: cancelar antes del inicio, reprogramar con
acuerdo previo y reserva atómica, e inasistencia solo tras el fin del turno.
Los cambios son exclusivamente administrativos; OWNER consulta sus resultados.
No son dudas abiertas que deban volver a consultarse al usuario.

No se detecta una decisión nueva de negocio bloqueante para SCRUM-41 conforme
al contrato existente. Una ampliación a las transiciones de SCRUM-45, triage
clínico, prioridades o asignación automática requiere alcance/reglas explícitos
antes de introducirla. Las decisiones de paginación, foco y diseño se resolverán
técnicamente siguiendo el portal, sin convertirlas en aprobaciones adicionales.

[SCRUM-79](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-79)
sigue En revisión y exige revisión compartida del contrato por los tres.
SCRUM-81 figura Finalizado, aunque su descripción/comentarios aún dicen que
esa revisión está pendiente; se registra la discrepancia sin darla por resuelta.
Las mejoras de [plantillas de correo](pendientes-proyecto.md) quedan pendientes
por separado. No se incluyen aquí cambios backend, reglas de avisos P12,
migraciones, dependencias, clínica, autoservicio OWNER ni escrituras en Jira.
