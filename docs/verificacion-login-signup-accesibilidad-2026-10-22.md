# Login y registro público: accesibilidad e integración local

Fecha: **22 de octubre de 2026**, America/Bogota.

**Resultado:** mejoras implementadas en el login compartido y en «Crear cuenta» de propietarios, conforme a la aclaración expresa de Esteban. Se utilizó WCAG 2.2 AA como referencia para los criterios aplicables. No se declara conformidad completa de la aplicación ni una auditoría formal.

## Alcance entregado

- Presentación común con texto de lectura de 18 px, formulario de ancho acotado, controles amplios y adaptación a pantallas estrechas.
- Encabezado, idioma español y títulos de página que distinguen login y registro.
- Etiquetas persistentes, campos obligatorios identificados, ayudas y errores asociados programáticamente con sus campos.
- Mostrar/ocultar contraseña con nombre y estado accesibles. Pegado permitido y autocompletado para usuario/contraseña actual, nombre, correo, nacimiento, teléfono y contraseña nueva.
- Teclado, Enter, foco visible en controles y foco al primer campo inválido o al mensaje general.
- Formulario conservado durante el envío, estado ocupado anunciado y protección inmediata contra envíos repetidos.
- Registro exitoso confirmado antes de ir al login; no inicia sesión automáticamente. Un resultado incierto bloquea otro alta y orienta a login/recuperación.

El registro sigue creando exclusivamente OWNER, con el mismo endpoint y datos del contrato. La confirmación de contraseña y el rol no se envían. No se transforman las contraseñas. Login conserva su validación de credenciales existentes, sin imponer el mínimo de 15 caracteres de creación. Los datos de registro se contrastaron con `UserSignupRequestDTO` y validadores del backend, incluido el calendario de Bogotá; el backend conserva la decisión sobre correo, metadatos de teléfono y contraseñas comunes.

No se cambiaron las otras vistas del propietario, recuperación, activación de personal, gestión administrativa, permisos, backend o contratos. El ajuste de títulos en `RootNavigator.tsx` se limita a Login/Register y conserva los títulos anteriores de las demás áreas.

## Implementación y decisiones

`AuthenticationFormComponents.tsx` reutiliza presentación, campos, controles y mensajes únicamente en estas dos pantallas; `authStyles.ts` y el kit global no se modificaron. `authenticationFocus.ts` concentra el foco diferido. Las reglas y traducciones de errores están en `loginForm.ts` y `registrationForm.ts`.

Se inspeccionó React Native Web 0.21.4 y se verificaron tres particularidades en navegador: Enter requería `blurOnSubmit=false` para conservar el foco; `birthdate-full` debía convertirse al token HTML `bday`; y un botón nativo deshabilitado perdía foco durante el envío. Por ello la versión web del botón mantiene el foco, anuncia `aria-disabled`/`aria-busy` y bloquea su manejador mientras espera. Las comprobaciones observaron que otro Enter no produjo otra solicitud. Las ramas nativas se conservan, pero no se probaron Android/iOS.

## Verificación ejecutada

| Comprobación | Resultado y límite |
| --- | --- |
| `npm run check` | TypeScript y ESLint correctos; **248 pruebas en 27 archivos**, incluidas las 192 anteriores y 56 nuevas de validación/errores de estos formularios. |
| `npm run web:build` | Correcta. Bundle final `index-da817e65d4a775fda7ed3c66539e37ff.js`. |
| Simulación Postman | **113 peticiones HTTP** del verificador contra el stand-in y OpenAPI 0.9.0. Es comprobación del entorno simulado, separada de las pruebas del proyecto y del navegador. |
| Navegador con aplicación real | Exportación Pages en 8085, gateway con binding explícito `UPSTREAM=http://127.0.0.1:4900`. No se enviaron registros ni credenciales de prueba a Cloud Run. |
| Teclado y errores | Login/registro vacíos, foco del primer error y relaciones `aria-describedby`; error de teléfono devuelto por el stand-in conserva los seis valores y enfoca teléfono. |
| Login demorado | Ocho segundos, formulario visible y campos de solo lectura. Enter conserva el foco del campo; clic conserva el foco del botón ocupado. Otro Enter no duplica la solicitud. Un 503 controlado devuelve foco al error general y conserva datos. |
| Contraseña | Mostrar/ocultar conserva el valor y cambia el estado accesible. Se comprobó login posterior al registro usando una frase con espacios exteriores sin transformarla. |
| Registro demorado y éxito | Se conservaron los seis campos mientras esperaba, sin doble POST. Después mostró éxito, retiró los campos de contraseña y permitió ir al login normal. |
| Resultado incierto | El mock aplicó el registro y cortó la respuesta; el gateway de simulación mostró 502. La pantalla bloqueó otro alta y ofreció login/recuperación. El login posterior encontró la cuenta creada. El 502 es del corte controlado, no una respuesta contractual atribuida al backend. |
| Regresión de acceso | La cuenta ficticia registrada entró como OWNER, sin mascotas; SUPER_ADMIN entró a Administradores. Las sesiones de prueba se cerraron. |
| Presentación y estructura | Login/registro a 320 px sin desbordamiento horizontal, y vista de computador a 1280 px. Formularios, idioma, encabezados, obligatoriedad, autocompletado y asociación de ayudas comprobados en DOM y árbol de accesibilidad. |
| Ejecución | No se observaron errores JavaScript en las consultas del registro de consola efectuadas durante el recorrido. |
| Entorno del usuario | `http://localhost:8788/` quedó activo con el nuevo login y el backend real como destino habitual. No se hicieron altas reales desde él. |

La auditoría saneada contiene **21 eventos HTTP completos: 15 de la aplicación y seis de fixtures**. El corte de respuesta de registro no produce un evento HTTP completo del mock y no se suma ficticiamente; se acredita mediante lo observado en la interfaz/gateway y el login posterior. Los casos HTTP de duplicado, límites y respuestas comunes están en las 113 comprobaciones del stand-in y las pruebas unitarias, sin presentarlos como recorridos nuevos de navegador.

Se cerraron las pestañas y sesiones ficticias y se detuvieron 8085/4900; se conservó el servidor 8788. Se restableció el ajuste temporal de viewport. No se hizo commit, push, clon, creación de repositorios, despliegue o cambio de Jira. El aviso anterior `MODULE_TYPELESS_PACKAGE_JSON` de ESLint sigue siendo no bloqueante.

## Criterios y límites

Se atendieron relaciones y propósito de campos (1.3.1/1.3.5), contraste (1.4.3/1.4.11), redistribución (1.4.10), teclado (2.1.1), títulos y foco (2.4.2/2.4.3/2.4.7), controles (2.5.8), etiquetas/errores/autenticación (3.3.1/3.3.2/3.3.3/3.3.8) y semántica/mensajes (4.1.2/4.1.3). No equivale a certificar todos sus criterios en todas las tecnologías de asistencia. [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [autenticación accesible](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html), [notificaciones de formularios](https://www.w3.org/WAI/tutorials/forms/notifications/).

Contrastes calculados sobre blanco: texto principal **18,88:1**, secundario **9,35:1**, botón verde/blanco **10,07:1**, borde de campos **5,06:1**, foco azul **5,98:1** y error **6,54:1**. Los controles principales tienen mínimo 52 px y el control de contraseña mínimo 48 px; son objetivos propios por encima del mínimo AA, no una atribución de 48 px a WCAG.

Pendientes de evaluación: lector de pantalla real (NVDA/VoiceOver), zoom real al 200 %, preferencias de espaciado de texto y evaluación con personas mayores. La comprobación de 320 px no se presenta como sustituto de todas ellas. Los atributos de autocompletado y ausencia de bloqueo de pegado no certifican cada gestor de contraseñas. No se validó la aplicación completa, recuperación, entrega de correo, backend real o PWA offline.

## Evidencias y siguiente configuración

Carpeta: `C:\Users\ASUS\Documents\ChatGPT\GrownupsVet\output\login-signup-accesibilidad-2026-10-22`.

- `login-computador.png`, `login-movil-320.png`, `registro-computador.png` y `registro-exitoso-320.png`.
- `http-verification.json`: las 113 comprobaciones del sustituto.
- `browser-http-audit.json`: fechas, métodos, rutas y estados de los 21 eventos; sin cuerpos, cabeceras, tokens o contraseñas.
- `accessibility-evidence.json`: alcance, contrastes y límites, sin datos personales.

Este trabajo aporta a SCRUM-24/25/26/75 sin modificar estados ni declarar sus criterios completos. La continuidad de configuración ahora contempla la cuenta propia de Cloudflare de Esteban, conforme al cambio de dirección solicitado; la instrucción anterior de esperar la cuenta del compañero ya no es la opción propuesta. [Preparación de máquina y cuenta propia](preparacion-cloudflare-cuenta-propia-2026-10-22.md).
