import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { ForgotPasswordRequestScreen } from "../screens/auth/ForgotPasswordRequestScreen";
import { ForgotPasswordVerifyScreen } from "../screens/auth/ForgotPasswordVerifyScreen";
import { ForgotPasswordResetScreen } from "../screens/auth/ForgotPasswordResetScreen";

export type AuthenticationStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPasswordRequest: undefined;
  ForgotPasswordVerify: { email: string };
  ForgotPasswordReset: { resetToken: string; expiresAt?: number };
};
export type AuthenticationScreenProps<
  RouteName extends keyof AuthenticationStackParamList,
> = NativeStackScreenProps<AuthenticationStackParamList, RouteName>;
const Stack = createNativeStackNavigator<AuthenticationStackParamList>();

export function AuthenticationNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="ForgotPasswordRequest"
        component={ForgotPasswordRequestScreen}
      />
      <Stack.Screen
        name="ForgotPasswordVerify"
        component={ForgotPasswordVerifyScreen}
      />
      <Stack.Screen
        name="ForgotPasswordReset"
        component={ForgotPasswordResetScreen}
      />
    </Stack.Navigator>
  );
}
