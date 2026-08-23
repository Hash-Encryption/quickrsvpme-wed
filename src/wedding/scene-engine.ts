import {
  getWeddingPrincipalLines,
  type WeddingEventData,
  type WeddingGuestData,
} from "./model.ts";
import type { WeddingSceneTiming } from "./presentation.ts";
export { weddingSceneIds } from "./presentation.ts";

export type WeddingRsvpStatus = "pending" | "accepted" | "declined";
export type { WeddingSceneTiming } from "./presentation.ts";

export type WeddingScene =
  | { id: "opening"; wording?: string }
  | { id: "hosts"; hostNames?: string; invitationWording?: string }
  | { id: "names"; lines: string[]; fallback?: string }
  | {
      id: "details";
      eventDay?: string;
      gregorianDate?: string;
      hijriDate?: string;
      startTime?: string;
      receptionTime?: string;
      dinnerTime?: string;
      venue?: string;
      city?: string;
      mapUrl?: string;
    }
  | {
      id: "rsvp";
      deadline?: string;
      guestName: string;
      allowedCompanions: number;
      status: WeddingRsvpStatus;
    };

const optional = (value: string) => value.trim() || undefined;

export function resolveWeddingScenes(
  event: WeddingEventData,
  guest: WeddingGuestData,
  status: WeddingRsvpStatus = "pending",
): WeddingScene[] {
  return [
    { id: "opening", wording: optional(event.openingWording) },
    {
      id: "hosts",
      hostNames: optional(event.hostNames),
      invitationWording: optional(event.invitationWording),
    },
    {
      id: "names",
      lines: getWeddingPrincipalLines(
        event,
        guest.invitationVariantOverride,
      ),
      fallback: optional(event.invitationWording),
    },
    {
      id: "details",
      eventDay: optional(event.eventDay),
      gregorianDate: optional(event.gregorianDate),
      hijriDate: optional(event.hijriDate),
      startTime: optional(event.startTime),
      receptionTime: optional(event.receptionTime),
      dinnerTime: optional(event.dinnerTime),
      venue: optional(event.venue),
      city: optional(event.city),
      mapUrl: optional(event.mapUrl),
    },
    {
      id: "rsvp",
      deadline: optional(event.rsvpDeadline),
      guestName: guest.name,
      allowedCompanions: guest.allowedCompanions,
      status,
    },
  ];
}

export function getWeddingSceneIndex(
  timings: ReadonlyArray<WeddingSceneTiming>,
  elapsed: number,
): number {
  const position = Math.max(0, elapsed);
  const next = timings.findIndex((scene) => scene.startsAt > position);
  return next < 0 ? Math.max(0, timings.length - 1) : Math.max(0, next - 1);
}

export function getWeddingRemainingDelay(
  timings: ReadonlyArray<WeddingSceneTiming>,
  elapsed: number,
): number | null {
  const next = timings.find((scene) => scene.startsAt > elapsed);
  return next ? Math.max(0, next.startsAt - elapsed) : null;
}
