/// <reference types="expo/types" />

import { Platform } from "react-native";

// Expo substitutes this public setting at build time. It never contains credentials.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === "web" ? "/api/v1" : "http://localhost:8080/api/v1");
