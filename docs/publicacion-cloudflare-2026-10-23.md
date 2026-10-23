# Publicación web del 23 de octubre de 2026

## Resultado observado

El sitio está publicado en <https://grownupsvet-frontend.pages.dev>.
El repositorio privado es [Estebangmz666/grownupsvet-frontend](https://github.com/Estebangmz666/grownupsvet-frontend), rama `main`.
Se conservó el historial original; `a028b06c0a744483646768fa0da7e629d3074fd2`
es ancestro del incremento integrado `613c0ca8fb9ee00f83b3abeec08b6ec1b17bb679`.
El remoto del equipo permanece como `upstream`, y el repositorio propio es `origin`.
Antes de migrar se verificó un bundle Git completo y una copia de los 224 archivos
versionables del árbol de trabajo. No se incluyeron entornos locales, registros
de simulación ni credenciales.

El [primer despliegue de producción](https://dash.cloudflare.com/a7a3641643204d0e942676235bb8033c/pages/view/grownupsvet-frontend/81a9c3f5-cbf7-4718-a933-869696fc1f93)
terminó con estado `success` a las 07:38 del 23/10/2026, hora de Bogotá.
Identifica el commit `613c0ca`, rama `main`, con duración de 1 minuto y 22 segundos.
Su URL inmutable es <https://81a9c3f5.grownupsvet-frontend.pages.dev>.

## Validaciones y configuración

El [CI del incremento](https://github.com/Estebangmz666/grownupsvet-frontend/actions/runs/39954537546)
terminó correctamente: instalación desde lockfile, tipos, ESLint, pruebas,
exportación web y artefacto. Pages repitió el gate completo antes de publicar:
**390 pruebas en 35 archivos**, tipos, lint y exportación correctos.
La [verificación funcional local](verificacion-disponibilidad-2026-10-23.md)
registra la simulación HTTP y los recorridos con cuentas ficticias.

Pages usa framework `None`, raíz del repositorio, salida `dist` y comando
`npm ci && npm run check && npm run web:build`. Los pushes de `main` disparan
la publicación automática. GitHub Actions verifica y conserva el artefacto;
no publica ni contiene secretos de Cloudflare. La integración GitHub fue
autorizada únicamente para este repositorio.

En el primer despliegue, las variables introducidas en el dashboard no fueron
aplicadas porque el proyecto ya usaba la configuración Wrangler: el log muestra
Node 22.16.0 y una instalación adicional. Este ajuste versiona en `wrangler.jsonc`
`NODE_VERSION=22.18.0` y `SKIP_DEPENDENCY_INSTALL=1`, siguiendo la
[configuración de Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).
La aplicación usa `/api/v1` y el gateway mantiene el destino real definido en
`proxy/policy.mjs`; no se publicó el sustituto Postman.

El hash del bundle exportado en Linux fue
`index-d482cf996ef950201c6808830853540a.js`; el build local en Windows produjo
`index-9928c963a4ddd234310124749a54bf54.js`. No se usa igualdad entre sistemas
como prueba de despliegue: se contrasta el commit y el recurso indicado por el
log del build remoto con lo servido por HTTPS.

## Límites

La publicación y las comprobaciones GET sin credenciales no acreditan el login,
el registro, las invitaciones SMTP, la carga de fotos ni las transacciones reales
de citas y disponibilidad. Esos recorridos requieren cuentas y datos autorizados.
La generación de turnos por lotes sigue pendiente, y no se modificaron los estados
de Jira ni el backend durante este incremento.

Los avisos de auditoría de dependencias se conservan en el expediente local de
publicación para evaluación separada; un build correcto no implica ausencia de
vulnerabilidades. El cierre de la aplicación de escritorio no forma parte del
frontend y se documentó fuera del repositorio, sin volcar registros privados.
