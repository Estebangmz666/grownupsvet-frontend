# Alojamiento y continuidad de la base de datos

GrownupsVet utiliza PostgreSQL alojado en el plan gratuito de Render y ejecuta
el backend en Google Cloud Run. El equipo eligió alojar la base de datos en un
proveedor gratuito independiente para aprovechar los USD 300 de crédito gratuito
de Google Cloud en otros recursos del proyecto y reducir el riesgo de agotar ese
crédito antes de la entrega.

## Vencimiento y alcance académico

GrownupsVet es un proyecto exclusivamente académico. Su desarrollo, entrega y
sustentación responden a los objetivos de la asignatura; el proyecto no está
destinado a la venta ni a su explotación comercial.

La documentación operativa registra el **14 de noviembre de 2026** como fecha
de vencimiento prevista de la base gratuita de Render. El equipo contempla que,
para entonces, el semestre habrá terminado y la entrega y sustentación final
del proyecto ya se habrán realizado. Bajo esa planificación, el vencimiento no
debería afectar la presentación académica.

La decisión del responsable es eliminar los datos personales cuando venza la
base de datos de Render. El respaldo previsto es temporal: al llegar esa fecha
también será necesario eliminar las copias y restauraciones que contengan datos
personales. El vencimiento en Render no elimina por sí solo las copias locales.
Hasta ese momento, el respaldo local se conservará únicamente para atender
algún inconveniente que surja después de la sustentación o para responder a
una solicitud del profesor relacionada con la revisión del proyecto.

## Respaldo programado y restauración local

Hay una automatización de Codex programada para el **13 de noviembre de 2026 a
las 09:00, hora de Bogotá**, un día antes del vencimiento informado. Su objetivo
es obtener un respaldo de la base de datos de Render en el equipo local y
verificar el archivo, su catálogo y su integridad mediante SHA-256. Incluye las
tablas y los datos de la base, las fotos almacenadas en PostgreSQL, el historial
de migraciones y las colas persistidas.

La automatización produce el archivo de respaldo. La restauración en una base
PostgreSQL local es un paso independiente que se realiza mediante el
procedimiento documentado cuando se necesite comprobar o recuperar la copia. El
respaldo no incluye los roles globales del proveedor, los secretos externos ni
los archivos que estén fuera de PostgreSQL.

La ejecución programada requiere el computador y Codex disponibles, acceso a
las herramientas y credenciales locales existentes y conectividad con Render.
El respaldo del 13 de noviembre es una tarea futura; su resultado se conocerá
cuando se ejecute. Una copia anterior de Render fue restaurada y comprobada en
una base local aislada el 25 de octubre de 2026.

Los detalles del procedimiento y de la verificación anterior se encuentran en
la documentación del backend:

- [Respaldo de PostgreSQL en Render](https://github.com/Estebangmz666/grownupsvet-backend/blob/main/docs/respaldo-render.md).
- [Verificación del respaldo y restauración del 25 de octubre](https://github.com/Estebangmz666/grownupsvet-backend/blob/main/docs/verificacion-respaldo-render-2026-10-25.md).
