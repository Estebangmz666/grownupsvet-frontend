import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  createAdministrator,
  createVeterinarian,
  updateAdministrator,
  updateVeterinarian,
} from "@api-client/staff.api";
import { StaffButton, StaffField } from "../components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffTextField,
} from "../components/StaffManagementComponents";
import { useStaffMutation } from "../hooks/useStaffMutation";
import {
  academicDetailsChanged,
  staffFormValues,
  staffOperationError,
  validateStaffForm,
  veterinarianEditableValues,
  type StaffAccount,
  type StaffAccountKind,
  type StaffFormErrors,
  type StaffFormField,
  type StaffOperationError,
} from "../staffManagement";
import { staffStyles as styles } from "../staffStyles";

export function StaffAccountFormScreen({
  kind,
  account,
  onCancel,
  onSaved,
}: {
  kind: StaffAccountKind;
  account?: StaffAccount;
  onCancel: () => void;
  onSaved: (account: StaffAccount, creating: boolean) => void;
}) {
  const [values, setValues] = useState(() => staffFormValues(account));
  const [fieldErrors, setFieldErrors] = useState<StaffFormErrors>({});
  const [error, setError] = useState<StaffOperationError | null>(null);
  const [errorVersion, setErrorVersion] = useState(0);
  const [confirmAcademicChange, setConfirmAcademicChange] = useState(false);
  const mutation = useStaffMutation();
  const creating = !account;
  const noun = kind === "administrators" ? "administrador" : "veterinario";
  const closeConfirmation = useCallback(
    () => setConfirmAcademicChange(false),
    [],
  );

  const save = () => {
    setConfirmAcademicChange(false);
    void mutation.run({
      write: (context) => {
        if (kind === "administrators") {
          return account
            ? updateAdministrator(
                account.id,
                { fullName: values.fullName },
                {},
                context,
              )
            : createAdministrator(
                { email: values.email, fullName: values.fullName },
                {},
                context,
              );
        }
        const editable = veterinarianEditableValues(values);
        return account
          ? updateVeterinarian(account.id, editable, {}, context)
          : createVeterinarian(
              { ...editable, email: values.email },
              {},
              context,
            );
      },
      onStarted: () => {
        setError(null);
        setFieldErrors({});
      },
      onResolved: (saved) => onSaved(saved, creating),
      onRejected: (failure) => {
        const next = staffOperationError(failure, true);
        setError(next);
        setErrorVersion((current) => current + 1);
        setFieldErrors(next.fieldErrors);
      },
      onFinished: () => {},
    });
  };
  const submit = () => {
    if (mutation.pending || error?.uncertain) return;
    const errors = validateStaffForm(kind, values, creating);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setErrorVersion((current) => current + 1);
      setError({
        message: "Corrige los campos indicados antes de guardar.",
        fieldErrors: errors,
        uncertain: false,
        missing: false,
      });
      return;
    }
    if (account && academicDetailsChanged(account, values))
      setConfirmAcademicChange(true);
    else save();
  };
  const field = (
    name: StaffFormField,
    label: string,
    options: { email?: boolean; phone?: boolean; multiline?: boolean } = {},
  ) => (
    <StaffTextField
      key={name}
      label={label}
      value={values[name]}
      error={fieldErrors[name]}
      disabled={mutation.pending || error?.uncertain === true}
      {...options}
      onChange={(value) => {
        setValues((current) => ({ ...current, [name]: value }));
        setFieldErrors((current) => ({ ...current, [name]: undefined }));
      }}
    />
  );
  return (
    <View style={styles.section}>
      <StaffHeading title={`${creating ? "Crear" : "Editar"} ${noun}`} />
      <Text style={styles.description}>
        {creating
          ? "La cuenta quedará pendiente de activación. La persona establecerá su contraseña mediante una invitación."
          : kind === "administrators"
            ? "Puedes actualizar el nombre. El correo y el rol no se pueden cambiar."
            : "Puedes actualizar los datos profesionales. El correo y el rol no se pueden cambiar."}
      </Text>
      {error ? (
        <StaffErrorSummary key={errorVersion} message={error.message} />
      ) : null}
      <View style={styles.card}>
        {creating ? (
          field("email", "Correo electrónico (obligatorio)", { email: true })
        ) : (
          <StaffField
            label="Correo electrónico (no se puede cambiar)"
            value={values.email}
          />
        )}
        <StaffField
          label="Rol asignado por el sistema"
          value={kind === "administrators" ? "Administrador" : "Veterinario"}
        />
        {field("fullName", "Nombre completo (obligatorio)")}
        {kind === "veterinarians" ? (
          <>
            {field(
              "professionalPhoneNumber",
              "Teléfono profesional internacional (obligatorio)",
              { phone: true },
            )}
            {field(
              "professionalRegistrationNumber",
              "Matrícula profesional (obligatoria)",
            )}
            <Text style={styles.description}>
              Registrar la matrícula no acredita una verificación ante
              COMVEZCOL.
            </Text>
            {field("baseDegreeTitle", "Título profesional base (obligatorio)")}
            {field(
              "baseDegreeInstitution",
              "Institución del título base (obligatoria)",
            )}
            {account ? (
              <Text style={styles.description}>
                Cambiar el título o la institución base retira la publicación
                del diploma asociado para que se revise otra vez.
              </Text>
            ) : null}
            {field(
              "biography",
              "Presentación profesional (opcional; dejar vacío la elimina)",
              { multiline: true },
            )}
          </>
        ) : null}
        {mutation.pending ? (
          <Text style={styles.description} accessibilityLiveRegion="polite">
            Guardando. Espera la respuesta antes de realizar otra operación.
          </Text>
        ) : null}
        <View style={styles.controls}>
          <StaffButton
            label={
              error?.uncertain
                ? creating
                  ? "Consultar listado"
                  : "Consultar cuenta"
                : "Cancelar y volver"
            }
            onPress={onCancel}
            disabled={mutation.pending}
          />
          <StaffButton
            label={
              mutation.pending
                ? "Guardando…"
                : creating
                  ? "Crear cuenta"
                  : "Guardar cambios"
            }
            onPress={submit}
            disabled={mutation.pending || error?.uncertain === true}
          />
        </View>
      </View>
      {confirmAcademicChange ? (
        <StaffConfirmationDialog
          title="Cambiar datos del título base"
          message="Este cambio retira la publicación del diploma asociado. Deberá revisarse antes de publicarlo de nuevo. ¿Deseas guardar estos datos?"
          confirmLabel="Guardar y retirar publicación"
          onCancel={closeConfirmation}
          onConfirm={save}
        />
      ) : null}
    </View>
  );
}
