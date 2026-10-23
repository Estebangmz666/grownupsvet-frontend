# Preparación local y cuenta propia de Cloudflare

Fecha: **22 de octubre de 2026**, America/Bogota.

Estado: aplicación preparada y herramientas verificadas; configuración remota pendiente. Esteban crea su cuenta. La autorización actual permite implementar localmente y preparar el siguiente paso, pero no publicar ni clonar repositorios. No se han creado repositorios o proyectos Pages/Workers ni se ha autorizado una aplicación de GitHub.

## Comprobado en esta revisión

| Elemento | Estado |
| --- | --- |
| Clon activo | `C:\Users\ASUS\Documents\ChatGPT\grownupsvet-frontend`; conserva los cambios de roles, gestión y accesibilidad sin commit. |
| Herramientas | Node **22.18.0**, npm **11.16.0**, Wrangler local **4.151.3**. No se reinstalaron ni actualizaron. |
| Compilación/verificación | `npm run check` y `npm run web:build` correctos. Salida `dist` incluye el worker y los recursos requeridos. |
| Uso local | `npm run web:pages`, puerto 8788, ya activo y conectado por defecto al backend de Cloud Run. |
| Cuenta web Cloudflare | Se pudo abrir la sección **Compute → Workers & Pages** de la cuenta nueva; mostraba «No projects found». Solo se consultó. No se registran correo ni identificadores de cuenta en esta guía. |
| Autenticación de terminal | `npm exec -- wrangler whoami` informó que no está autenticado. La sesión del navegador no autentica automáticamente Wrangler. |
| Configuración versionada | `wrangler.jsonc` aún usa el nombre local `grownupsvet-pwa`, salida `dist` y fecha de compatibilidad 2026-10-21. No se cambió por un proyecto remoto que todavía no existe. |

En esta sesión, `npx wrangler whoami` falló al resolver el ejecutable; la invocación mediante `npm exec -- wrangler whoami` sí ejecutó la versión del proyecto. No se instaló otra versión como solución.

## Siguiente secuencia, sin publicación implícita

1. Vincular Wrangler con la cuenta propia mediante el login oficial, revisando los permisos que muestra Cloudflare. No compartir contraseñas, códigos o tokens por chat ni añadirlos a Git/variables `EXPO_PUBLIC_*`. Este login sigue pendiente; no se inició el consentimiento OAuth en esta revisión.
2. Definir el repositorio bajo control de Esteban y su nombre/visibilidad antes de crearlo o subir contenido. Usar el trabajo local actual y conservar historial, créditos y licencias; no volver a una copia remota antigua suponiendo que incluye los últimos incrementos. La creación y publicación del repositorio conservan su decisión pendiente.
3. Definir el nombre real del proyecto Pages de la cuenta propia. El nombre del compañero y su URL anterior no prueban disponibilidad en esta cuenta. No comprar dominio ni cambiar planes para este paso.
4. Dejar una sola vía de publicación: Pages/Git o Wrangler. La aplicación ya usa un gateway Pages y no necesita cambiar a GitHub Pages para independizar la cuenta. La configuración de Git/CI y los secretos de otro repositorio no se trasladan automáticamente.
5. Antes de cualquier despliegue autorizado, comprobar cuenta, proyecto, rama de producción y exportación concretos. La rama actual `codex/fix-web-cloudflare` no equivale a producción. El script `web:deploy` no fija rama; no utilizarlo suponiendo que actualizará una URL estable.
6. Tras la autorización de publicación, comprobar HTTPS, recursos, login y ruta `/activate-account`. Solo entonces conectar la URL de invitaciones en Cloud Run y hacer el circuito real aprobado con destinatarios confirmados. Conservar imagen, claves, SMTP y configuración ajena.

## Valores técnicos que se conservarán

- Construcción: `npm run web:build`; directorio de salida: `dist`.
- Backend actual: `https://grownupsvet-backend-w5glrcsyda-uc.a.run.app`.
- Base API web: `/api/v1`, resuelta a través del gateway del mismo origen.
- Los secretos de backend no pertenecen al frontend. `UPSTREAM` solo identifica un origen y no necesita credenciales.
- Para pruebas locales con Wrangler se debe pasar el **binding** de `UPSTREAM` explícitamente; una variable del proceso PowerShell por sí sola no apareció como binding del worker. Esta revisión se probó en 8085 con destino al stand-in 4900 y luego se detuvo. No dejar ese destino local en una publicación.
- `.wrangler`, `dist`, `node_modules` y `.env*.local` ya están ignorados. No guardar secretos en otros archivos `.env` suponiendo que cualquier nombre queda excluido.

La configuración completa de hosting y el recorrido de invitaciones siguen pendientes; este documento acredita la preparación y la consulta de cuenta, no un sitio público creado o desplegado.
