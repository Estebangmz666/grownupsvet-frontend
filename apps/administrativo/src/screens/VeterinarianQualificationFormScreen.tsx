import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  createVeterinarianQualification,
  updateVeterinarianQualification,
} from "@api-client/veterinarianQualifications.api";
import type { VeterinarianQualificationResponseDTO } from "@api-client/staff.types";
import { StaffButton } from "../components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffTextField,
} from "../components/StaffManagementComponents";
import { useStaffMutation } from "../hooks/useStaffMutation";
import {
  MAX_VETERINARIAN_QUALIFICATIONS,
  validateVeterinarianQualificationForm,
  veterinarianQualificationAcademicDataChanged,
  veterinarianQualificationFormValues,
  veterinarianQualificationOperationError,
  veterinarianQualificationRequest,
  veterinarianQualificationTypeLabels,
  type VeterinarianQualificationFieldErrors,
  type VeterinarianQualificationOperationError,
} from "../veterinarianQualificationsPresentation";
import { staffStyles as styles } from "../staffStyles";

export function VeterinarianQualificationFormScreen({
  veterinarianId,
  veterinarianName,
  qualification,
  totalQualifications,
  onConsult,
  onSaved,
}: {
  veterinarianId: string;
  veterinarianName: string;
  qualification?: VeterinarianQualificationResponseDTO;
  totalQualifications: number;
  onConsult: (failure?: VeterinarianQualificationOperationError) => void;
  onSaved: (qualification: VeterinarianQualificationResponseDTO) => void;
}) {
  const [values, setValues] = useState(() =>
    veterinarianQualificationFormValues(qualification),
  );
  const [fieldErrors, setFieldErrors] =
    useState<VeterinarianQualificationFieldErrors>({});
  const [failure, setFailure] =
    useState<VeterinarianQualificationOperationError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const mutation = useStaffMutation();
  const blocked = mutation.pending || !!failure?.refreshRequired;
  const atLimit =
    !qualification && totalQualifications >= MAX_VETERINARIAN_QUALIFICATIONS;
  const changed =
    !qualification ||
    veterinarianQualificationAcademicDataChanged(qualification, values);
  const closeConfirmation = useCallback(() => setConfirming(false), []);
  const validate = () => {
    const errors = validateVeterinarianQualificationForm(
      values,
      qualification?.isBaseDegree ?? false,
    );
    setFieldErrors(errors);
    return !atLimit && changed && Object.keys(errors).length === 0;
  };
  const review = () => {
    if (!blocked && validate()) setConfirming(true);
  };
  const execute = () => {
    setConfirming(false);
    if (blocked || !validate()) return;
    const request = veterinarianQualificationRequest(values);
    void mutation.run({
      write: (context) =>
        qualification
          ? updateVeterinarianQualification(
              veterinarianId,
              qualification.id,
              request,
              context,
            )
          : createVeterinarianQualification(veterinarianId, request, context),
      onStarted: () => {
        setFailure(null);
        setFieldErrors({});
      },
      onResolved: onSaved,
      onRejected: (error: unknown) => {
        const result = veterinarianQualificationOperationError(error, true);
        setFailure(result);
        setFieldErrors(result.fieldErrors);
      },
      onFinished: () => {},
    });
  };
  return (
    <View style={styles.section}>
      <StaffHeading
        title={
          qualification ? "Editar título académico" : "Agregar título académico"
        }
      />
      <Text style={styles.description}>
        {veterinarianName}. Se permiten hasta 20 títulos, incluido el título
        base. Los cursos no se presentan como especializaciones.
      </Text>
      <StaffButton
        label="Volver a consultar la formación actual"
        disabled={mutation.pending}
        onPress={() =>
          onConsult(failure?.refreshRequired ? failure : undefined)
        }
      />
      {failure ? (
        <StaffErrorSummary message={failure.message} />
      ) : Object.keys(fieldErrors).length ? (
        <StaffErrorSummary message="Revisa los datos indicados antes de continuar." />
      ) : null}
      {atLimit ? (
        <StaffErrorSummary message="Ya se alcanzó el límite de 20 títulos. Consulta la formación actual antes de continuar." />
      ) : null}
      {qualification?.diplomaAvailable ? (
        <Text style={styles.description}>
          Cambiar los datos académicos retira la publicación del diploma para
          revisarlo de nuevo; el archivo se conserva privado.
        </Text>
      ) : null}
      <Text style={styles.fieldLabel}>Tipo de título</Text>
      <View style={styles.controls}>
        {Object.entries(veterinarianQualificationTypeLabels).map(
          ([type, label]) => (
            <StaffButton
              key={type}
              label={label}
              selected={values.type === type}
              disabled={
                blocked ||
                (!!qualification?.isBaseDegree && type !== "UNDERGRADUATE")
              }
              onPress={() =>
                setValues((current) => ({
                  ...current,
                  type: type as VeterinarianQualificationResponseDTO["type"],
                }))
              }
            />
          ),
        )}
      </View>
      {qualification?.isBaseDegree ? (
        <Text style={styles.description}>
          El título base conserva el tipo de pregrado y no se puede eliminar.
        </Text>
      ) : null}
      {fieldErrors.type ? (
        <Text style={styles.errorText}>{fieldErrors.type}</Text>
      ) : null}
      <StaffTextField
        label="Nombre del título (hasta 200 caracteres)"
        value={values.title}
        error={fieldErrors.title}
        disabled={blocked}
        onChange={(title) => setValues((current) => ({ ...current, title }))}
      />
      <StaffTextField
        label="Institución (hasta 200 caracteres)"
        value={values.institution}
        error={fieldErrors.institution}
        disabled={blocked}
        onChange={(institution) =>
          setValues((current) => ({ ...current, institution }))
        }
      />
      <StaffTextField
        label="Año de graduación (opcional)"
        value={values.graduationYear}
        error={fieldErrors.graduationYear}
        disabled={blocked}
        onChange={(graduationYear) =>
          setValues((current) => ({ ...current, graduationYear }))
        }
      />
      <StaffButton
        label="Revisar datos del título"
        disabled={blocked || atLimit || !changed}
        onPress={review}
      />
      {mutation.pending ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Registrando los datos. Espera antes de continuar.
        </Text>
      ) : null}
      {confirming ? (
        <StaffConfirmationDialog
          title={
            qualification
              ? "Guardar datos académicos"
              : "Agregar título académico"
          }
          message={`${veterinarianName}. ${veterinarianQualificationTypeLabels[values.type]}: ${values.title}. Institución: ${values.institution}. ${values.graduationYear ? `Año: ${values.graduationYear}.` : "Sin año registrado."}${qualification?.diplomaAvailable ? " El diploma conservará su archivo y quedará privado para una nueva revisión." : ""}`}
          confirmLabel="Guardar título"
          onCancel={closeConfirmation}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}
