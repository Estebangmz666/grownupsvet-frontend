# Gateway de mismo origen de la PWA

El gateway sirve la PWA **y** el proxy de la API desde **un mismo origen**.
El navegador consulta `/api/v1` en el dominio de la aplicación y el gateway
reenvía esas peticiones a Cloud Run. Así, la conexión del navegador con la API
no depende de una llamada entre dominios distintos ni requiere modificar la
configuración CORS del backend para este recorrido.

```
navegador ──► https://app.<dominio> ──► gateway ──► backend Cloud Run
                    │                      │
                    └── /index.html        └── /api/*  (sin Origin, XFF reconstruido)
```

El backend conserva la autenticación, los permisos y las validaciones de cada
operación. Este gateway no modifica el backend ni su infraestructura.

## Ejecutar en local

```bash
npm run web:build      # genera dist/ con expo export --platform web
npm run web:serve      # http://localhost:8081
```

Para probar el Worker y los archivos estáticos con el runtime local de Pages,
después de compilar usa `npm run web:pages` y abre `http://localhost:8788`.
Esta comprobación utiliza Wrangler instalado mediante el lockfile y no publica
el proyecto ni requiere credenciales de Cloudflare.

La compilación prepara `manifest.webmanifest`, los iconos, `sw.js`, su lista
de precarga y el worker de Pages (`_worker.js`). El service worker solo guarda
el shell y recursos estáticos del mismo origen; excluye `/api/*` y
`/v3/api-docs`. `sw.js`, el manifiesto y el HTML se sirven con revalidación para
que las actualizaciones de la app se detecten.

Comprobación de que no hay CORS:

```bash
curl -s -i http://localhost:8081/api/v1/pets | head -3      # 401, no 403
curl -s -i -H "Origin: http://evil.example" \
  http://localhost:8081/api/v1/pets | head -3                # sigue sin 403
```

Con `npm run web` (Metro, HMR) la app queda en otro origen; en ese caso define
`EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1` y levanta el gateway en
el 8080 con `PORT=8080 npm run web:serve`. El CORS opt-in de desarrollo es lo
único que añade cabeceras CORS, y solo para los orígenes listados.

## Variables de entorno

| Variable          | Por defecto              | Descripción                                     |
| ----------------- | ------------------------ | ----------------------------------------------- |
| `PORT`            | `8081`                   | Puerto de escucha del servidor Node             |
| `UPSTREAM`        | backend desplegado       | Origen del backend                              |
| `STATIC_DIR`      | `dist`                   | Carpeta con la exportación web                  |
| `PROXY_IP`        | vacío                    | IP de salida, para completar `X-Forwarded-For`  |
| `PWA_CSP`         | `frame-ancestors 'none'` | CSP completo (ver Fase 3)                       |
| `PWA_DEV_ORIGINS` | vacío                    | Lista opt-in de orígenes con CORS en desarrollo |

## Preparar la publicación en Cloudflare Pages

La configuración versionada en [`../wrangler.jsonc`](../wrangler.jsonc) define
el proyecto `grownupsvet-frontend`, la salida `dist` y la fecha de compatibilidad
`2026-10-21`. En la integración Git de Cloudflare Pages, comprueba estos valores:

| Campo                  | Valor                    |
| ---------------------- | ------------------------ |
| Rama de producción     | `main`                   |
| Directorio raíz        | Raíz de este repositorio |
| Comando de compilación | `npm ci && npm run check && npm run web:build` |
| Directorio de salida   | `dist`                   |

El resultado debe contener `index.html`, los archivos estáticos de Expo,
`_worker.js` y `policy.mjs`. Publicar la raíz del código fuente no equivale a
publicar esa exportación.

La vía de publicación prevista es la integración Git de Cloudflare Pages con
el repositorio autorizado y la rama `main`. Un build correcto y una vista local
no acreditan un despliegue público. Antes de publicar, contrasta el proyecto,
la rama, el comando y el directorio de salida con el dashboard. Al desplegar
con `wrangler.jsonc`, sus campos pasan a ser la fuente de configuración para
Pages Functions.

Wrangler ofrece una vía manual alternativa, únicamente desde una cuenta con
acceso al proyecto y después de comprobar su nombre y rama. No la configures
como un segundo automatismo junto a la integración Git:

```bash
npm run web:build
npx wrangler pages deploy --branch=main
```

`UPSTREAM` puede definir el origen del backend si cambia. El valor por defecto
permanece en `proxy/policy.mjs`. `PWA_DEV_ORIGINS` es una opción de desarrollo;
con la lista vacía el worker no añade cabeceras CORS.

El workflow de GitHub Actions verifica tipos, lint, pruebas y build en todas
las ramas y los pull requests. Solo adjunta la exportación si todo termina
correctamente; no contiene un despliegue ni utiliza secretos de Cloudflare.
La integración Git de Pages gestiona la publicación. El nombre local de
`wrangler.jsonc` no demuestra que ya exista un proyecto remoto.

## Cabeceras que garantiza el gateway

| Cabecera                    | Valor                                                | Por qué                                                                                         |
| --------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| _(se elimina)_              | `Origin`, `Referer`, `Sec-Fetch-*`, `Cookie`, `Host` | El gateway reenvía la solicitud al origen configurado sin cookies propias del frontend          |
| `X-Forwarded-For`           | IP real del cliente (+ IP del proxy)                 | El backend usa `forward-headers-strategy: native`; se reconstruye para que nadie suplante su IP |
| `X-Forwarded-Proto`         | `https`                                              | El backend confía en el esquema reenviado                                                       |
| `Cache-Control`             | `no-store` (solo `/api/*`)                           | Ningún dato clínicos en cachés de navegador o intermediario                                     |
| `Content-Security-Policy`   | `frame-ancestors 'none'`                             | Protección contra clickjacking sin arriesgar el bundle                                          |
| `X-Content-Type-Options`    | `nosniff`                                            | Sin interpretación implícita de tipos                                                           |
| `Referrer-Policy`           | `no-referrer`                                        | No se filtra la URL a terceros                                                                  |
| `X-Frame-Options`           | `DENY`                                               | Compatibilidad del frame-ancestors                                                              |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`                | Fuerza HTTPS                                                                                    |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`           | La app no usa esos permisos en web                                                              |

Límites heredados del backend: cuerpo máximo de 6 MB y subida multi-archivo de
5 MB por archivo. El servidor Node también comprueba los bytes recibidos; el
worker rechaza antes de reenviar cuando `Content-Length` declara más de 6 MB.
El backend conserva la validación definitiva del cuerpo y de cada archivo.

## Notas de seguridad

- El token viaja en `Authorization`, que el gateway reenvía sin modificar; nunca
  se registra en consola.
- El destino del proxy es una constante, no controlada por el usuario: no hay
  SSRF.
- La autenticación y la autorización se verifican en el backend para cada
  operación. El gateway y CORS no sustituyen esos controles. Esta configuración
  conserva el backend y su infraestructura actuales.
- La aplicación requiere que el proxy y el frontend permanezcan en el mismo
  origen. No configures el navegador para llamar directamente al dominio de
  Cloud Run.
