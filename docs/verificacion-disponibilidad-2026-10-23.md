# Disponibilidad administrativa individual: implementación y verificación

Fecha: **23 de octubre de 2026**, America/Bogota.

**Resultado:** implementada y verificada localmente la gestión individual de turnos del veterinario desde el portal administrativo. Un administrador puede consultar la agenda, publicar un turno, cambiar su hora, bloquearlo, volverlo a publicar y consultar su historial. Pasaron `npm run check` —TypeScript, ESLint y **390 pruebas en 35 archivos**— y la exportación web. El recorrido de navegador se comprobó contra una simulación del contrato **OpenAPI 0.9.0**; la aceptación integrada con el servicio real y el cierre de Jira continúan pendientes.

## Base y selección desde Jira

Clon activo: `C:\Users\ASUS\Documents\ChatGPT\grownupsvet-frontend`, rama `codex/fix-web-cloudflare`, commit base **`a028b06c0a744483646768fa0da7e629d3074fd2`**. Las comprobaciones incluyen el árbol local con los cambios anteriores preservados; no equivalen a probar únicamente ese commit. El [inventario inicial](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/frontend-estado-inicial.txt) identifica la base de trabajo.

La consulta actual de Jira identificó [SCRUM-37](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-37), Por iniciar, como continuidad habilitada: el padre [SCRUM-11](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-11) y la validación [SCRUM-38](https://uqvirtual-team-yavszk8l.atlassian.net/browse/SCRUM-38) están En curso; backend y contrato 36/78 figuran Finalizado. La historia exige publicar para profesionales habilitados, evitar conflictos, respetar reservas al editar o bloquear y representar horarios en America/Bogota. La validación mantiene pendientes interfaz, teclado, foco y aceptación integrada. [Selección y criterios saneados](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/jira-seleccion.json).

Este bloque comprende **turnos individuales**. La generación por lotes existe en el backend y queda fuera del frontend entregado; no se cierra toda la historia por este subconjunto. No se amplía a gestión administrativa de citas ni clínica.

## Comportamiento entregado

El acceso es Administrador → Veterinarios → detalle del profesional → **Gestionar disponibilidad**. Requiere `VETERINARIAN_AVAILABILITY_MANAGE`, además del acceso administrativo existente. SUPER_ADMIN, OWNER y VETERINARIAN no reciben esta gestión por herencia; el backend conserva la autorización definitiva.

- Agenda por día de Bogotá, filtros Todos/Publicado/Bloqueado, navegación entre fechas y páginas, estados de carga, vacío y error.
- Publicación con fecha y hora local explícitas, cuadrícula de 30 minutos y confirmación previa. Administración puede publicar un turno futuro del día actual; la ventana desde mañana hasta 60 días corresponde al propietario.
- Detalle actualizado antes de operar, cambio de hora y bloqueo/republicación con versión observada y motivo obligatorio de hasta 500 caracteres. Un cambio de hora idéntico se rechaza localmente para no presentar una operación vacía como cambio efectivo.
- Historial paginado con versión, actor, fecha, horarios/estados y motivo. Los eventos de creación conservan los campos anteriores presentes con `null`.
- Explicaciones específicas para versión desactualizada, profesional inactivo, turno iniciado, colisión, cita ocupando el turno o referencia histórica. La interfaz no deduce que un turno publicado esté libre: el DTO administrativo no informa ocupación.
- Una sola escritura pendiente y aislamiento de continuaciones por sesión. Un resultado incierto bloquea otro envío y exige consultar de nuevo; no repite automáticamente la operación.

Las rutas, permisos y DTO se contrastaron con el código Java y el OpenAPI del backend. La [implementación técnica](implementacion-disponibilidad-2026-10-23.md) detalla las seis operaciones individuales y sus reglas. Se conserva la separación entre el DTO administrativo y las opciones disponibles del propietario. No se añadieron endpoints, migraciones o cambios de backend para esta interfaz. El [snapshot público consultado](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/openapi-live.json) declara versión 0.9.0.

## Comprobaciones ejecutadas

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run check` | **390 pruebas en 35 archivos**, TypeScript y ESLint correctos, salida 0. Es el total del proyecto e incluye las pruebas anteriores. [Registro](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/check.log). |
| `npm run web:build` | Salida 0. Bundle **`index-9928c963a4ddd234310124749a54bf54.js`**. [Registro](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/web-build.log). |
| HTTP contra el sustituto | **243 peticiones verificadas**, **205** con respuesta y estado validados contra OpenAPI 0.9.0; **64** rutas de disponibilidad dentro del total. Incluye regresión de acceso, personal, activación y recuperación, además de fixtures y cortes identificados. [Informe saneado](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/http-verification.json). |
| Revisión independiente | Se revisaron tipos, fechas, permisos, identidad de respuestas, paginación, sesiones y resultados inciertos. Se corrigió la reconciliación del alta para volver al día enviado, página cero y Todos, aunque antes se filtrara por bloqueados. |

El aviso previo `MODULE_TYPELESS_PACKAGE_JSON` de ESLint no impidió las comprobaciones. Las peticiones HTTP del sustituto se mantienen separadas de las pruebas automatizadas del proyecto y de los recorridos de navegador.

La verificación HTTP cubre publicación futura, incluido el día actual cuando queda un turno en la cuadrícula; rangos de 31/32 fechas; páginas y estados; motivos de 500/501 caracteres; colisión por instantes equivalentes con distinto offset y contra turnos bloqueados; versiones y operaciones sin cambios; eventos; turno pasado, ocupado, con historia o profesional inactivo; lectura propia, denegación de otros roles y sesión revocada. Un alta aplicada con respuesta perdida se reconcilia mediante consulta, conservando un único turno.

## Recorrido observado en navegador

Se utilizó la exportación real del frontend servida localmente en **8085**, con el gateway dirigido a la simulación **4900**. Todas las identidades y reservas de prueba son ficticias.

| Caso observado | Resultado |
| --- | --- |
| Entrada y alta | Administrador abrió el detalle del veterinario, entró a la agenda y publicó un turno para el **24/10/2026 a las 11:00**, hora de Bogotá. |
| Teclado y confirmaciones | Enter abrió la confirmación; el foco inicial quedó en Cancelar. Escape cerró el diálogo y devolvió el foco al origen. Tab permitió llegar a confirmar. |
| Estados y cambio de hora | Bloqueo llevó a versión 1; republicación a versión 2; cambio a **11:30** a versión 3, conservando el turno. Se observaron cuatro eventos: creación, bloqueo, publicación y cambio de hora. [Detalle e historial](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/turno-historial.png). |
| Hora sin cambios | La interfaz rechazó el intento sin enviarlo como una modificación efectiva. |
| Reserva protegida | Bloquear un turno ocupado devolvió **409**, mostró la restricción y conservó el turno y su estado. [Captura](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/reserva-protegida.png). |
| Alta de resultado incierto | El sustituto creó el turno de **12:00** y cortó la respuesta; el proxy produjo 502. La pantalla bloqueó otro POST. «Consultar agenda antes de continuar» regresó a Todos y encontró el turno, aunque antes se filtrara por Bloqueado, sin repetir el alta. [Agenda reconciliada](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/agenda-reconciliada.png). |
| Presentación móvil | A **390 × 844**, el ancho desplazable fue 390 px y no se observó desbordamiento horizontal. [Captura móvil](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/agenda-movil.png). |
| Consola y salida | Las consultas de advertencias/errores de consola devolvieron listas vacías durante el recorrido. Se comprobó el cierre de sesión al terminar. |

La [auditoría saneada del navegador](C:/Users/ASUS/Documents/ChatGPT/GrownupsVet/output/frontend-disponibilidad-2026-10-23/browser-request-audit.json) contiene **28 eventos HTTP completos: 27 de rutas API y uno de fixture**, posteriores al corte del verificador. Conserva únicamente fecha UTC, método, ruta y estado. No contiene cuerpos, cabeceras, credenciales ni tokens. El corte de respuesta del alta no produce un evento completo del mock y no se suma a esa cifra; lo respaldan lo observado en pantalla/gateway y la consulta posterior que encontró el turno.

El 502 corresponde al corte controlado después de una escritura: no se atribuye como respuesta contractual del backend. Las fixtures de ocupación e historia pertenecen únicamente al sustituto, están documentadas en la [guía Postman](../postman/README.md) y no se incorporan al DTO del producto.

## Límites y continuidad

Este resultado acredita implementación y comprobación local con un contrato reproducido. No acredita PostgreSQL ni sus bloqueos/transacciones, firma JWT de producción, ocupación real, integración aceptada del servicio desplegado, envío de correo o aceptación del equipo. El sustituto recibe JSON interpretado y no demuestra la distinción léxica del parser real entre `1`, `1.0` y `1e0`.

Permanecen pendientes generación por lotes, aceptación integrada con cuentas y datos autorizados, revisión compartida de Jira y evaluación integral de accesibilidad. Las observaciones de teclado, foco y ancho móvil no constituyen conformidad formal ni sustituyen lector de pantalla, ampliación y evaluación con personas usuarias. No se certifican builds Android/iOS ni uso sin conexión.

Este bloque aporta a **SCRUM-37/38**, a la historia **SCRUM-11** y a la revisión **SCRUM-80**, sin cambiar sus estados ni declarar completos los criterios diferidos. La publicación y el recorrido real requieren comprobaciones propias; este informe local no los presupone.
