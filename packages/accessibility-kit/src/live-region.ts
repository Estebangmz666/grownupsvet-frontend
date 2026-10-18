import { AccessibilityInfo } from "react-native";

export type AnnouncementPriority = "polite" | "assertive";

export interface LiveRegionProps {
  accessibilityLiveRegion: AnnouncementPriority;
  accessible: true;
}

export function getLiveRegionProps(
  priority: AnnouncementPriority = "polite",
): LiveRegionProps {
  return {
    accessibilityLiveRegion: priority,
    accessible: true,
  };
}

export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
