export type AnnouncementPriority = "polite" | "assertive";

export interface AriaAnnouncementProps {
  role: "status" | "alert";
  "aria-live": AnnouncementPriority;
  "aria-atomic": true;
  "aria-label": string;
}

export function getAriaAnnouncementProps(
  message: string,
  priority: AnnouncementPriority = "polite",
): AriaAnnouncementProps {
  return {
    role: priority === "assertive" ? "alert" : "status",
    "aria-live": priority,
    "aria-atomic": true,
    "aria-label": message,
  };
}
