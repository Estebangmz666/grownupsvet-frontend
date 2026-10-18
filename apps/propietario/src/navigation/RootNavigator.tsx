import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { ErrorState, LoadingState } from "@grownupsvet/accessibility-kit";
import { useAuth } from "../auth/useAuth";
import { AuthStack } from "./AuthStack";
import { MainTabs } from "./MainTabs";

export function RootNavigator() {
  const { status, initializationError, retrySessionCheck } = useAuth();

  if (status === "checking") {
    return <LoadingState message="Cargando..." />;
  }

  if (initializationError) {
    return (
      <ErrorState
        message={initializationError}
        onRetry={retrySessionCheck}
        retryLabel="Intentar de nuevo"
      />
    );
  }

  return (
    <NavigationContainer>
      {status === "signedIn" ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
