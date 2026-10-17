# Inconsistencias detectadas y plan de corrección

Documento de diseño. Recoge las inconsistencias encontradas al revisar el
frontend y su integración con el backend `grownupsvet-backend` (contrato 0.9.0),
con la evidencia de cada hallazgo y una corrección propuesta. No describe código
ya aplicado salvo cuando se indica "resuelto".

Corte: **16 de octubre de 2026**, rama `feature/propietario`, commit
`738207d0812b9717e48236e74d3b0206cde5af0b`.

---

## Resumen por prioridad

| # | Inconsistencia | Tipo | Prioridad | Estado |
|---|---|---|---|---|
| 1 | CORS deshabilitado en el backend desplegado | Integración | **Alta** | Abierta |
| 2 | Revisión del backend apunta a una rama obsoleta | Coordinación | **Alta** | Abierta |
| 3 | `configureApiClient` se ejecuta durante el render | Código | Media | **Resuelto** |
| 4 | Lockfiles múltiples (`bun.lock` + `package-lock.json`) | Configuración | Media | **Resuelto** |
| 5 | `unstable_enableSymlinks` en `metro.config.js` | Configuración | Media | **Resuelto** |
| 6 | Recuperación de contraseña deshabilitada en el entorno | Integración | Media | Abierta |
| 7 | Base de datos gratuita de Render con vencimiento | Operación | Media | Abierta |
| 8 | Sesión web solo en memoria | Código | Baja | **Resuelto** |
| 9 | Scripts npm duplicados | Configuración | Baja | **Resuelto** |
| 10 | Código muerto: `AppView` en `api-client` | Código | Baja | **Resuelto** |
| 11 | `docs/ESTADO-IMPLEMENTACION.md` referencia documentos inexistentes | Documentación | Baja | **Resuelto** |
| 12 | Aviso de favicon en web | Configuración | Baja | **Resuelto** |
| 13 | Endpoint de avisos no consumido por el frontend | Integración | Baja | **Resuelto** |
| 14 | `AppointmentNotification` sin `errorCode` | Contrato | Baja | **Resuelto** |

Las correcciones de bajo riesgo (#4, #5, #9, #10, #11) y las de código #3 y #8
se aplicaron. Verificación: `npm run check` (**24 pruebas en 8 archivos**),
`npx expo-doctor` (**21/21 checks, sin problemas**, antes 19/21) y los exports
`expo export --platform android|web`, que confirman que los workspaces siguen
resolviendo sin el override de symlinks.

Además, el contrato se validó **contra el backend desplegado en Cloud Run**
(ver "Validación contra el backend desplegado" más abajo), lo que detectó y
cerró la inconsistencia #14.

---

## Bloqueantes de integración

### 1. CORS deshabilitado en el backend desplegado

**Hallazgo.** El backend solo habilita orígenes declarados exactos en
`CORS_ALLOWED_ORIGINS` (sin comodines). El entorno Cloud Run no tiene orígenes
externos configurados. La app nativa no se ve afectada (React Native no aplica
CORS), pero la versión web sí.

**Evidencia.**

```text
POST/OPTIONS https://grownupsvet-backend-w5glrcsyda-uc.a.run.app/api/v1/pets
Origin: http://localhost:8081
→ HTTP/2 403   "Invalid CORS request"
```

**Impacto.** `npm run web` no puede autenticarse ni consultar datos contra el
backend desplegado ni contra uno local sin CORS. Bloquea cualquier demostración
en navegador.

**Corrección propuesta.**
1. Definir los orígenes exactos necesarios: `http://localhost:8081` para
   desarrollo local y, si se publica, la URL exacta del bundle web.
2. Solicitar a Esteban que los agregue a `CORS_ALLOWED_ORIGINS` en Cloud Run
   (no hay forma de cambiarlo desde el cliente).
3. Alternativa sin depender del entorno desplegado: ejecutar el backend local
   con `CORS_ALLOWED_ORIGINS=http://localhost:8081` (requiere JDK 25 y
   PostgreSQL 18, ausentes en esta máquina).
4. Añadir la lista de orígenes a la documentación de configuración para que no
   se redescubra en cada intento.

**Verificación.** El preflight debe responder `200/204` con
`Access-Control-Allow-Origin: http://localhost:8081` y el login debe completarse
desde el navegador.

### 2. La revisión del backend apunta a una rama obsoleta

**Hallazgo.** `docs/revision-frontend-candidato-2026-10-10.md` del backend
evaluó la rama `master` en el commit `58de109`, donde `packages/api-client`
tenía 0 bytes, `packages/accesibility-kit` no era JSON válido y las pantallas
estaban vacías. El trabajo real vive en `feature/propietario`, muy por delante
de ese corte. Esteban además dejó constancia de que no pudo confirmar el
repositorio del equipo.

**Impacto.** La evidencia de integración del backend no corresponde al estado
real; puede inducir a conclusiones equivocadas sobre el avance y a cerrar (o no
cerrar) tareas con datos falsos.

**Corrección propuesta.**
1. Enviar a Esteban el repositorio, la rama (`feature/propietario`) y el commit
   exacto (`738207d`).
2. Pedirle que repita la revisión contra el contrato 0.9.0.
3. Confirmar por escrito cuál es el repositorio y la rama oficiales del equipo.
4. (Opcional) Abrir un Pull Request de `feature/propietario` hacia `master`
   para dar un punto de referencia estable y revisable.

**Verificación.** El backend emite una nueva revisión fechada apuntando al
commit de `feature/propietario`.

### 6. Recuperación de contraseña deshabilitada en el entorno

**Hallazgo.** El frontend implementa el flujo completo en tres pasos
(solicitud, verificación, restablecimiento), pero el backend arranca con
`PASSWORD_RECOVERY_ENABLED=false` por defecto.

**Impacto.** El flujo no se puede demostrar contra el entorno desplegado aunque
el cliente esté listo; en una demostración parecería un fallo del frontend.

**Corrección propuesta.**
1. Confirmar con Esteban si el entorno desplegado tiene la recuperación
   habilitada.
2. Si no, habilitarla con sus secretos requeridos
   (`PASSWORD_RECOVERY_HMAC_SECRET`, claves de cifrado de correo y canal SMTP),
   o documentar explícitamente que solo se valida en local.
3. Cualquiera sea el caso, dejar registrado el estado junto a los datos de
   demostración.

---

## Configuración del proyecto

### 4. Lockfiles múltiples

**Hallazgo.** `expo-doctor` lo confirma:

```text
✖ Check for lock file
Multiple lock files detected (package-lock.json, bun.lock).
```

El proyecto y todos sus scripts usan **npm**; `bun.lock` y `bunfig.toml` son
residuales. En CI/EAS, la elección del gestor se infiere del lockfile y puede
elegir Bun por error (ya ocurrió una vez: un PR anterior tuvo que forzar
`--npm`).

**Corrección propuesta.**
1. Eliminar `bun.lock` y `bunfig.toml`.
2. Documentar `npm` como único gestor.
3. Regenerar `package-lock.json` en un entorno limpio y verificar `npm ci`.

**Verificación.** `npx expo-doctor` deja de reportar el check de lockfile.

### 5. `unstable_enableSymlinks` en `metro.config.js`

**Hallazgo.** `expo-doctor` lo confirma:

```text
✖ Check for issues with Metro config
"resolver.unstable_enableSymlinks" mismatch. Expected undefined, got: true
```

**Corrección propuesta.**
1. Evaluar si el override sigue siendo necesario. En versiones recientes de
   Metro los symlinks de workspaces se resuelven sin esa bandera.
2. Quitarlo y verificar que `apps/*` y `packages/*` siguen resolviéndose
   (`npm run check` + `expo export`).
3. Si aún se requiere, fijarlo a un valor soportado y documentar el motivo.

**Verificación.** `expo-doctor` sin el check fallido y los exports de Android y
web correctos.

### 9. Scripts npm duplicados

**Hallazgo.** `package.json` define `android`/`ios`/`web` y además
`expo:android`/`expo:ios`/`expo:web` con comandos idénticos.

**Corrección propuesta.** Conservar un solo conjunto (los nombres cortos, que
son los que documenta el README) y eliminar los `expo:*`.

### 12. Aviso de favicon en web (resuelto)

**Hallazgo.** `app.json` apuntaba `web.favicon` a `./assets/favicon.png`, que no
existía; el export web emitía un aviso.

**Corrección aplicada.** Se creó `assets/favicon.png` (48×48). El export web ya
no emite el aviso y genera `favicon.ico`.

### 3. `configureApiClient` durante el render

**Hallazgo.** En `apps/propietario/src/auth/AuthContext.tsx`, `AuthProvider`
llama a `configureApiClient({...})` en el cuerpo del componente, es decir en
cada render, mutando un singleton global. Es un efecto secundario fuera de
`useEffect` y puede provocar condiciones de carrera (p. ej. dos renders solapados
o el doble render de StrictMode).

**Corrección aplicada.** La configuración se movió a un `useEffect` que depende
de `handleUnauthorized` (estable), declarado antes del efecto que ejecuta
`checkSession` para que el cliente ya esté listo. Así no se muta el singleton
durante el render ni dos veces bajo StrictMode.

**Riesgo evitable.** Comportamiento no determinista en el manejo de 401 y en el
cierre de sesión bajo renders concurrentes.

---

## Operación y documentación

### 7. Base de datos gratuita de Render con vencimiento

**Hallazgo.** El README del backend indica que la base gratuita de Render vence
el **14 de noviembre de 2026**, sin backups configurados.

**Impacto.** Si la demostración depende del entorno desplegado, hay una ventana
de ~4 semanas antes de perder los datos.

**Corrección propuesta.**
1. Exportar los datos y verificar una restauración antes del vencimiento.
2. Definir plan alternativo: base con retención o entorno local reproducible.
3. Registrar la fecha límite en la planificación del equipo.

### 8. Sesión web solo en memoria

**Hallazgo.** `apps/propietario/src/auth/session.web.ts` guardaba el token en una
variable de módulo. La sesión se perdía al recargar el navegador.

**Análisis.** En web, `expo-secure-store` no está soportado (confirmado con la
documentación de Expo SDK 57: plataformas `android`, `ios`, `tvos`, `expo-go`).
No existe almacenamiento seguro equivalente en el navegador; las alternativas
son `localStorage`, `sessionStorage` o memoria.

**Corrección aplicada.** Se usa **`sessionStorage`**: la sesión sobrevive a las
recargas de la misma pestaña y se descarta al cerrarla, lo que limita la
exposición del token sin cifrar (a diferencia de `localStorage`, que lo
persistiría indefinidamente). Si el navegador bloquea el almacenamiento, el token
recae en una variable de módulo y solo dura la página actual. El riesgo de XSS
—cualquier script de la página puede leer el token— queda documentado en el
propio módulo y en el README. Se añadieron 5 pruebas en
`session.web.test.ts`.

### 10. Código muerto: `AppView`

**Hallazgo.** `packages/api-client/src/types.ts` exporta `AppView`, un tipo de
navegación del prototipo web descartado. No se usa en ningún otro archivo.

**Corrección propuesta.** Eliminarlo del cliente API (no es parte del contrato).

### 11. Documento de estado desactualizado

**Hallazgo.** `docs/ESTADO-IMPLEMENTACION.md` está retirado y remite a
`PLAN-DESARROLLO.md` y `ACCESSIBILITY.md`, que no existen en el repositorio.

**Corrección propuesta.** Eliminar el stub o reemplazarlo por un estado real, y
quitar las referencias a documentos inexistentes.

### 13. Endpoint de avisos no consumido (resuelto)

**Hallazgo.** El backend expone `GET /api/v1/appointments/{id}/notifications`,
pero el frontend no lo usaba.

**Corrección aplicada.** Se añadió `listAppointmentNotifications` /
`listAllAppointmentNotifications` al cliente y una pantalla de avisos accesible
desde el detalle de la cita, con etiquetas, estilos y pruebas.

### 14. `AppointmentNotification` sin `errorCode`

**Hallazgo.** Al validar el contrato contra el backend desplegado
(`AppointmentNotificationResponseDTO`, 0.9.0), el DTO trae un campo obligatorio
`errorCode` (string libre, hasta 64 caracteres) que el tipo del frontend no
modelaba. El resto de los 10 campos coincidía.

**Impacto.** Los avisos en estado `FAILED` no mostraban ningún motivo del fallo,
único diagnóstico disponible cuando un correo no se envía.

**Corrección aplicada.** Se añadió `errorCode: string | null` al tipo, el helper
`getNotificationErrorDetail` (solo lo expone para `FAILED` y descarta cadenas
vacías), su aparición como fila "Detalle" en la tarjeta y su inclusión en el
texto de lectura en voz alta, más una prueba.

---

## Validación contra el backend desplegado

Con la URL que compartió Esteban
(`https://grownupsvet-backend-w5glrcsyda-uc.a.run.app/api/v1`) se contrastó el
contrato real, que está expuesto públicamente en `/v3/api-docs`:

- **Versión desplegada: 0.9.0**, igual a la que asume el frontend.
- **Las 22 rutas que usa el frontend existen** en el despliegue. La única
  discrepancia inicial fue mi prueba manual contra `/auth/login`, una ruta que no
  existe: el login real es `POST /auth/sessions` (el frontend ya lo usa bien).
- **DTO cotejados campo por campo** contra el despliegue: `UserProfile`, `Pet`,
  `Appointment`, `AppointmentEvent`, `AvailabilitySlot`, `LoginResponse` y
  `AuthenticatedUser` coinciden exactamente. `AppointmentNotification` era el
  único con un campo faltante (#14, ya corregido).
- **Enums cotejados:** `AppointmentStatus`, `NotificationType` (7 valores,
  incluidos `ADMIN_REASSIGNMENT` y `OWNER_REASSIGNED`), `NotificationStatus`,
  `UserRole`, `Species`, `Sex` coinciden.
- `POST /auth/account-activations` es para **activación de personal** por
  invitación; los propietarios no lo requieren, por lo que el frontend hace bien
  en no usarlo.

**Estado de CORS (no resuelto).** El despliegue sigue respondiendo
`403 Invalid CORS request` a los preflight y a las peticiones con `Origin` de
navegador para `http://localhost:8081` y `http://localhost:8080`. Compartir la URL
no habilita la web: **el CORS depende de `CORS_ALLOWED_ORIGINS` en Cloud Run y de
Esteban** (#1). La app nativa (Android/iOS) no se ve afectada porque el CORS es
una restricción exclusiva del navegador.

---

## Orden de ejecución sugerido

1. **[Hecho] Higiene del proyecto (bajo riesgo):** lockfiles (#4), Metro config
   (#5), scripts (#9), `AppView` (#10), documento de estado (#11) y favicon
   (#12). Verificado con `npm run check`, `npx expo-doctor` (21/21) y los
   exports de Android y web.
2. **[Hecho] Código:** `configureApiClient` movido a `useEffect` (#3) y sesión
   web persistida en `sessionStorage` (#8). Verificado con `npm run check`
   (24 pruebas en 8 archivos).
3. **Semana 1 — desbloquear integración:** CORS (#1) y confirmación de
   recuperación (#6), coordinados con Esteban; enviar rama y commit correctos
   (#2).
4. **Semana 2 — operación:** respaldo de la base Render antes del vencimiento
   (#7).

## Límites de este documento

Las inconsistencias #1, #2 y #6 dependen de terceros (Esteban / entorno
desplegado) y no se pueden cerrar solo con cambios en el frontend. Las
verificaciones de #3, #4, #5, #8, #9, #10, #11 y #12 se realizan con `npm run check`,
`npx expo-doctor` y los exports de Expo; no acreditan pruebas en dispositivo.
