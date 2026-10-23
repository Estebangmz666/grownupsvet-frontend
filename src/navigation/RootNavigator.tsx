import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";
import { useAuthentication } from "@grownupsvet/authentication";
import {
  colors,
  LoadingState,
  spacing,
  typography,
} from "@grownupsvet/accessibility-kit";
import { StaffArea, type InitialStaffData } from "@administrativo/index";
import { AuthenticationNavigator } from "./AuthenticationNavigator";
import { resolveApplicationArea } from "./roleAccess";
import { SessionAccessState } from "../components/SessionAccessState";
import { OwnerArea } from "../components/OwnerArea";
import { StaffAccountActivationScreen } from "../screens/auth/StaffAccountActivationScreen";
import { useStaffAccountActivationLink } from "./useStaffAccountActivationLink";

const authenticationTitles: Record<string, string> = {
  Login: "Iniciar sesión",
  Register: "Crear cuenta",
  ForgotPasswordRequest: "Recupera tu contraseña",
  ForgotPasswordVerify: "Ingresa el código",
  ForgotPasswordReset: "Crea tu nueva contraseña",
};

export function RootNavigator() {
  const activation = useStaffAccountActivationLink();
  const {
    status,
    user,
    generation,
    initialSessionData,
    initializationError,
    storageWarning,
    logoutWarning,
    retrySessionCheck,
    logout,
  } = useAuthentication();
  const sessionKey = `${generation}:${user?.id ?? "public"}`;
  const navigationKey = activation.link
    ? `activation:${sessionKey}:${activation.revision}`
    : status === "signedOut"
      ? "public"
      : sessionKey;
  const area = resolveApplicationArea(user);
  const areaTitles = {
    owner: "Portal del propietario",
    administrators: "Administradores",
    veterinarians: "Veterinarios",
    assignedAppointments: "Mi agenda",
  };
  let content;
  if (status === "checking")
    content = <LoadingState message="Comprobando tu sesión..." />;
  else if (activation.link)
    content = (
      <StaffAccountActivationScreen
        key={navigationKey}
        link={activation.link}
        currentAccountEmail={user?.email}
        onLeave={() => {
          activation.leaveActivation();
          if (user) retrySessionCheck();
        }}
        onCompleted={activation.retireToken}
      />
    );
  else if (status === "verificationFailed")
    content = (
      <SessionAccessState
        message={
          initializationError ??
          "No pudimos comprobar tu acceso. Revisa la conexión e intenta de nuevo."
        }
        onRetry={retrySessionCheck}
        onLogout={() => void logout()}
      />
    );
  else if (status === "signedOut") content = <AuthenticationNavigator />;
  else if (!user || !area)
    content = (
      <SessionAccessState
        message="Tu cuenta no tiene acceso a las funciones disponibles. Contacta a la clínica si necesitas ayuda."
        onLogout={() => void logout()}
      />
    );
  else if (area === "owner") content = <OwnerArea key={sessionKey} />;
  else
    content = (
      <StaffArea
        key={sessionKey}
        sessionKey={sessionKey}
        user={user}
        initialData={
          (initialSessionData ?? undefined) as InitialStaffData | undefined
        }
        onLogout={logout}
      />
    );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {storageWarning || logoutWarning ? (
        <View style={styles.notice}>
          {storageWarning ? (
            <Text accessibilityRole="alert" style={styles.noticeText}>
              {storageWarning}
            </Text>
          ) : null}
          {logoutWarning ? (
            <Text accessibilityRole="alert" style={styles.noticeText}>
              {logoutWarning}
            </Text>
          ) : null}
        </View>
      ) : null}
      <NavigationContainer
        key={navigationKey}
        documentTitle={{
          formatter: (_options, route) =>
            activation.link
              ? "Activar cuenta · GrownupsVet"
              : area
                ? `${areaTitles[area]} · GrownupsVet`
                : route?.name && authenticationTitles[route.name]
                  ? `${authenticationTitles[route.name]} | GrownupsVet`
                  : "GrownupsVet",
        }}
      >
        {content}
      </NavigationContainer>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  notice: {
    backgroundColor: colors.warningBackground,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noticeText: { color: colors.text, fontSize: typography.body },
});
