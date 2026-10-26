# Pendientes del proyecto

Actualizado el **26 de octubre de 2026**. Los informes fechados conservan el
resultado y los límites de su propio corte; este documento resume el alcance
vigente y no reemplaza esas evidencias.

## Alcance de la entrega

El incremento frontend cubre P1/P2 en una sola aplicación web, con acceso y
sesión comunes para propietarios, administradores, superadministradores y
veterinarios. La [URL publicada](https://grownupsvet-frontend.pages.dev/)
dirige a cada área según los permisos devueltos por el backend.

La API P3 del backend ya contempla borrador, tratamiento, finalización,
historia y recordatorios. Su [contrato clínico](https://github.com/Estebangmz666/grownupsvet-backend/blob/main/docs/atenciones-clinicas.md)
es la referencia para evaluar esas operaciones. Este frontend admite el
estado `COMPLETED` de las citas, pero **no implementa la interfaz clínica**.
La aceptación API P3 no permite cerrar tareas que exijan su recorrido por
interfaz ni la aceptación completa de los tres procesos.

## Aceptación por completar

- Recorridos del frontend publicado con cuentas y datos de ensayo
  autorizados: registro/acceso/perfil/foto, mascotas, citas, personal,
  disponibilidad y diplomas, según cada permiso.
- Cambios administrativos, concurrencia y resultados inciertos contra el
  servicio real. Las simulaciones previas no prueban las transacciones de
  PostgreSQL ni la entrega de correo.
- Instalación y uso del shell PWA sin conexión, sin datos privados en caché.
  Android/iOS requieren su evaluación propia si se incluyen en la entrega.
- Evaluación real de teclado, foco, zoom y lector de pantalla, y tareas con
  personas mayores. Las comprobaciones automatizadas no reemplazan esas
  observaciones ni constituyen una certificación de accesibilidad.

La ejecución debe registrar commit, revisión desplegada, entorno, resultado
y evidencia sanitizada. Un caso preparado permanece sin ejecutar hasta
observar el resultado; no se declara aprobado por existir código o un build.

## Plantillas de correo del backend

La mejora solicitada el 23/10 está implementada. El [informe del backend](https://github.com/Estebangmz666/grownupsvet-backend/blob/main/docs/verificacion-plantillas-correo-2026-10-23.md)
documenta HTML y texto plano, composición MIME, escapes, vencimientos y
pruebas de transporte aislado. Queda por acreditar cada recorrido requerido
con el despliegue y buzón autorizados, distinguiendo aceptación SMTP de
recepción. Este incremento frontend no modifica esas plantillas.
