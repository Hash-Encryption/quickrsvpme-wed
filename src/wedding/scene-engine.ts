import {
  getWeddingPrincipalLines,
  type WeddingEventData,
  type WeddingGuestData,
} from "./model.ts";
import type {
  WeddingMotionPreset,
  WeddingSceneId,
  WeddingSceneTiming,
} from "./presentation.ts";
export { weddingSceneIds } from "./presentation.ts";

export type WeddingRsvpStatus = "pending" | "accepted" | "declined";
export type { WeddingSceneTiming } from "./presentation.ts";

export const weddingTimelineEnd = 18_000;

export type WeddingChoreographyItem = {
  block: WeddingSemanticBlock;
  entersAt: number;
  phase: "pending" | "entering" | "active";
  role: "hero" | "supporting" | "detail" | "action";
  retained: boolean;
};

export type WeddingChoreographyFrame = {
  sceneId: WeddingSceneId;
  elapsed: number;
  behavior: WeddingMotionPreset["behavior"];
  direction: "rtl" | "ltr";
  items: WeddingChoreographyItem[];
  density: "normal" | "compact" | "dense";
  final: boolean;
  backgroundMotion: "still" | "restrained";
};

type ChoreographyOptions = {
  direction?: "rtl" | "ltr";
  reduceMotion?: boolean;
  settleScene?: boolean;
  artworkMode?: "template" | "fit" | "fill";
};

const semanticScenes: Record<WeddingSemanticBlock["id"], WeddingSceneId> = {
  opening: "opening",
  occasion: "hosts",
  hosts: "hosts",
  principals: "names",
  "date-time": "details",
  venue: "details",
  rsvp: "rsvp",
};

const sceneStarts: Record<WeddingSceneId, number> = {
  opening: 0,
  hosts: 3_000,
  names: 6_000,
  details: 10_000,
  rsvp: 14_000,
};

const sceneOrder: WeddingSceneId[] = ["opening", "hosts", "names", "details", "rsvp"];

function blockLength(block: WeddingSemanticBlock): number {
  if ("text" in block) return block.text.length;
  if (block.id === "principals") return block.lines.join("").length;
  return Object.values(block).filter((value) => typeof value === "string").join("").length;
}

function roleFor(block: WeddingSemanticBlock, sceneId: WeddingSceneId) {
  if (block.id === "principals") return sceneId === "names" ? "hero" as const : "supporting" as const;
  if (block.id === "date-time" || block.id === "venue") return "detail" as const;
  if (block.id === "rsvp") return "action" as const;
  return "supporting" as const;
}

function cueSchedule(blocks: ReadonlyArray<WeddingSemanticBlock>) {
  const cues = new Map<WeddingSemanticBlock["id"], number>();
  for (const sceneId of sceneOrder) {
    const present = blocks.filter((block) => semanticScenes[block.id] === sceneId);
    present.forEach((block, index) => cues.set(block.id, sceneStarts[sceneId] + index * 320));
  }
  return cues;
}

export function resolveWeddingChoreographyBoundaries(
  blocks: ReadonlyArray<WeddingSemanticBlock>,
): number[] {
  const cues = cueSchedule(blocks);
  const boundaries = new Set<number>([
    ...Object.values(sceneStarts),
    weddingTimelineEnd,
    ...cues.values(),
  ]);
  return [...boundaries].filter((value) => value <= weddingTimelineEnd).sort((a, b) => a - b);
}

export function resolveWeddingChoreography(
  blocks: ReadonlyArray<WeddingSemanticBlock>,
  motionPreset: WeddingMotionPreset,
  elapsed: number,
  options: ChoreographyOptions = {},
): WeddingChoreographyFrame {
  const position = options.reduceMotion
    ? weddingTimelineEnd
    : Math.max(0, Math.min(weddingTimelineEnd, elapsed));
  const sceneId = sceneOrder[getWeddingSceneIndex(
    sceneOrder.map((id) => ({ id, startsAt: sceneStarts[id] })),
    position,
  )];
  const final = position >= weddingTimelineEnd;
  const cues = cueSchedule(blocks);
  const sceneIndex = sceneOrder.indexOf(sceneId);
  const items = blocks
    .map((block) => ({
      block,
      entersAt: cues.get(block.id)!,
      retained: sceneOrder.indexOf(semanticScenes[block.id]) < sceneIndex,
      role: roleFor(block, sceneId),
      phase: cues.get(block.id)! > position
        ? "pending" as const
        : options.settleScene
        ? "active" as const
        : position < cues.get(block.id)! + motionPreset.enterDurationMs
          ? "entering" as const
          : "active" as const,
    }));
  const length = blocks.reduce((total, block) => total + blockLength(block), 0);
  const density = blocks.length >= 7 || length > 220
    ? "dense" as const
    : blocks.length >= 5 || length > 140
      ? "compact" as const
      : "normal" as const;
  const artworkMode = options.artworkMode ?? "template";
  return {
    sceneId,
    elapsed: position,
    behavior: motionPreset.behavior,
    direction: options.direction ?? "rtl",
    items,
    density,
    final,
    backgroundMotion:
      !options.reduceMotion && motionPreset.behavior === "cinematic" && artworkMode !== "fit"
        ? "restrained"
        : "still",
  };
}

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
