import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { LoadingState } from "@grownupsvet/accessibility-kit";
import {
  cancelStaffInvitation,
  resendStaffInvitation,
  updateAdministratorStatus,
  updateVeterinarianStatus,
} from "@api-client/staff.api";
import {
  StaffButton,
  StaffField,
  StaffStatus,
} from "../components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffSuccessNotice,
} from "../components/StaffManagementComponents";
import { useStaffAccount } from "../hooks/useStaffAccount";
import { useStaffMutation } from "../hooks/useStaffMutation";
import { accountStatusLabel } from "../staffPresentation";
import {
  staffOperationError,
  type StaffAccount,
  type StaffAccountKind,
  type StaffOperationError,
} from "../staffManagement";
import { staffStyles as styles } from "../staffStyles";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";

type AccountAction = "enable" | "disable" | "resend" | "cancel";
const actionLabels: Record<AccountAction, string> = {
  enable: "Habilitar cuenta",
  disable: "Deshabilitar cuenta",
  resend: "Reenviar invitación",
  cancel: "Cancelar invitación",
};

function actionMessage(action: AccountAction, kind: StaffAccountKind) {
  switch (action) {
    case "disable":
      return (
        "La cuenta dejará de poder ingresar y sus sesiones e invitaciones previas quedarán invalidadas." +
        (kind === "veterinarians"
          ? " Sus turnos dejarán de aparecer a propietarios y sus citas futuras se marcarán para reasignación; no se cancelarán automáticamente."
          : "")
      );
    case "enable":
      return "Si la cuenta ya tenía contraseña, la conservará; sus sesiones anteriores seguirán invalidadas. Si nunca se activó, necesitará una invitación para establecer su contraseña.";
    case "resend":
      return "Se solicitará una nueva invitación y el enlace anterior dejará de funcionar. El servicio aplica una espera mínima y una cuota diaria. La respuesta confirma la solicitud, no la entrega al buzón.";
    case "cancel":
      return "El enlace de activación quedará invalidado y la cuenta sin contraseña quedará deshabilitada. La cuenta no se elimina. Si ya estableció contraseña, no se podrá cancelar una invitación de esta forma.";
  }
}

export function StaffAccountDetailsScreen({
  kind,
  id,
  initialMessage,
  onBack,
  onEdit,
  onChanged,
  onAvailability,
  onQualifications,
}: {
  kind: StaffAccountKind;
  id: string;
  initialMessage?: string;
  onBack: () => void;
  onEdit: () => void;
  onChanged: () => void;
  onAvailability?: (veterinarian: VeterinarianResponseDTO) => void;
  onQualifications?: (veterinarian: VeterinarianResponseDTO) => void;
}) {
  const result = useStaffAccount(kind, id);
  const mutation = useStaffMutation();
  const [confirmation, setConfirmation] = useState<AccountAction | null>(null);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [error, setError] = useState<StaffOperationError | null>(null);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);
  const refresh = () => {
    setError(null);
    setMessage("");
    result.refresh();
  };
  const execute = () => {
    const action = confirmation;
    if (!action || !result.account || mutation.pending || error?.uncertain)
      return;
    setConfirmation(null);
    void mutation.run<{
      account?: StaffAccount;
      message: string;
      reload?: boolean;
    }>({
      write: async (context) => {
        if (action === "enable" || action === "disable") {
          const status = action === "enable" ? "ACTIVE" : "DISABLED";
          const update =
            kind === "administrators"
              ? updateAdministratorStatus
              : updateVeterinarianStatus;
          const account = await update(id, status, {}, context);
          return {
            account,
            message:
              status === "ACTIVE"
                ? "Cuenta habilitada. Sus sesiones anteriores siguen invalidadas."
                : "Cuenta deshabilitada. Sus sesiones e invitaciones anteriores quedaron invalidadas.",
          };
        }
        if (action === "resend") {
          const invitation = await resendStaffInvitation(id, {}, context);
          const expires = new Intl.DateTimeFormat("es-CO", {
            timeZone: "America/Bogota",
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(invitation.expiresAt));
          return {
            message: `Nueva invitación solicitada, pendiente de entrega. Vence el ${expires}, hora de Bogotá. No se ha confirmado recepción en el buzón.`,
            reload: true,
          };
        }
        await cancelStaffInvitation(id, {}, context);
        return {
          message:
            "Invitación cancelada. La cuenta sin contraseña quedó deshabilitada y no fue eliminada.",
          reload: true,
        };
      },
      onStarted: () => {
        setError(null);
        setMessage("");
      },
      onResolved: (value) => {
        setMessage(value.message);
        if (value.account) result.setAccount(value.account);
        if (value.reload) result.refresh();
        onChanged();
      },
      onRejected: (failure) => setError(staffOperationError(failure, true)),
      onFinished: () => {},
    });
  };
  const account = result.account;
  const blocked =
    mutation.pending ||
    result.loading ||
    !!error?.uncertain ||
    !!error?.missing;
  return (
    <View style={styles.section}>
      <StaffHeading
        title={
          kind === "administrators"
            ? "Detalle del administrador"
            : "Detalle del veterinario"
        }
      />
      <View style={styles.controls}>
        <StaffButton
          label="Volver al listado"
          onPress={onBack}
          disabled={mutation.pending}
        />
        <StaffButton
          label="Actualizar detalle"
          onPress={refresh}
          disabled={mutation.pending || result.loading}
        />
      </View>
      {message ? <StaffSuccessNotice message={message} /> : null}
      {error || result.error ? (
        <StaffErrorSummary message={(error ?? result.error)!.message} />
      ) : null}
      {result.loading ? (
        <LoadingState message="Consultando la cuenta actual..." />
      ) : null}
      {account ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{account.fullName}</Text>
          <StaffStatus label={accountStatusLabel(account.status)} />
          <StaffField
            label="Correo electrónico (no se puede cambiar)"
            value={account.email}
          />
          <StaffField
            label="Rol (no se puede cambiar)"
            value={kind === "administrators" ? "Administrador" : "Veterinario"}
          />
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
              <StaffField
                label="Título profesional base"
                value={account.baseDegreeTitle}
              />
              <StaffField
                label="Institución del título base"
                value={account.baseDegreeInstitution}
              />
              <StaffField
                label="Presentación profesional"
                value={account.biography || "Sin presentación"}
              />
            </>
          ) : null}
          {account.status === "DISABLED" ? (
            <Text style={styles.description}>
              Si la persona ya había establecido su contraseña, solicita
              habilitar su cuenta. Si nunca la activó, solicita una nueva
              invitación. Se comprobará que la opción corresponda.
            </Text>
          ) : null}
          <View style={styles.controls}>
            {"professionalRegistrationNumber" in account && onQualifications ? (
              <StaffButton
                label="Gestionar formación y diplomas"
                onPress={() => onQualifications(account)}
                disabled={blocked}
              />
            ) : null}
            {"professionalRegistrationNumber" in account && onAvailability ? (
              <StaffButton
                label="Gestionar disponibilidad"
                onPress={() => onAvailability(account)}
                disabled={blocked}
              />
            ) : null}
            <StaffButton
              label="Editar datos"
              onPress={onEdit}
              disabled={blocked}
            />
            {account.status === "DISABLED" ? (
              <StaffButton
                label={actionLabels.enable}
                onPress={() => setConfirmation("enable")}
                disabled={blocked}
              />
            ) : null}
            {account.status === "ACTIVE" ||
            account.status === "PENDING_ACTIVATION" ? (
              <StaffButton
                label={actionLabels.disable}
                onPress={() => setConfirmation("disable")}
                disabled={blocked}
              />
            ) : null}
            {account.status === "PENDING_ACTIVATION" ||
            account.status === "DISABLED" ? (
              <>
                <StaffButton
                  label={actionLabels.resend}
                  onPress={() => setConfirmation("resend")}
                  disabled={blocked}
                />
                <StaffButton
                  label={actionLabels.cancel}
                  onPress={() => setConfirmation("cancel")}
                  disabled={blocked}
                />
              </>
            ) : null}
          </View>
          {mutation.pending ? (
            <Text style={styles.description} accessibilityLiveRegion="polite">
              Procesando. Espera antes de realizar otra operación.
            </Text>
          ) : null}
        </View>
      ) : null}
      {confirmation ? (
        <StaffConfirmationDialog
          title={actionLabels[confirmation]}
          message={`${account?.fullName ?? "Cuenta"}. ${actionMessage(confirmation, kind)}`}
          confirmLabel={actionLabels[confirmation]}
          onCancel={closeConfirmation}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}
