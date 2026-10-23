# Vistas por rol: implementación y verificación local

Fecha: 22 de octubre de 2026, America/Bogota.

**Resultado:** implementada la entrada común y las cuatro áreas del [plan](plan-implementacion-2026-10-21-vistas-por-rol.md). Pasaron TypeScript, ESLint, 121 pruebas en 20 archivos y la compilación web. Se recorrió la aplicación exportada en navegador contra una simulación HTTP del contrato. La aceptación con cuentas reales de los cuatro roles y la publicación en Cloudflare siguen pendientes.

## Base y alcance

Se trabajó en `C:\Users\ASUS\Documents\ChatGPT\grownupsvet-frontend`, rama `codex/fix-web-cloudflare`, base `a028b06c0a744483646768fa0da7e629d3074fd2`. Se volvió a consultar `origin/master`: conserva esa misma base. El incremento permanece local, sin commit ni push, junto con reparaciones y documentos anteriores que se preservaron.

Se consultaron las instrucciones locales de Expo y su [documentación de SDK 57](https://docs.expo.dev/versions/v57.0.0/). El [OpenAPI desplegado](https://grownupsvet-backend-w5glrcsyda-uc.a.run.app/v3/api-docs) volvió a responder versión funcional **0.9.0**. No se modificaron el backend, sus permisos, su contrato ni la infraestructura.

| Rol recibido en el login | Entrada implementada | Alcance |
| --- | --- | --- |
| `OWNER` | Mis mascotas | Conserva mascotas, citas y perfil; menús, rutas y acciones comprueban sus permisos. |
| `SUPER_ADMIN` | Administradores | Lista paginada y filtro por estado, con `ADMINISTRATOR_MANAGE`. |
| `ADMINISTRATOR` | Veterinarios | Lista paginada y filtro por estado, con `VETERINARIAN_MANAGE`. |
| `VETERINARIAN` | Mi agenda | Citas asignadas del día en Bogotá, con `APPOINTMENT_READ_ASSIGNED`; anterior, hoy y siguiente. |

Las nuevas pantallas del personal son de **solo lectura**. No implementan altas o cambios de personal, gestión administrativa de citas, disponibilidad ni atención clínica. No se inventaron filtros de propietario o veterinario: la API determina el ámbito por la sesión.

## Sesión y navegación

- Una aplicación Expo, un proveedor de autenticación y un navegador raíz. El acceso, registro y recuperación se comparten; no hay selector manual de rol.
- Instantánea versionada con identidad, token, rol, permisos y vencimiento absoluto. En web se usa `sessionStorage`, con respaldo temporal en memoria y aviso si falla la persistencia. Las sesiones antiguas que guardaban solo el token requieren otro login.
- Se comprueba la coherencia de identidad, rol, permisos y expiración entre la instantánea y los claims del JWT. Decodificar el token **no verifica su firma**; el backend sigue autenticando y autorizando cada solicitud.
- Al restaurar, cada rol hace una lectura autorizada. Solo OWNER consulta `/users/me`. El personal reutiliza la primera página obtenida al comprobar su sesión, sin duplicarla al montar la vista.
- Una generación y un contexto capturado por solicitud aíslan respuestas, login, restauración, errores 401 y cierres tardíos de cuentas anteriores. El cierre remoto utiliza el token de la cuenta que salió.
- Un 401 vigente termina la sesión; un 403 conserva la sesión y muestra la denegación. Un fallo de conexión al restaurar oculta el contenido privado y ofrece reintentar o salir. El vencimiento no se amplía al recargar.
- Los avisos de borrado local o revocación remota fallidos se muestran sin esperar indefinidamente la otra operación, y tampoco pueden modificar una sesión posterior.

## Comprobaciones ejecutadas

| Comprobación | Resultado y límite |
| --- | --- |
| `npm run check` | TypeScript y ESLint correctos; **121 pruebas en 20 archivos**, incluyendo las existentes. No son 121 pruebas nuevas ni 121 recorridos de navegador. |
| `npm run web:build` | Exportación Expo y preparación de PWA/Pages correctas. Bundle final `index-43cbbd04abe6ca51e21627f3d12670f0.js`. |
| Cliente y sesión | Pruebas de claims, vencimiento, almacenamiento, permisos, restauración, contexto de solicitud y respuestas/cierres tardíos entre cuentas. |
| Consultas del personal | Pruebas de DTOs, páginas, filtros, agenda por fecha de Bogotá y descarte de respuestas de consultas anteriores. |
| Contrato del entorno simulado | **32 comprobaciones HTTP** mediante Postman CLI 1.74.0 y Python/jsonschema; incluyen el reinicio del entorno y las respuestas aplicables contrastadas con el snapshot OpenAPI 0.9.0. Son pruebas del sustituto HTTP, distintas de las 121 pruebas del proyecto. |
| Gateway local al backend real | En `http://127.0.0.1:8788`, `GET /api/v1/pets` sin sesión respondió **401**, `Cache-Control: no-store`; `/v3/api-docs` respondió **0.9.0**. No acredita login ni listados con cuentas reales en este incremento. |
| `git diff --check` | Sin errores de espacios en los cambios revisados. |

ESLint mantiene un aviso no fatal por el tipo de módulo de su configuración. No se migró el runtime ni se actualizaron dependencias ajenas al incremento para eliminar avisos de herramientas.

## Recorridos de la aplicación en navegador

Se sirvió la exportación real con Wrangler Pages en el puerto 8085, reenviando `/api/v1` a la simulación local en el puerto 4900. Se usaron únicamente cuentas y datos ficticios. Las comprobaciones fueron sobre la interfaz y sus solicitudes HTTP, no solo sobre funciones aisladas.

| Recorrido | Resultado observado |
| --- | --- |
| Contraseña incorrecta | Error visible y formulario conservado. |
| SUPER_ADMIN | Administradores, segunda página, filtro por estado que vuelve a la primera página y restauración en el mismo rol. |
| ADMINISTRATOR | Veterinarios, segunda página, filtro por estado y restauración correcta. |
| VETERINARIAN | Agenda del día en Bogotá, día siguiente vacío, regreso a hoy y restauración correcta. |
| OWNER | Mascotas, detalle, citas y perfil consultados; restauración en su área. |
| Cerrar OWNER A y entrar como OWNER B | Se mostró la mascota y la identidad de B; no se conservaron los datos ni la navegación privada de A. |
| Rol del personal sin permiso de entrada | Mensaje controlado; ninguna consulta privada. |
| Consulta con 403 | Acceso denegado sin convertirlo en logout automático; al restaurar se bloqueó el contenido privado. |
| Restauración con 503 y posterior reintento | Contenido privado oculto durante el fallo; recuperación de la lista sin otro login al volver la respuesta 200. |
| Registro y recuperación trasladados | Las pantallas públicas abrieron después de salir. No se ejecutaron registro, envío de códigos o cambio de contraseña completos. |
| Celular 390 × 844 y computador 1440 × 900 | Distribución y capturas revisadas visualmente, sin desbordamiento horizontal del documento. No es una auditoría formal de accesibilidad. |

La auditoría segura conserva **31 solicitudes** de los recorridos normales y **19** de fallos y capturas finales. En las tres sesiones del personal del recorrido normal hubo **cero solicitudes a `/users/me` o `/pets`**. La restauración reutilizó una única primera consulta. La recuperación 503 → 200 no requirió un nuevo login. Los archivos exportados contienen solo fecha, método, ruta y estado; no contienen tokens, cabeceras ni cuerpos.

Evidencia local, fuera del árbol Git del frontend:

`C:\Users\ASUS\Documents\ChatGPT\GrownupsVet\output\vistas-por-rol-2026-10-22`

- `superadmin-computador.png`, `administrador-movil.png`, `veterinario-movil.png`, `propietario-movil.png`, `restauracion-error-movil.png`.
- `browser-http-audit-normal.json`, `browser-http-audit-normal-summary.json`, `browser-http-audit-faults.json`, `http-verification.json`.

La simulación se detuvo al terminar; se comprobó cerrado el puerto 4900 y se cerró también el servidor de prueba 8085. La aplicación local del puerto 8788 quedó apuntando al backend real para el usuario.

## Reproducción

Desde la raíz del frontend:

```powershell
npm ci
npm run check
npm run web:build
npm run web:pages
```

La vista local abre en `http://localhost:8788/`. Para repetir el entorno ficticio, seguir [postman/README.md](../postman/README.md), iniciar la simulación y ejecutar el runtime local en otro puerto:

```powershell
.\postman\scripts\roles-simulation.ps1 -Action Start
npx wrangler pages dev dist --port 8085 --binding UPSTREAM=http://127.0.0.1:4900
```

El comando Wrangler queda activo hasta salir con `x`. Al terminar, detener la simulación con `roles-simulation.ps1 -Action Stop`. No establecer ese `UPSTREAM` local en una publicación pública.

## Límites y pendientes

1. **Aceptación con cuentas reales:** falta recorrer los cuatro roles contra Cloud Run con datos apropiados, incluidos expiración y revocación reales. El acceso de superadmin confirmado por Esteban antes de este incremento es antecedente, no evidencia nueva de estas vistas.
2. **Publicación:** sigue pendiente acceso a Cloudflare. No se ejecutó despliegue ni se corrigió la URL pública anterior. La alternativa de publicar en una cuenta propia quedó como decisión futura.
3. **Límites de la simulación:** se intentó localizar el mock del equipo, pero Postman no tenía sesión autenticada. Se generó un sustituto local desde el contrato canónico. Sus JWT no tienen firma válida para producción y no acredita criptografía, base de datos, correo ni todas las operaciones. Las operaciones no modeladas responden 501 exclusivo del entorno.
4. **Propietario:** se preservaron las funciones existentes y se comprobaron las lecturas afectadas por este incremento. No se certificaron escrituras completas. Siguen los pendientes anteriores de foto multipart en web, distinción de errores 400 en recuperación y selector de cita limitado a la primera página de mascotas; consultar el informe de Jira previo.
5. **Servidor alternativo Node:** al intentar `npm run web:serve` se observó un problema previo de resolución de rutas estáticas en Windows, con «Ruta no válida». No se cambió ese servidor en este incremento. La verificación web y la vista final usan `npm run web:pages`, que sí funcionó.
6. No se generaron ni certificaron aplicaciones Android/iOS; tampoco se repitió una certificación completa de instalación/offline de la PWA.

## Continuidad en Jira

Este incremento aporta a **SCRUM-25** (entrada y sesión de gestión), **SCRUM-24** (acceso común y conservación de propietario), **SCRUM-26** (validación) y **SCRUM-75** (base de ambos portales). Los listados aportan parcialmente a **SCRUM-34** y la consulta de agenda parcialmente a **SCRUM-41**; no completan sus operaciones de gestión.

No se modificaron estados, comentarios, responsables ni sprints de Jira. Esta evidencia no cierra automáticamente ninguna tarea. A partir del siguiente incremento, el alcance debe salir de las tareas actuales de Jira, conforme a la instrucción de Esteban.
