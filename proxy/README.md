# Gateway de mismo origen de la PWA

El backend rechaza con `403 Invalid CORS request` cualquier petición de
navegador cuyo `Origin` no esté en la lista permitida, y esa lista no se va a
habilitar. En vez de pelear con CORS, este gateway sirve la PWA **y** el proxy
de la API desde **un mismo origen**, de modo que el navegador nunca hace una
petición cross-origin: no hay `Origin` cross-site, no hay preflight y las
reglas CORS del backend jamás se evalúan.

```
navegador ──► https://app.<dominio> ──► gateway ──► backend Cloud Run
                    │                      │
                    └── /index.html        └── /api/*  (sin Origin, XFF reconstruido)
```

El backend **no se modifica**: es solo referencia.

## Ejecutar en local

```bash
npm run web:build      # genera dist/ con expo export --platform web
npm run web:serve      # http://localhost:8081
```

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

## Desplegar en Cloudflare Pages (opción recomendada)

```bash
npm run web:build
npx wrangler pages deploy dist --project-name=grownupsvet-pwa
```

En Pages → Settings → Variables define `UPSTREAM` si cambia el backend. No
definas `PWA_DEV_ORIGINS` en producción: con la lista vacía el worker no emite
ninguna cabecera CORS.

El workflow de CI publica automáticamente los pushes a `main` cuando existen
los secretos de GitHub `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`. Crea
antes el proyecto Pages `grownupsvet-pwa` y asigna un dominio propio HTTPS; sin
esos secretos CI solo valida y genera el artefacto, sin desplegarlo.
El token necesita permisos de escritura para Pages en la cuenta configurada.

## Cabeceras que garantiza el gateway

| Cabecera                    | Valor                                                | Por qué                                                                                         |
| --------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| _(se elimina)_              | `Origin`, `Referer`, `Sec-Fetch-*`, `Cookie`, `Host` | Evita las reglas CORS del backend y no filtra cookies propias a una API Bearer                  |
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
5 MB por archivo. El gateway responde `413` antes de reenviar.

## Notas de seguridad

- El token viaja en `Authorization`, que el gateway reenvía sin modificar; nunca
  se registra en consola.
- El destino del proxy es una constante, no controlada por el usuario: no hay
  SSRF.
- **Lo que protege de verdad** no es CORS (la API usa Bearer, no cookies, así
  que CORS no evita CSRF) sino impedir el acceso directo no confiable al
  backend. Cloud Run no ofrece una lista arbitraria de IP permitidas como modo
  de ingress: para permitir únicamente tráfico que pasa por Cloudflare, coloca
  Cloud Run detrás de un HTTPS Load Balancer externo, limita el ingress del
  servicio a `internal-and-cloud-load-balancing` y aplica una política de
  Cloud Armor que acepte los
  [rangos IP publicados por Cloudflare](https://www.cloudflare.com/ips/).
  Revisa también salud, TLS y acceso de administración antes de activar la
  restricción para no bloquear despliegues legítimos.
- La aplicación requiere que el proxy y el frontend permanezcan en el mismo
  origen. No configures el navegador para llamar directamente al dominio de
  Cloud Run.
