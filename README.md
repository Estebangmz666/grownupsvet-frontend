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
  `expo-secure-store`.
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
contraseña, mascotas, citas, horarios disponibles y perfiles de propietarios.
Admite solicitudes autenticadas, cargas de fotos multipart y respuestas sin
procesar para datos binarios protegidos. El contrato del backend está
documentado en el
[repositorio OpenAPI de grownupsvet-backend](https://github.com/Estebangmz666/grownupsvet-backend).

### `packages/accessibility-kit`

Proporciona tokens de diseño compartidos, los componentes `ConfirmDialog`,
`LoadingState`, `EmptyState` y `ErrorState`, además de `useReadAloud()` y otras
utilidades de accesibilidad.

## Configurar la API

De forma predeterminada, la aplicación usa:

```text
http://localhost:8080/api/v1
```

Configura `EXPO_PUBLIC_API_BASE_URL` para cambiar esta dirección. En un emulador
de Android, usa `http://10.0.2.2:8080/api/v1` si el backend se ejecuta en la
máquina anfitriona. En un dispositivo físico, usa la dirección LAN de esa
máquina. Para probar contra el backend desplegado en Cloud Run, puedes usar
`https://grownupsvet-backend-w5glrcsyda-uc.a.run.app/api/v1`. No incluyas en
commits archivos de entorno locales con configuraciones específicas de la
máquina.

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
npm run web
```

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
error, contraste y escala tipográfica. Estas comprobaciones no sustituyen las
pruebas de la aplicación en un dispositivo: para verificar de principio a fin
el inicio de sesión, los cambios de cuenta, la carga de fotos y la reserva de
citas, también se necesita un backend accesible con datos de prueba adecuados y
un dispositivo o simulador para comprobar el comportamiento nativo del selector
de imágenes.
