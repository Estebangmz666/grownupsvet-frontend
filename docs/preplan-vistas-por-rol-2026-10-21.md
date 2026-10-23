# Plan del plan: vistas por rol

Fecha: 21 de octubre de 2026, America/Bogota.

## Propósito y límite

Preparar el esquema para elaborar después el plan de implementación de las vistas por rol. Este documento define qué revisar, qué decidir y qué debe producir ese plan. No autoriza ni ejecuta implementación, pruebas, cambios en el backend, publicación o movimientos en Jira.

Se mantiene la dirección acordada: una entrada, un login y una aplicación web con un área de propietarios y otra de personal. Dentro del área de personal, las vistas corresponden al rol y a los permisos recibidos del backend.

## Base comprobada en el código y contrato actuales

Se consultó el [OpenAPI público del backend](https://grownupsvet-backend-w5glrcsyda-uc.a.run.app/v3/api-docs) en esta revisión: versión funcional `0.9.0`. Sus esquemas confirman los campos y roles siguientes. La consulta fue de lectura, sin iniciar sesiones ni ejecutar pruebas.

- El login devuelve `accessToken`, `tokenType`, `expiresIn` y `user`.
- `user` contiene `id`, `email`, `role` y `permissions`.
- Los roles existentes son `OWNER`, `VETERINARIAN`, `ADMINISTRATOR` y `SUPER_ADMIN`.
- Los permisos son independientes: el superadministrador no hereda las funciones de los demás roles.
- El frontend conserva el usuario recibido al iniciar sesión, pero actualmente dirige toda sesión iniciada a las pestañas del propietario.
- La restauración actual consulta `/api/v1/users/me`. Ese recurso es el perfil de propietario y no permite validar universalmente las sesiones del personal.
- El backend conserva el control de autorización. Elegir una vista u ocultar una opción en el frontend no concede permisos.

Fuentes locales: `UserLoginResponseDTO`, `AuthenticatedUserResponseDTO`, `UserPermissionResolver` y `OwnerProfileController` en el backend; `packages/api-client/src/auth.api.ts`, `packages/api-client/src/types.ts`, `apps/propietario/src/auth/AuthContext.tsx` y `apps/propietario/src/navigation/RootNavigator.tsx` en este repositorio.

## Etapas para elaborar el plan definitivo

### 1. Fijar la respuesta del backend que usaremos

**Trabajo de planificación:** contrastar los datos del login y los permisos actuales con el contrato publicado. Diferenciar lo disponible de lo pendiente de P3.

**Resultado:** una ficha breve del contrato de sesión y una matriz inicial de rol, permisos y capacidades existentes. No se inventarán endpoints, permisos ni funciones para completar espacios vacíos.

### 2. Acordar qué verá cada rol

**Trabajo de planificación:** identificar el destino después del login, las opciones que corresponden a cada rol y las pantallas existentes que se pueden reutilizar.

**Resultado:** un mapa propuesto de navegación y un alcance explícito del primer incremento. La consulta de administradores para el superadmin es una candidata por estar respaldada por el backend; su inclusión se fijará en el plan definitivo. No se supondrá que todo el portal administrativo entra en ese primer bloque.

### 3. Resolver el ciclo de la sesión

**Trabajo de planificación:** definir el comportamiento al iniciar sesión, recargar, volver a una página interna, cerrar sesión o recibir una respuesta de sesión inválida. Revisar cómo conservar y restaurar identidad, rol y permisos sin consultar un perfil de propietario para el personal.

**Resultado:** decisiones documentadas sobre restauración y navegación. El plan distinguirá sesión inválida o vencida, falta de permiso y error de conexión. También establecerá un comportamiento seguro ante un rol desconocido, datos incompletos o permisos ausentes. No asumirá la existencia de un endpoint de sesión o de refresh tokens.

### 4. Delimitar las vistas y sus estados

**Trabajo de planificación:** separar lo compartido —sesión, navegación y cierre— de las funciones de cada rol. Identificar las pantallas mínimas y sus estados de carga, sin resultados, error y acceso denegado, incluidos los accesos directos por URL cuando existan.

**Resultado:** un inventario pequeño de vistas y criterios de interacción. Se mantendrá una base de accesibilidad en ambas áreas y se atenderán las necesidades específicas de los propietarios. El diseño visual detallado y los componentes concretos se decidirán después de fijar ese alcance.

### 5. Redactar el plan de implementación

**Trabajo de planificación:** convertir los resultados anteriores en bloques coherentes, señalar sus dependencias y proponer cómo demostrar su funcionamiento con respuestas reales del backend.

**Resultado:** un plan revisable con objetivo, alcance, cambios previstos, contratos existentes utilizados, verificaciones futuras, preguntas indispensables y condiciones de cierre. La separación de vistas por rol y el desarrollo completo de cada módulo quedarán diferenciados.

## Condiciones para considerar listo el plan definitivo

- Se conoce qué parte de la respuesta del backend gobierna el destino inicial y qué permisos gobiernan las acciones visibles.
- Cada rol tiene un destino definido; el superadmin no termina en las pantallas de mascotas del propietario.
- La recarga y el cierre de sesión están resueltos para los cuatro roles.
- Se distingue una operación prohibida de una sesión inválida.
- Se sabe qué pantallas se reutilizan, cuáles se proponen y cuáles quedan pendientes.
- El primer incremento tiene un resultado observable y acotado, respaldado por contratos existentes.
- Los cambios locales previos de la corrección web se preservan y se identifican por separado.
- Las decisiones todavía abiertas están marcadas como pendientes, sin convertir propuestas en acuerdos.

La publicación en Cloudflare continúa pendiente de acceso a la cuenta del compañero, por elección de Esteban. Ese pendiente se registrará aparte y no se tratará como requisito para redactar el plan o verificar después una implementación local.

## Condición de parada

Esta entrega termina en este esquema. El siguiente trabajo es elaborar el plan definitivo; implementar sus cambios requerirá una instrucción posterior y explícita de Esteban. No se asignan fechas, responsables nuevos ni cronogramas en este documento.
