import React, { useCallback, useEffect, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import {
  listAdministrators,
  listVeterinarians,
  STAFF_PAGE_SIZE,
} from "@api-client/staff.api";
import type {
  AdministratorResponseDTO,
  StaffAccountStatus,
  VeterinarianResponseDTO,
} from "@api-client/staff.types";
import type { Page } from "@grownupsvet/api-client";
import {
  StaffButton,
  StaffField,
  StaffPagination,
  StaffStatus,
  StaffStatusFilter,
} from "../components/StaffComponents";
import { useStaffPage } from "../hooks/useStaffPage";
import { accountStatusLabel } from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";
import { EditStaffAccountScreen } from "./EditStaffAccountScreen";
import { StaffAccountDetailsScreen } from "./StaffAccountDetailsScreen";
import { StaffAccountFormScreen } from "./StaffAccountFormScreen";
import { reconciledStaffPage } from "../staffManagement";
import { StaffHeading } from "../components/StaffManagementComponents";
import { VeterinarianAvailabilityScreen } from "./VeterinarianAvailabilityScreen";
import { VeterinarianQualificationsScreen } from "./VeterinarianQualificationsScreen";

type StaffAccount = AdministratorResponseDTO | VeterinarianResponseDTO;

export function StaffAccountsScreen({
  kind,
  initialPage,
  canManageAvailability = false,
}: {
  kind: "administrators" | "veterinarians";
  initialPage?: Page<StaffAccount>;
  canManageAvailability?: boolean;
}) {
  const [query, setQuery] = useState<{
    page: number;
    status?: StaffAccountStatus;
  }>({ page: 0 });
  const [route, setRoute] = useState<
    | { screen: "list" | "create" }
    | { screen: "details" | "edit"; id: string; message?: string }
    | { screen: "availability"; veterinarian: VeterinarianResponseDTO }
    | { screen: "qualifications"; veterinarian: VeterinarianResponseDTO }
  >({ screen: "list" });
  const { width } = useWindowDimensions();
  const load = useCallback(
    (signal: AbortSignal): Promise<Page<StaffAccount>> => {
      const params = { ...query, size: STAFF_PAGE_SIZE };
      return kind === "administrators"
        ? listAdministrators(params, { signal })
        : listVeterinarians(params, { signal });
    },
    [kind, query],
  );
  const result = useStaffPage(
    `${kind}:${query.page}:${query.status ?? "ALL"}`,
    load,
    initialPage,
  );
  useEffect(() => {
    const adjusted = reconciledStaffPage(query.page, result.page);
    if (adjusted !== query.page) {
      setQuery((current) => ({ ...current, page: adjusted }));
    }
  }, [query.page, result.page]);
  const saved = (account: StaffAccount, creating: boolean) => {
    result.retry();
    setRoute({
      screen: "details",
      id: account.id,
      message: creating
        ? "Cuenta creada, pendiente de activación. La invitación quedó registrada; esto no confirma que el correo haya llegado al buzón."
        : "Datos actualizados.",
    });
  };
  if (route.screen === "qualifications" && kind === "veterinarians")
    return (
      <VeterinarianQualificationsScreen
        veterinarian={route.veterinarian}
        onBack={() => {
          result.retry();
          setRoute({ screen: "details", id: route.veterinarian.id });
        }}
      />
    );
  if (
    route.screen === "availability" &&
    kind === "veterinarians" &&
    canManageAvailability
  )
    return (
      <VeterinarianAvailabilityScreen
        veterinarian={route.veterinarian}
        onBack={() =>
          setRoute({ screen: "details", id: route.veterinarian.id })
        }
      />
    );
  if (route.screen === "create")
    return (
      <StaffAccountFormScreen
        kind={kind}
        onCancel={() => {
          result.retry();
          setRoute({ screen: "list" });
        }}
        onSaved={saved}
      />
    );
  if (route.screen === "details")
    return (
      <StaffAccountDetailsScreen
        key={route.id}
        kind={kind}
        id={route.id}
        initialMessage={route.message}
        onBack={() => setRoute({ screen: "list" })}
        onEdit={() => setRoute({ screen: "edit", id: route.id })}
        onChanged={result.retry}
        onQualifications={
          kind === "veterinarians"
            ? (veterinarian) =>
                setRoute({ screen: "qualifications", veterinarian })
            : undefined
        }
        onAvailability={
          kind === "veterinarians" && canManageAvailability
            ? (veterinarian) =>
                setRoute({ screen: "availability", veterinarian })
            : undefined
        }
      />
    );
  if (route.screen === "edit")
    return (
      <EditStaffAccountScreen
        kind={kind}
        id={route.id}
        onCancel={() => setRoute({ screen: "details", id: route.id })}
        onSaved={saved}
      />
    );
  return (
    <View style={styles.section}>
      <StaffHeading
        title={
          kind === "administrators"
            ? "Listado de administradores"
            : "Listado de veterinarios"
        }
      />
      <View style={styles.controls}>
        <StaffButton
          label={
            kind === "administrators"
              ? "Crear administrador"
              : "Crear veterinario"
          }
          onPress={() => setRoute({ screen: "create" })}
        />
      </View>
      <StaffStatusFilter
        status={query.status}
        onChange={(status) => setQuery({ page: 0, status })}
      />
      <View style={styles.controls}>
        <StaffButton
          label="Actualizar lista"
          disabled={result.loading}
          onPress={result.retry}
        />
      </View>
      {result.loading ? <LoadingState message="Cargando personal..." /> : null}
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.retry} />
      ) : null}
      {result.page?.items.length === 0 ? (
        <EmptyState
          title="No hay registros para esta consulta"
          description="Puedes cambiar el estado seleccionado o actualizar la lista."
        />
      ) : null}
      {result.page ? (
        <View style={styles.cards}>
          {result.page.items.map((account) => (
            <View
              key={account.id}
              style={[
                styles.card,
                { flexBasis: width >= 760 ? "46%" : "100%" },
              ]}
            >
              <Text style={styles.cardTitle} accessibilityRole="header">
                {account.fullName}
              </Text>
              <StaffStatus label={accountStatusLabel(account.status)} />
              {"professionalRegistrationNumber" in account ? (
                <>
                  <StaffField
                    label="Matrícula profesional"
                    value={account.professionalRegistrationNumber}
                  />
                  <StaffField
                    label="Teléfono profesional"
                    value={account.professionalPhoneNumber}
                  />
                </>
              ) : (
                <StaffField label="Correo electrónico" value={account.email} />
              )}
              <StaffButton
                label={`Ver detalle de ${account.fullName}`}
                onPress={() => setRoute({ screen: "details", id: account.id })}
              />
            </View>
          ))}
        </View>
      ) : null}
      <StaffPagination
        currentPage={query.page}
        data={result.page}
        loading={result.loading}
        onChange={(page) => setQuery((current) => ({ ...current, page }))}
      />
    </View>
  );
}
