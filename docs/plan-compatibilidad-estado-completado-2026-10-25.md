# Compatibilidad del frontend con citas completadas

25 de octubre de 2026, America/Bogota. Plan escrito antes de modificar código. Alcance: reconocer el nuevo estado y evento `COMPLETED` del backend P3 en los recorridos existentes; no construir pantallas clínicas ni añadir acciones de finalización.

## Punto de partida y preservación

- Repositorio de trabajo: `C:/Users/ASUS/Documents/ChatGPT/grownupsvet-frontend`; HEAD inicial `53f2ec6`.
- Única modificación anterior: `docs/pendientes-proyecto.md`. Debe conservarse sin editar, con SHA256 `2977737C60F3445DEEC80E421F35745838564B562B545439C2A3C957F33F34AC`.
- Crear rama `codex/p3-appointment-status-compatibility-2026-10-25` desde el estado actual sin descartar ni incluir en un commit el pendiente anterior.
- Se leyó `AGENTS.md` y la [documentación exacta Expo SDK57](https://docs.expo.dev/versions/v57.0.0/) antes de escribir código. El proyecto conserva Expo57, React19.2.3 y React Native0.86; no necesita dependencias ni cambios de configuración para ampliar estos valores del contrato.

## Implementación prevista

1. Añadir `COMPLETED` a los tipos de estado/evento y a las listas permitidas de respuestas del cliente administrativo. Conservar validación estricta del resto de campos y rechazo de valores desconocidos.
2. Mostrar «Completada» en propietario, administración y veterinario mediante los mapas de etiquetas existentes. Añadir el badge correspondiente del propietario y la etiqueta del evento en el historial administrativo. Incorporar el estado al filtro de consulta administrativo.
3. Mantener la lista de decisiones administrativas limitada a confirmar, rechazar, cancelar e inasistencia. `COMPLETED` es un estado terminal recibido; no se ofrece como transición, cancelación, reprogramación, reasignación o reapertura. No se llaman rutas clínicas nuevas.
4. Añadir casos de lectura de detalle/página/historial completados, filtro y rechazo de `COMPLETED` en la mutación administrativa antes de HTTP. Ampliar casos de elegibilidad terminal y comprobar etiquetas compartidas y del propietario.
5. Ejecutar las pruebas focalizadas del cliente/presentación, typecheck, lint de archivos afectados y empaquetado web si los controles previos pasan. Repetir pruebas solo ante cambios o fallos pertinentes.
6. Verificar el SHA256 del pendiente anterior al terminar y revisar el diff. No realizar commit, push ni publicación de Cloudflare en este incremento.

## Criterios de aceptación

Una cita/evento `COMPLETED` se puede consultar y mostrar en las pantallas existentes sin error de contrato. Las acciones administrativas permanecen bloqueadas para ese estado y no pueden enviarlo al backend. Estados desconocidos siguen rechazándose en los parsers existentes. Compilación y pruebas relevantes correctas; pendiente anterior byte a byte intacto.

## Resultado

Implementado en la rama prevista: tipos y parsers de lectura, filtro administrativo, etiquetas compartidas de administración/veterinario, etiqueta y badge de propietario y evento del historial. Las listas de decisiones y transiciones administrativas permanecen limitadas a sus cuatro opciones anteriores.

Validación local:

- `npm test --` con los siete archivos de cliente/presentación afectados: **203 pruebas aprobadas**, sin fallos.
- `npm run typecheck`: correcto en el repositorio completo.
- ESLint de los trece archivos TypeScript/TSX afectados: correcto.
- `npm run web:build`: exportación Expo correcta, 669 módulos y bundle `index-71b8c4e7eaf6bd16c8e4f96da5e54642.js`. Artefacto local en `dist/`, sin publicación.
- `git diff --check`: correcto. Sin cambios de dependencias ni lockfile.
- SHA256 final de `docs/pendientes-proyecto.md`: `2977737C60F3445DEEC80E421F35745838564B562B545439C2A3C957F33F34AC`, idéntico al inicial. Su modificación anterior sigue sin staging.

No se realizó commit, push, publicación de Cloudflare ni construcción de pantallas P3. Los casos de contrato usan datos ficticios; la aceptación con citas completadas reales requiere la revisión backend compatible desplegada.
