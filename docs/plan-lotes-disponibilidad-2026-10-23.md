# Incremento: generación de disponibilidad por lotes

## Diagnóstico y selección

El frontend publicado contiene gestión de turnos individuales. La generación
por lotes quedó pendiente explícita en SCRUM-37. Jira mantiene SCRUM-37 por
iniciar, su historia SCRUM-11 y verificación SCRUM-38 en curso; SCRUM-36 y
SCRUM-78, correspondientes al backend y contrato, figuran finalizadas.
La descripción de SCRUM-37 está vacía: se usan los criterios del padre y el
contrato implementado, sin añadir reglas de negocio no acordadas.

Se conserva el checkout activo, con base `2d4f894`, y los cambios locales
ajenos del backend. Su HEAD es `0bd38ed7bfe9a4cc715bb9f1e21dbcafc53c31cc`.
La descarga del OpenAPI real del 23/10/2026 responde 200, versión 0.9.0, y
coincide en los esquemas y ruta de lotes con el código fuente revisado.

## Alcance

Desde la agenda del veterinario, un administrador con
`VETERINARIAN_AVAILABILITY_MANAGE` podrá preparar un lote con fechas inicial
y final inclusivas, días ISO de la semana y una franja diaria. Se mostrará
una revisión por fecha y cantidad antes de la confirmación. Se reutilizan
sesión, coordinación de mutaciones, estilos, confirmación y mensajes accesibles.

El cliente utilizará exclusivamente
`POST /veterinarians/{veterinarianId}/availability-slot-batches`, relativo a
`/api/v1`, con `{startDate,endDate,daysOfWeek,dailyStartTime,dailyEndTime}`.
La respuesta 201 es `{createdCount,items,timeZone}`; no es una página ni lleva
un identificador de lote o clave idempotente.

Reglas observables: 1 a 31 fechas inclusivas, días únicos del 1 al 7,
cuadrícula de 30 minutos, fin exclusivo y `24:00` permitido solamente al
terminar la jornada. El lote contiene 1 a 1000 turnos y todos deben iniciar
en el futuro, según Bogotá. No se rechaza una fecha inicial por sí sola si
los días realmente generados son futuros. El profesional debe estar activo.
Un turno existente, incluso bloqueado, provoca el rechazo del conjunto;
no se omiten conflictos ni se publican parciales.

## Riesgos y decisiones técnicas

La vista previa expresa la intención, no reserva horas ni asegura que el
servidor vaya a aceptar el lote. La respuesta se valida contra la cantidad,
el conjunto de inicios y la identidad esperados. Un éxito vacío, malformado
o incompatible se trata como resultado incierto, al igual que una pérdida
de respuesta, HTTP 408 o errores de servidor. Se bloquea otro POST desde
esa pantalla y no hay reenvío automático.

La consulta posterior recorre todo el rango y todas sus páginas, sin filtro
de estado. Muestra el estado vigente de los horarios previstos. Su presencia
no demuestra qué intento los creó: el contrato no ofrece datos para atribuir
el resultado a esta petición. Las respuestas tardías de otra sesión se descartan.

## Secuencia y aceptación

1. Modelo puro y DTO/cliente tipado, con pruebas de límites y respuestas incompatibles.
2. Formulario con días seleccionables, revisión, confirmación, resultado y consulta.
3. Sustituto HTTP local con el contrato real y regresión de turnos individuales.
4. Comprobación de tipos, lint, pruebas y exportación; revisión independiente.
5. Navegador sobre datos ficticios: éxito, colisión, respuesta perdida, teclado y móvil.
6. Commit/push y despliegue por la integración existente; comprobar CI, Pages y GET públicos.

No se incluyen gestión de citas, clínica, cambios de contrato/backend,
migraciones, versiones de dependencias ni escrituras de Jira. La entrega
separa implementación, simulación y publicación de la aceptación con datos
y cuentas reales. No se declara finalizada una historia de Jira por publicar código.
