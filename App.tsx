import { AuthenticationProvider } from "@grownupsvet/authentication";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { API_BASE_URL } from "./src/config/api";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { loadInitialSession } from "./src/session/loadInitialSession";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthenticationProvider
        baseUrl={API_BASE_URL}
        loadInitialSession={loadInitialSession}
      >
        <RootNavigator />
        <StatusBar style="dark" />
      </AuthenticationProvider>
    </SafeAreaProvider>
  );
}
