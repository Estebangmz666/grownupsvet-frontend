# GrownupsVet frontend

Aplicación móvil para propietarios de mascotas, desarrollada con Expo SDK 57 y
React Native. La aplicación administrativa se abordará en una fase futura.

## Estructura del monorepo

```text
grownupsvet-frontend/
  apps/
    propietario/                 Aplicación móvil para propietarios
    administrativo/              Reservada para desarrollo futuro
  packages/
    api-client/                  Cliente HTTP tipado para la API del backend
    accessibility-kit/           Componentes y utilidades de accesibilidad
```

## Aplicación para propietarios

El punto de entrada de la aplicación es el proyecto Expo en la raíz del
repositorio. La navegación principal alterna entre el flujo de autenticación y
las pestañas disponibles según la sesión almacenada.

Áreas implementadas:

- **Autenticación:** inicio de sesión, registro de cuenta y flujo de recuperación
  de contraseña en tres pasos. Los tokens de acceso se almacenan mediante
  `expo-secure-store` en móvil y `sessionStorage` en la vista web.
- **Mascotas:** consultar mascotas activas y archivadas, ver sus detalles,
  crearlas y editarlas, y archivarlas o reactivarlas. El archivado conserva la
  mascota y su historial; no se admite su eliminación definitiva.
- **Citas:** consultar citas próximas (hasta 60 días) y anteriores (en
  incrementos de 31 días, hasta 12 tramos), ver detalles de solo lectura y
  solicitar una cita con una mascota activa y un horario disponible entre
  mañana y los próximos 60 días. Las
  consultas de la lista usan fechas del calendario de Bogotá y respetan el
  límite inclusivo de 31 días del backend; también recuperan todas las páginas
  de resultados. La reserva requiere confirmación y contempla horarios que
  dejan de estar disponibles. La aplicación admite el estado `NO_SHOW` y
  muestra los estados futuros desconocidos con un estilo neutro. Los
  propietarios no pueden cancelar ni reprogramar citas desde la aplicación.
- **Avisos de una cita:** desde el detalle de una cita, consultar los avisos de
  correo programados o enviados al propietario (confirmación, rechazo,
  cancelación, reprogramación, reasignación y recordatorio). Cada aviso muestra
  su estado de entrega (`PENDING`, `SENDING`, `SENT`, `FAILED`, `SUPERSEDED`)
  con un estilo neutro para estados desconocidos, y los avisos fallidos muestran
  el detalle técnico que reporta el backend. `SENT` significa que el
  servidor de correo aceptó el mensaje, no que se haya leído en el buzón.
- **Perfil:** consultar la información de la cuenta, actualizar el número de
  teléfono, agregar, cambiar o quitar la foto de perfil, cerrar sesión y
  desactivar la cuenta.

El selector de fotos del perfil usa el selector de imágenes del sistema. Las
imágenes se recortan y comprimen en el dispositivo antes de cargarse. Las fotos
de perfil se obtienen mediante el cliente API autenticado, no desde una URL de
imagen sin autenticación.

## Paquetes compartidos

### `packages/api-client`

Contiene operaciones API tipadas para autenticación y recuperación de
contraseña, mascotas, citas, horarios disponibles, avisos de cita y perfiles de
propietarios.
Admite solicitudes autenticadas, cargas de fotos multipart y respuestas sin
procesar para datos binarios protegidos. El contrato del backend está
documentado en el
[repositorio OpenAPI de grownupsvet-backend](https://github.com/Estebangmz666/grownupsvet-backend).

### `packages/accessibility-kit`

Proporciona tokens de diseño compartidos, los componentes `ConfirmDialog`,
`LoadingState`, `EmptyState` y `ErrorState`, además de `useReadAloud()` y otras
utilidades de accesibilidad.

## Configurar la API

De forma predeterminada la configuración depende de la plataforma:

| Plataforma | Base URL                       | Motivo                                                                                           |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Web**    | `/api/v1` (relativa)           | Comparte origen con el gateway, así que no hay peticiones cross-origin y **no se necesita CORS** |
| **Nativo** | `http://localhost:8080/api/v1` | No comparte origen con el backend                                                                |

Configura `EXPO_PUBLIC_API_BASE_URL` para cambiar esta dirección. En un emulador
de Android, usa `http://10.0.2.2:8080/api/v1` si el backend se ejecuta en la
máquina anfitriona. En un dispositivo físico, usa la dirección LAN de esa
máquina. Para probar contra el backend desplegado en Cloud Run, puedes usar
`https://grownupsvet-backend-w5glrcsyda-uc.a.run.app/api/v1` en Android e iOS.

Para desarrollo web con HMR (Metro en el 8081), apunta la variable al gateway
en vez del backend: `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1`
junto con `PORT=8080 npm run web:serve`. Ver `.env.example`. No incluyas en
commits archivos de entorno locales con configuraciones específicas de la
máquina.

## PWA instalable y conexión web al backend

El backend responde `403 Invalid CORS request` a cualquier navegador cuyo
`Origin` no esté en la lista permitida, y esa lista no se va a habilitar. La
solución no es pelear con CORS, sino **servir la PWA y el proxy desde un mismo
origen**: el navegador pide `/api/v1` sobre su propia URL, así que nunca envía
`Origin` cross-site, no hay preflight y las reglas CORS del backend no se
evalúan nunca. El backend no se modifica; solo se consulta.

La exportación web incorpora un manifiesto y un service worker. La PWA se puede
instalar y conserva el shell de la aplicación para abrirlo sin conexión. La
precarga se limita al HTML y recursos estáticos versionados; **las rutas de API,
respuestas privadas y tokens no se guardan para uso offline**.

```bash
npm run web:build     # exporta Expo y prepara manifest, iconos y worker en dist/
npm run web:serve     # sirve dist/ y hace de proxy de /api/*  → http://localhost:8081
```

El gateway garantiza que `/api/*` responda `cache-control: no-store`, elimina
toda cabecera que revele el navegador (`Origin`, `Referer`, `Sec-Fetch-*`,
`Cookie`), reconstruye `X-Forwarded-For` con la IP real del cliente y aplica
cabeceras de seguridad (CSP, HSTS, `nosniff`). El despliegue recomendado en
Cloudflare Pages y las variables requeridas están documentados en
[`proxy/README.md`](proxy/README.md). En pushes a `main`, CI publica la web si
están definidos los secretos `CLOUDFLARE_API_TOKEN` y
`CLOUDFLARE_ACCOUNT_ID`; sin ellos la validación sigue corriendo, pero el
despliegue se omite.

## Instalar y ejecutar

Instala las dependencias desde la raíz del repositorio:

```bash
npm install
npm start
```

Comandos por plataforma:

```bash
npm run android
npm run ios
npm run web:build
npm run web:serve
```

Para desarrollo con HMR puedes ejecutar `npm run web` y el gateway en otro
puerto, apuntando `EXPO_PUBLIC_API_BASE_URL` al gateway como se indicó arriba.
Para probar la exportación y la PWA instalada, usa `web:build` seguido de
`web:serve`. En navegador, la sesión se guarda en `sessionStorage`: sobrevive a
las recargas de la misma pestaña y se descarta al cerrarla (con un respaldo en
memoria si el navegador bloquea el almacenamiento). Con el gateway no hay
bloqueos de CORS: una petición a `/api/v1` responde `401` (sin sesión) en lugar
de `403`.

## Verificación

Ejecuta TypeScript, ESLint y las pruebas automatizadas desde la raíz del
repositorio:

```bash
npm run check
```

Para validar además el empaquetado de Android con Expo:

```bash
npx expo export --platform android
```

Las pruebas cubren lógica de fechas, rangos de disponibilidad, mensajes de
error, etiquetas de avisos, contraste y escala tipográfica. Estas comprobaciones
no sustituyen las
pruebas de la aplicación en un dispositivo: para verificar de principio a fin
el inicio de sesión, los cambios de cuenta, la carga de fotos, la reserva de
citas y los avisos, también se necesita un backend accesible con datos de
prueba adecuados y un dispositivo o simulador para comprobar el comportamiento
nativo del selector de imágenes.
