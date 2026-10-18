import React from "react";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./auth/AuthContext";
import { RootNavigator } from "./navigation/RootNavigator";

export function PropietarioApp() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
