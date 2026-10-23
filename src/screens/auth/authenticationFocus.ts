import { Platform } from "react-native";
import type { RefObject } from "react";

interface FocusableAuthenticationElement {
  focus: () => void;
}

export function focusAuthenticationElement(
  element: RefObject<FocusableAuthenticationElement | null>,
  id: string,
): void {
  if (Platform.OS === "web") {
    requestAnimationFrame(() => document.getElementById(id)?.focus());
    return;
  }
  element.current?.focus();
}

export const focusAuthenticationFeedback = focusAuthenticationElement;
