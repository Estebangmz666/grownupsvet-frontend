import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { LoadingState } from "@grownupsvet/accessibility-kit";
import { isApiRequestContextCurrent } from "@grownupsvet/api-client";
import {
  deleteVeterinarianDiploma,
  deleteVeterinarianQualification,
  fetchVeterinarianDiplomaBlob,
  updateVeterinarianDiplomaPublication,
  uploadVeterinarianDiploma,
} from "@api-client/veterinarianQualifications.api";
import type { VeterinarianQualificationResponseDTO } from "@api-client/staff.types";
import {
  VeterinarianDiplomaFilePicker,
  VeterinarianQualificationFields,
} from "../components/VeterinarianQualificationComponents";
import { StaffButton, StaffField } from "../components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffSuccessNotice,
} from "../components/StaffManagementComponents";
import { useStaffMutation } from "../hooks/useStaffMutation";
import { useVeterinarianQualifications } from "../hooks/useVeterinarianQualifications";
import {
  createVeterinarianDiplomaDownloadManager,
  validateVeterinarianDiplomaSelection,
  veterinarianQualificationOperationError,
  type VeterinarianQualificationOperationError,
} from "../veterinarianQualificationsPresentation";
import { staffStyles as styles } from "../staffStyles";

type QualificationAction =
  "upload" | "publish" | "unpublish" | "deleteDiploma" | "deleteQualification";
const actionLabels: Record<QualificationAction, string> = {
  upload: "Guardar diploma privado",
  publish: "Publicar diploma revisado",
  unpublish: "Retirar publicación del diploma",
  deleteDiploma: "Eliminar diploma",
  deleteQualification: "Eliminar título adicional",
};

export function VeterinarianQualificationDetailsScreen({
  veterinarianId,
  veterinarianName,
  qualificationId,
  initialMessage,
  initialFailure,
  onBack,
  onEdit,
  onDeleted,
}: {
  veterinarianId: string;
  veterinarianName: string;
  qualificationId: string;
  initialMessage?: string;
  initialFailure?: VeterinarianQualificationOperationError;
  onBack: (failure?: VeterinarianQualificationOperationError) => void;
  onEdit: (
    qualification: VeterinarianQualificationResponseDTO,
    total: number,
  ) => void;
  onDeleted: () => void;
}) {
  const result = useVeterinarianQualifications(veterinarianId, qualificationId);
  const mutation = useStaffMutation();
  const [confirmation, setConfirmation] = useState<QualificationAction | null>(
    null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [failure, setFailure] = useState<{
    error: VeterinarianQualificationOperationError;
    readKey: string;
  } | null>(
    initialFailure
      ? { error: initialFailure, readKey: "previous-operation" }
      : null,
  );
  const [downloadError, setDownloadError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadedForReview, setDownloadedForReview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const downloads = useRef(
    createVeterinarianDiplomaDownloadManager({
      isContextCurrent: isApiRequestContextCurrent,
      createObjectURL: (blob) => URL.createObjectURL(blob),
      revokeObjectURL: (url) => URL.revokeObjectURL(url),
    }),
  );
  useEffect(() => {
    const manager = downloads.current;
    return () => manager.clear();
  }, []);
  const clearDownload = () => {
    downloads.current.clear();
    setDownloadUrl(null);
    setDownloadedForReview(false);
    setReviewed(false);
  };
  const qualification = result.qualification;
  const consultedAfterFailure =
    !!qualification && !!failure && result.readKey !== failure.readKey;
  const consultationRequired =
    !!failure?.error.refreshRequired && !consultedAfterFailure;
  const blocked = mutation.pending || result.loading || consultationRequired;
  const closeConfirmation = useCallback(() => setConfirmation(null), []);
  const refresh = () => {
    clearDownload();
    setFile(null);
    setFileError(undefined);
    setDownloadError("");
    result.refresh();
  };
  const prepareDownload = () => {
    if (blocked || !qualification?.diplomaAvailable || Platform.OS !== "web")
      return;
    void mutation.run({
      write: (context) =>
        fetchVeterinarianDiplomaBlob(veterinarianId, qualificationId, context),
      onStarted: () => {
        clearDownload();
        setDownloadError("");
      },
      onResolved: (blob, context) => {
        const prepared = downloads.current.prepare(blob, context);
        if (prepared) setDownloadUrl(prepared.url);
      },
      onRejected: (error: unknown) => {
        const problem = veterinarianQualificationOperationError(error);
        setDownloadError(problem.message);
        if (problem.refreshRequired)
          setFailure({ error: problem, readKey: result.readKey });
      },
      onFinished: () => {},
    });
  };
  const execute = () => {
    const action = confirmation;
    setConfirmation(null);
    if (!action || blocked || !qualification) return;
    if (action === "deleteQualification" && qualification.isBaseDegree) return;
    if (
      action === "publish" &&
      (!qualification.diplomaAvailable ||
        !reviewed ||
        !downloadedForReview ||
        !downloadUrl ||
        !downloads.current.canDownload(downloadUrl))
    )
      return;
    if (
      action === "upload" &&
      (!file || validateVeterinarianDiplomaSelection(file))
    )
      return;
    void mutation.run({
      write: async (context) => {
        if (action === "deleteQualification")
          await deleteVeterinarianQualification(
            veterinarianId,
            qualificationId,
            context,
          );
        else if (action === "deleteDiploma")
          await deleteVeterinarianDiploma(
            veterinarianId,
            qualificationId,
            context,
          );
        else if (action === "upload" && file)
          await uploadVeterinarianDiploma(
            veterinarianId,
            qualificationId,
            {
              blob: file.type
                ? file
                : new Blob([file], { type: "application/pdf" }),
              name: file.name || "diploma.pdf",
              published: false,
            },
            context,
          );
        else if (action === "publish" || action === "unpublish")
          await updateVeterinarianDiplomaPublication(
            veterinarianId,
            qualificationId,
            { published: action === "publish" },
            context,
          );
        else throw new RangeError("Selecciona un PDF antes de continuar.");
      },
      onStarted: () => {
        clearDownload();
        setFailure(null);
        setMessage("");
        setDownloadError("");
        setFileError(undefined);
      },
      onResolved: () => {
        setFile(null);
        if (action === "deleteQualification") {
          onDeleted();
          return;
        }
        setMessage(
          action === "upload"
            ? "El servidor confirmó el almacenamiento del diploma privado."
            : action === "publish"
              ? "El servidor confirmó la publicación del diploma."
              : action === "unpublish"
                ? "El servidor confirmó que se retiró la publicación del diploma."
                : "El servidor confirmó la eliminación del diploma; el título se conserva.",
        );
        result.refresh();
      },
      onRejected: (error: unknown) => {
        const problem = veterinarianQualificationOperationError(error, true);
        setFailure({ error: problem, readKey: result.readKey });
        setFileError(problem.fieldErrors.file);
      },
      onFinished: () => {},
    });
  };
  const confirmationMessage =
    confirmation === "upload"
      ? `Se guardará ${file?.name ?? "el PDF seleccionado"} como diploma privado. Si existe un diploma anterior, será reemplazado y su publicación se retirará.`
      : confirmation === "publish"
        ? "Confirmas que descargaste y revisaste el PDF. Se publicará el diploma almacenado para que propietarios autenticados puedan consultarlo cuando el veterinario esté activo."
        : confirmation === "unpublish"
          ? "El diploma dejará de estar publicado y conservará su archivo privado."
          : confirmation === "deleteDiploma"
            ? "El archivo del diploma será eliminado y dejará de estar publicado. El título académico se conserva."
            : "Se eliminará este título adicional y su diploma, si lo tiene. Esta acción no elimina al veterinario ni su título base.";
  return (
    <View style={styles.section}>
      <StaffHeading title="Detalle del título académico" />
      <Text style={styles.description}>{veterinarianName}</Text>
      <View style={styles.controls}>
        <StaffButton
          label="Volver a la formación actual"
          disabled={mutation.pending}
          onPress={() =>
            onBack(failure?.error.refreshRequired ? failure.error : undefined)
          }
        />
        <StaffButton
          label="Consultar título y formación actuales"
          disabled={mutation.pending || result.loading}
          onPress={refresh}
        />
      </View>
      {message ? <StaffSuccessNotice message={message} /> : null}
      {failure ? <StaffErrorSummary message={failure.error.message} /> : null}
      {consultedAfterFailure && failure?.error.refreshRequired ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Se consultaron el título y la formación actuales. Estos datos muestran
          el estado registrado ahora; una respuesta perdida no permite
          atribuirlo al envío anterior.
        </Text>
      ) : null}
      {result.error ? (
        <StaffErrorSummary message={result.error.message} />
      ) : null}
      {downloadError ? <StaffErrorSummary message={downloadError} /> : null}
      {result.loading ? (
        <LoadingState message="Consultando el título y la formación actuales..." />
      ) : null}
      {qualification ? (
        <>
          <View style={styles.card}>
            <VeterinarianQualificationFields qualification={qualification} />
            <StaffButton
              label="Editar datos académicos"
              disabled={blocked}
              onPress={() =>
                onEdit(qualification, result.qualifications?.length ?? 0)
              }
            />
            {qualification.isBaseDegree ? (
              <Text style={styles.description}>
                El título base es obligatorio y no se puede eliminar.
              </Text>
            ) : (
              <StaffButton
                label="Eliminar título adicional"
                disabled={blocked}
                onPress={() => setConfirmation("deleteQualification")}
              />
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Diploma PDF
            </Text>
            <Text style={styles.description}>
              Hasta 5 MiB y 50 páginas, sin cifrado, formularios, acciones ni
              adjuntos. El servidor comprueba la estructura y los límites del
              PDF. La carga se guarda privada para su revisión.
            </Text>
            <VeterinarianDiplomaFilePicker
              disabled={blocked}
              onSelect={(selected) => {
                const error = selected
                  ? validateVeterinarianDiplomaSelection(selected)
                  : undefined;
                setFileError(error);
                setFile(error ? null : selected);
              }}
            />
            {file ? (
              <StaffField
                label="Archivo seleccionado"
                value={`${file.name} · ${Math.ceil(file.size / 1024)} KiB`}
              />
            ) : null}
            {fileError ? <StaffErrorSummary message={fileError} /> : null}
            <StaffButton
              label="Revisar carga privada del diploma"
              disabled={blocked || !file || !!fileError}
              onPress={() => setConfirmation("upload")}
            />
          </View>
          {qualification.diplomaAvailable ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Revisión y publicación del diploma
              </Text>
              <StaffButton
                label="Preparar descarga del diploma"
                disabled={blocked || Platform.OS !== "web"}
                onPress={prepareDownload}
              />
              {downloadUrl && Platform.OS === "web"
                ? React.createElement(
                    "a",
                    {
                      href: downloadUrl,
                      download: "diploma.pdf",
                      style: {
                        fontSize: 18,
                        minHeight: 48,
                        padding: 12,
                        display: "inline-block",
                      },
                      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                        if (!downloads.current.canDownload(downloadUrl)) {
                          event.preventDefault();
                          clearDownload();
                          return;
                        }
                        setDownloadedForReview(true);
                      },
                    },
                    "Descargar PDF para revisión",
                  )
                : null}
              {!qualification.diplomaPublished ? (
                <>
                  <StaffButton
                    label="Confirmo que revisé el PDF descargado"
                    selected={reviewed}
                    disabled={blocked || !downloadedForReview}
                    onPress={() => setReviewed((value) => !value)}
                  />
                  <StaffButton
                    label="Publicar diploma revisado"
                    disabled={blocked || !reviewed || !downloadedForReview}
                    onPress={() => setConfirmation("publish")}
                  />
                </>
              ) : (
                <StaffButton
                  label="Retirar publicación del diploma"
                  disabled={blocked}
                  onPress={() => setConfirmation("unpublish")}
                />
              )}
              <StaffButton
                label="Eliminar diploma conservando el título"
                disabled={blocked}
                onPress={() => setConfirmation("deleteDiploma")}
              />
            </View>
          ) : null}
        </>
      ) : null}
      {mutation.pending ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Procesando. Espera antes de continuar.
        </Text>
      ) : null}
      {confirmation && qualification ? (
        <StaffConfirmationDialog
          title={actionLabels[confirmation]}
          message={`${qualification.title}. ${confirmationMessage}`}
          confirmLabel={actionLabels[confirmation]}
          onCancel={closeConfirmation}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}
