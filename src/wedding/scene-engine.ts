import {
  getWeddingPrincipalLines,
  type WeddingEventData,
  type WeddingGuestData,
} from "./model.ts";
import type { WeddingSceneTiming } from "./presentation.ts";
export { weddingSceneIds } from "./presentation.ts";

export type WeddingRsvpStatus = "pending" | "accepted" | "declined";
export type { WeddingSceneTiming } from "./presentation.ts";

export type WeddingSemanticBlock =
  | { id: "opening"; text: string }
  | { id: "occasion"; text: string }
  | { id: "hosts"; text: string }
  | { id: "principals"; lines: string[] }
  | {
      id: "date-time";
      eventDay?: string;
      gregorianDate?: string;
      hijriDate?: string;
      startTime?: string;
      receptionTime?: string;
      dinnerTime?: string;
    }
  | { id: "venue"; venue?: string; city?: string; mapUrl?: string }
  | {
      id: "rsvp";
      deadline?: string;
      guestName: string;
      allowedCompanions: number;
      status: WeddingRsvpStatus;
    };

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

export function resolveWeddingSemanticBlocks(
  event: WeddingEventData,
  guest: WeddingGuestData,
  status: WeddingRsvpStatus = "pending",
): WeddingSemanticBlock[] {
  const principalLines = getWeddingPrincipalLines(event, guest.invitationVariantOverride);
  const blocks: Array<WeddingSemanticBlock | undefined> = [
    optional(event.openingWording)
      ? { id: "opening", text: event.openingWording.trim() }
      : undefined,
    optional(event.invitationWording)
      ? { id: "occasion", text: event.invitationWording.trim() }
      : undefined,
    optional(event.hostNames || event.familyNames)
      ? { id: "hosts", text: (event.hostNames || event.familyNames).trim() }
      : undefined,
    principalLines.length
      ? { id: "principals", lines: principalLines }
      : undefined,
    [event.eventDay, event.gregorianDate, event.hijriDate, event.startTime, event.receptionTime, event.dinnerTime].some(optional)
      ? {
          id: "date-time",
          eventDay: optional(event.eventDay),
          gregorianDate: optional(event.gregorianDate),
          hijriDate: optional(event.hijriDate),
          startTime: optional(event.startTime),
          receptionTime: optional(event.receptionTime),
          dinnerTime: optional(event.dinnerTime),
        }
      : undefined,
    [event.venue, event.city, event.mapUrl].some(optional)
      ? {
          id: "venue",
          venue: optional(event.venue),
          city: optional(event.city),
          mapUrl: optional(event.mapUrl),
        }
      : undefined,
    {
      id: "rsvp",
      deadline: optional(event.rsvpDeadline),
      guestName: guest.name,
      allowedCompanions: guest.allowedCompanions,
      status,
    },
  ];
  return blocks.filter((block): block is WeddingSemanticBlock => Boolean(block));
}

export function resolveWeddingScenes(
  event: WeddingEventData,
  guest: WeddingGuestData,
  status: WeddingRsvpStatus = "pending",
): WeddingScene[] {
  const blocks = resolveWeddingSemanticBlocks(event, guest, status);
  const block = <T extends WeddingSemanticBlock["id"]>(id: T) =>
    blocks.find((item): item is Extract<WeddingSemanticBlock, { id: T }> => item.id === id);
  const opening = block("opening");
  const occasion = block("occasion");
  const hosts = block("hosts");
  const principals = block("principals");
  const dateTime = block("date-time");
  const venue = block("venue");
  const rsvp = block("rsvp")!;
  return [
    { id: "opening", wording: opening?.text },
    {
      id: "hosts",
      hostNames: hosts?.text,
      invitationWording: occasion?.text,
    },
    {
      id: "names",
      lines: principals?.lines ?? [],
      fallback: occasion?.text,
    },
    {
      id: "details",
      eventDay: dateTime?.eventDay,
      gregorianDate: dateTime?.gregorianDate,
      hijriDate: dateTime?.hijriDate,
      startTime: dateTime?.startTime,
      receptionTime: dateTime?.receptionTime,
      dinnerTime: dateTime?.dinnerTime,
      venue: venue?.venue,
      city: venue?.city,
      mapUrl: venue?.mapUrl,
    },
    {
      id: "rsvp",
      deadline: rsvp.deadline,
      guestName: rsvp.guestName,
      allowedCompanions: rsvp.allowedCompanions,
      status: rsvp.status,
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
