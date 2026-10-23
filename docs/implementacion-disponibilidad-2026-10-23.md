# Disponibilidad administrativa individual — 23 de octubre de 2026

Implementación local guiada por **SCRUM-37**, dependiente de **SCRUM-11** y con verificación de integración/accesibilidad en **SCRUM-38**. El estado de Jira se consultó mediante el conector el 23/10/2026: SCRUM-37 estaba por iniciar, SCRUM-11 y SCRUM-38 en curso; las operaciones backend de SCRUM-36/78 figuraban finalizadas. Este trabajo no cambia estados de Jira ni acredita aceptación del equipo.

## Alcance concreto

Un administrador abre el detalle de un veterinario y elige «Gestionar disponibilidad». Puede consultar un día de Bogotá, filtrar todos/publicados/bloqueados, recorrer páginas, publicar un turno individual, consultar su detalle, mover la hora de un turno, bloquearlo o volverlo a publicar y revisar el historial paginado. Las escrituras muestran una confirmación antes de enviarse.

La entrada exige `VETERINARIAN_AVAILABILITY_MANAGE` además del acceso existente al área administrativa. Superadministradores, propietarios y veterinarios no reciben esta gestión por herencia. La autorización efectiva sigue en el backend.

No se implementa la generación por lote ni se amplía la gestión de citas o la clínica. La generación por lote existe en el backend y queda como alcance pendiente explícito del frontend; por eso este incremento no cierra por sí solo toda la historia SCRUM-37.

## Contrato comprobado

Se contrastaron `docs/disponibilidad-veterinaria.md`, los controladores, DTO y `VeterinarianAvailabilityService` del checkout backend local. No se inventaron rutas ni se modificaron Java, OpenAPI o migraciones.

| Método y ruta relativa a `/api/v1` | Uso |
| --- | --- |
| `GET /veterinarians/{veterinarianId}/availability-slots` | Fechas locales inclusivas `from`/`to`, máximo 31 días; `status`, `page`, `size` opcionales. |
| `POST /veterinarians/{veterinarianId}/availability-slots` | `{ startsAt }`; publica un turno de 30 minutos. |
| `GET /veterinarians/{veterinarianId}/availability-slots/{slotId}` | Consulta actual antes de operar. |
| `PUT /veterinarians/{veterinarianId}/availability-slots/{slotId}` | `{ startsAt, expectedVersion, reason }`. |
| `PATCH /veterinarians/{veterinarianId}/availability-slots/{slotId}/status` | `{ status, expectedVersion, reason }`. |
| `GET /veterinarians/{veterinarianId}/availability-slots/{slotId}/events` | Historial paginado con actor, versión, estados, horarios y motivo. |

La representación privada del turno es `{id,veterinarianId,startsAt,endsAt,status,version,timeZone}`. Es diferente de `AvailabilitySlot`, utilizado por propietarios, que incluye nombre del veterinario y no incluye estado. Se añadieron tipos y cliente separados para conservar ese contrato público.

Reglas reflejadas:

- Hora explícita `America/Bogota`: la pantalla recibe fecha `AAAA-MM-DD` y hora `HH:mm`, y envía ISO con `-05:00`; el servidor responde instantes UTC y zona de negocio.
- Inicio en `:00` o `:30`, sin segundos, duración de 30 minutos. El administrador puede publicar cualquier turno futuro, incluso hoy; la ventana desde mañana hasta 60 días corresponde al propietario y no se aplica aquí.
- Crear, mover o volver a publicar exige veterinario activo. La consulta y el bloqueo pueden aplicarse a un veterinario inactivo según las guardas del backend.
- Mover y cambiar estado usan la versión observada y motivo no vacío de máximo 500 caracteres. Se evita enviar un cambio de hora idéntico, porque el servidor no registra un evento para una operación sin cambios.
- Un turno iniciado no puede modificarse. Bloquear uno con cita solicitada/confirmada devuelve conflicto y conserva la reserva. Mover uno con cualquier historial de citas devuelve conflicto, aunque la cita anterior haya terminado.
- Un turno publicado no implica que esté libre; la respuesta administrativa no contiene una marca de ocupación. La interfaz no inventa esa disponibilidad.
- No hay eliminación de turnos.

## Concurrencia y errores

Se reutilizan las coordinaciones existentes de sesión, consultas cancelables y una sola mutación en curso. Cada operación captura el contexto de sesión; una respuesta tardía de una cuenta anterior no actualiza ni navega la sesión siguiente.

El alta no tiene clave idempotente. Una desconexión, un error de servidor o una respuesta de éxito vacía, malformada o incompatible bloquea otro envío y ofrece consultar la agenda. Esa consulta vuelve al día enviado, página cero y todos los estados, para que un filtro previo de bloqueados no oculte el turno publicado. No se repite automáticamente el POST. En una actualización incierta se exige consultar de nuevo el detalle.

`CONCURRENT_UPDATE`, turno pasado, cuenta inactiva y recurso ausente requieren actualizar la información. Los conflictos de horario, ocupación y referencia histórica muestran la restricción concreta. La interfaz valida la identidad de turno/veterinario, las páginas y la estructura de respuesta; una respuesta incompatible no se convierte en una página vacía o éxito aparente.

Los formularios usan controles etiquetados, errores por campo, foco en encabezados/resultados/errores y el diálogo existente con foco inicial en Cancelar, Escape, confinamiento de Tab y retorno al control de origen. Esto describe la implementación; la aceptación con teclado en navegador se registra por separado.

## Comprobaciones realizadas en este incremento

Pasaron `npm run typecheck`, ESLint sobre los archivos cambiados y **53 pruebas focalizadas en cuatro archivos**: contrato de disponibilidad, formularios/errores y las coordinaciones existentes de mutación/consulta. **42 pruebas nuevas** pertenecen a disponibilidad. Se comprobaron fechas inválidas, cuadrícula, fronteras temporales, zona Bogotá, versiones/motivos, tipos privados, identidad, paginación, resultados inciertos y respuestas incompatibles.

La exportación web, recorrido de navegador contra el sustituto HTTP, accesibilidad observada y comprobación integrada con el backend real deben quedar consignados con su propia evidencia. Estas pruebas unitarias no acreditan PostgreSQL, ocupación real, correo, despliegue o aceptación de SCRUM-38. No se realizó commit, push, publicación o escritura de Jira desde esta subtarea.
