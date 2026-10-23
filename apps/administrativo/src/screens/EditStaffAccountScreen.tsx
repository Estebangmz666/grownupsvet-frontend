import React from "react";
import { View } from "react-native";
import { LoadingState } from "@grownupsvet/accessibility-kit";
import { StaffButton } from "../components/StaffComponents";
import { StaffErrorSummary } from "../components/StaffManagementComponents";
import { useStaffAccount } from "../hooks/useStaffAccount";
import type { StaffAccount, StaffAccountKind } from "../staffManagement";
import { staffStyles as styles } from "../staffStyles";
import { StaffAccountFormScreen } from "./StaffAccountFormScreen";

/** Always re-read before editing; the backend does not expose conditional PUT. */
export function EditStaffAccountScreen({
  kind,
  id,
  onCancel,
  onSaved,
}: {
  kind: StaffAccountKind;
  id: string;
  onCancel: () => void;
  onSaved: (account: StaffAccount, creating: boolean) => void;
}) {
  const result = useStaffAccount(kind, id);
  if (result.account)
    return (
      <StaffAccountFormScreen
        kind={kind}
        account={result.account}
        onCancel={onCancel}
        onSaved={onSaved}
      />
    );
  return (
    <View style={styles.section}>
      {result.loading ? (
        <LoadingState message="Consultando los datos antes de editar..." />
      ) : null}
      {result.error ? (
        <StaffErrorSummary message={result.error.message} />
      ) : null}
      <View style={styles.controls}>
        <StaffButton label="Cancelar y volver" onPress={onCancel} />
        {result.error ? (
          <StaffButton label="Reintentar consulta" onPress={result.refresh} />
        ) : null}
      </View>
    </View>
  );
}
