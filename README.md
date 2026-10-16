# GrownupsVet frontend

Mobile application for pet owners built with Expo SDK 57 and React Native. The
administrative app is reserved for a future phase.

## Monorepo structure

```text
grownupsvet-frontend/
  apps/
    propietario/                 Owner-facing mobile app
    administrativo/              Reserved for future development
  packages/
    api-client/                  Typed HTTP client for the backend API
    accessibility-kit/           Shared accessible UI and utilities
```

## Owner app

The app entry point is the Expo project at the repository root. Its root
navigation switches between authentication and the signed-in tabs based on the
persisted session.

Implemented areas:

- **Authentication:** login, account registration, and the three-step password
  recovery flow. Access tokens are persisted with `expo-secure-store`.
- **Pets:** list active and archived pets, view details, create and edit pets,
  and archive or reactivate them. Archiving preserves the pet and its history;
  physical deletion is not supported.
- **Appointments:** browse upcoming appointments (up to 60 days) and past
  appointments (in 31-day increments, up to 12 chunks), view read-only details,
  and request an appointment using an active pet and an available slot. List
  queries use Bogotá calendar dates and honor the backend's 31-day inclusive
  range limit, fetching all result pages. Booking requires confirmation and
  handles slots that become unavailable. The app supports `NO_SHOW` and renders
  unknown future statuses neutrally. Owners cannot cancel or reschedule
  appointments from the app.
- **Profile:** view account information, update the phone number, add/change or
  remove a profile photo, sign out, and deactivate the account.

The Profile photo picker uses the system library picker. Images are cropped and
compressed on-device before upload. Profile photos are fetched using the
authenticated API client rather than an unauthenticated image URL.

## Shared packages

### `packages/api-client`

Contains typed API operations for authentication and password recovery, pets,
appointments, availability slots, and owner profiles. It supports authenticated
requests, multipart photo uploads, and raw responses for protected binary data.
The backend contract is documented in the
[grownupsvet-backend OpenAPI repository](https://github.com/Estebangmz666/grownupsvet-backend).

### `packages/accessibility-kit`

Provides shared design tokens, `ConfirmDialog`, `LoadingState`, `EmptyState`,
and `ErrorState` components, as well as `useReadAloud()` and accessibility
utilities.

## Configure the API

By default, the app uses:

```text
http://localhost:8080/api/v1
```

Set `EXPO_PUBLIC_API_BASE_URL` to override it. For an Android emulator, use
`http://10.0.2.2:8080/api/v1` when the backend runs on the host machine. For a
physical device, use the host machine's LAN address. Do not commit local
environment files containing machine-specific settings.

## Install and run

Install dependencies from the repository root:

```bash
npm install
npm start
```

Platform commands:

```bash
npm run android
npm run ios
npm run web
```

## Validation

Run the static checks and Android bundle export from the repository root:

```bash
npx tsc --noEmit
npx eslint .
npx expo export --platform android
```

These checks validate types, lint rules, and Expo module resolution. Testing
login, account changes, photo upload, and appointment booking end-to-end also
requires a reachable backend with suitable test data and a device or simulator
for native picker behavior.
