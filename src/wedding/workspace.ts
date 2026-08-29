import {
  defaultWeddingEvent,
  mergeWeddingEvent,
  type WeddingEventData,
  type WeddingStyle,
  type WeddingVisualTemplateId,
} from "./model.ts";
import type { WeddingPresentation } from "./presentation.ts";
import type { WeddingVisualSelection } from "./upload.ts";

export const weddingWorkspaceSchemaVersion = 1 as const;
export const weddingLegacyMigrationVersion = 1;

export type WeddingProject = {
  version: 1;
  id: string;
  name: string;
  event: WeddingEventData;
  createdAt: string;
  updatedAt: string;
};

export type WeddingSavedDesign = {
  version: 1;
  id: string;
  name: string;
  templateId: WeddingVisualTemplateId;
  visual: WeddingVisualSelection;
  style: WeddingStyle;
  presentation: WeddingPresentation;
  createdAt: string;
  updatedAt: string;
};

export type WeddingWorkspaceMetadata = {
  schemaVersion: 1;
  activeProjectId: string | null;
  legacyMigrationVersion: number;
};

export type WeddingWorkspaceState = {
  projects: WeddingProject[];
  designs: WeddingSavedDesign[];
  activeProjectId: string;
  metadata: WeddingWorkspaceMetadata;
};

export type WeddingWorkspaceSnapshot = {
  projects: WeddingProject[];
  designs: WeddingSavedDesign[];
  metadata: WeddingWorkspaceMetadata | null;
};

export type WeddingWorkspaceCommit = {
  projects?: WeddingProject[];
  designs?: WeddingSavedDesign[];
  deleteProjectIds?: string[];
  deleteDesignIds?: string[];
  metadata?: WeddingWorkspaceMetadata;
};

export interface WeddingWorkspaceStorage {
  load(): Promise<WeddingWorkspaceSnapshot>;
  commit(change: WeddingWorkspaceCommit): Promise<void>;
}

export function createSerializedWeddingWorkspaceWriter(
  commit: (change: WeddingWorkspaceCommit) => Promise<void>,
): (change: WeddingWorkspaceCommit) => Promise<void> {
  let queue = Promise.resolve();
  return (change) => {
    const operation = queue.catch(() => undefined).then(() => commit(change));
    queue = operation;
    return operation;
  };
}

export class UnsupportedWeddingWorkspaceVersionError extends Error {
  constructor(version: unknown) {
    super(`Unsupported Wedding workspace schema version: ${String(version)}`);
    this.name = "UnsupportedWeddingWorkspaceVersionError";
  }
}

type FactoryOptions = { id?: string; now?: string };

const newId = () => crypto.randomUUID();
const newTimestamp = () => new Date().toISOString();
const cleanName = (name: string, fallback: string) => name.trim() || fallback;

export function createWeddingProject(
  event: Partial<WeddingEventData> = defaultWeddingEvent,
  name = "زفاف جديد",
  options: FactoryOptions = {},
): WeddingProject {
  const now = options.now ?? newTimestamp();
  return {
    version: 1,
    id: options.id ?? newId(),
    name: cleanName(name, "زفاف جديد"),
    event: mergeWeddingEvent(event),
    createdAt: now,
    updatedAt: now,
  };
}

export function renameWeddingProject(
  project: WeddingProject,
  name: string,
  now = newTimestamp(),
): WeddingProject {
  return { ...project, name: cleanName(name, project.name), updatedAt: now };
}

export function duplicateWeddingProject(
  project: WeddingProject,
  name = `${project.name} — نسخة`,
  options: FactoryOptions = {},
): WeddingProject {
  return createWeddingProject(project.event, name, options);
}

export function updateWeddingProjectEvent(
  project: WeddingProject,
  event: Partial<WeddingEventData>,
  now = newTimestamp(),
): WeddingProject {
  return { ...project, event: mergeWeddingEvent(event), updatedAt: now };
}

export function replaceWeddingProject(
  workspace: WeddingWorkspaceState,
  project: WeddingProject,
): WeddingWorkspaceState {
  return {
    ...workspace,
    projects: workspace.projects.map((item) => item.id === project.id ? project : item),
  };
}

export function addWeddingProject(
  workspace: WeddingWorkspaceState,
  project: WeddingProject,
): WeddingWorkspaceState {
  const metadata = { ...workspace.metadata, activeProjectId: project.id };
  return {
    ...workspace,
    projects: [...workspace.projects, project],
    activeProjectId: project.id,
    metadata,
  };
}

export function switchActiveWeddingProject(
  workspace: WeddingWorkspaceState,
  id: string,
): WeddingWorkspaceState {
  if (!workspace.projects.some((project) => project.id === id)) return workspace;
  const metadata = { ...workspace.metadata, activeProjectId: id };
  return { ...workspace, activeProjectId: id, metadata };
}

export function deleteWeddingProjectFromState(
  workspace: WeddingWorkspaceState,
  id: string,
  replacementOptions: FactoryOptions = {},
): WeddingWorkspaceState {
  const remaining = workspace.projects.filter((project) => project.id !== id);
  if (remaining.length) {
    const activeProjectId = workspace.activeProjectId === id ? remaining[0].id : workspace.activeProjectId;
    return {
      ...workspace,
      projects: remaining,
      activeProjectId,
      metadata: { ...workspace.metadata, activeProjectId },
    };
  }
  const replacement = createWeddingProject(defaultWeddingEvent, "زفاف جديد", replacementOptions);
  return {
    ...workspace,
    projects: [replacement],
    activeProjectId: replacement.id,
    metadata: { ...workspace.metadata, activeProjectId: replacement.id },
  };
}

export function createSavedDesignFromEvent(
  event: WeddingEventData,
  name: string,
  options: FactoryOptions = {},
): WeddingSavedDesign {
  const resolved = mergeWeddingEvent(event);
  const now = options.now ?? newTimestamp();
  return {
    version: 1,
    id: options.id ?? newId(),
    name: cleanName(name, "تصميم محفوظ"),
    templateId: resolved.templateId as WeddingVisualTemplateId,
    visual: structuredClone(resolved.visual),
    style: { ...resolved.style },
    presentation: structuredClone(resolved.presentation),
    createdAt: now,
    updatedAt: now,
  };
}

export function applySavedDesignToEvent(
  event: WeddingEventData,
  design: WeddingSavedDesign,
): WeddingEventData {
  return mergeWeddingEvent({
    ...event,
    templateId: design.templateId,
    visual: structuredClone(design.visual),
    style: { ...design.style },
    presentation: structuredClone(design.presentation),
  });
}

export function renameWeddingSavedDesign(
  design: WeddingSavedDesign,
  name: string,
  now = newTimestamp(),
): WeddingSavedDesign {
  return { ...design, name: cleanName(name, design.name), updatedAt: now };
}

function sanitizeProject(value: unknown): WeddingProject {
  if (!value || typeof value !== "object") throw new Error("Invalid Wedding project record.");
  const project = value as Partial<WeddingProject>;
  if (project.version !== 1) throw new UnsupportedWeddingWorkspaceVersionError(project.version);
  if (typeof project.id !== "string" || !project.id) throw new Error("Invalid Wedding project ID.");
  return {
    version: 1,
    id: project.id,
    name: cleanName(typeof project.name === "string" ? project.name : "", "زفاف"),
    event: mergeWeddingEvent(project.event),
    createdAt: typeof project.createdAt === "string" ? project.createdAt : newTimestamp(),
    updatedAt: typeof project.updatedAt === "string" ? project.updatedAt : newTimestamp(),
  };
}

function sanitizeDesign(value: unknown): WeddingSavedDesign {
  if (!value || typeof value !== "object") throw new Error("Invalid Wedding design record.");
  const design = value as Partial<WeddingSavedDesign>;
  if (design.version !== 1) throw new UnsupportedWeddingWorkspaceVersionError(design.version);
  if (typeof design.id !== "string" || !design.id) throw new Error("Invalid Wedding design ID.");
  const resolved = mergeWeddingEvent({
    templateId: design.templateId,
    visual: design.visual,
    style: design.style,
    presentation: design.presentation,
  });
  const sanitized = createSavedDesignFromEvent(
    resolved,
    typeof design.name === "string" ? design.name : "تصميم محفوظ",
    {
      id: design.id,
      now: typeof design.createdAt === "string" ? design.createdAt : newTimestamp(),
    },
  );
  return {
    ...sanitized,
    updatedAt: typeof design.updatedAt === "string" ? design.updatedAt : sanitized.updatedAt,
  };
}

export function normalizeWeddingWorkspace(
  snapshot: WeddingWorkspaceSnapshot,
): WeddingWorkspaceSnapshot {
  if (snapshot.metadata?.schemaVersion !== undefined && snapshot.metadata.schemaVersion !== 1) {
    throw new UnsupportedWeddingWorkspaceVersionError(snapshot.metadata.schemaVersion);
  }
  const validRecords = <T,>(values: unknown[], sanitize: (value: unknown) => T): T[] => values.flatMap((value) => {
    try {
      return [sanitize(value)];
    } catch (error) {
      if (error instanceof UnsupportedWeddingWorkspaceVersionError) throw error;
      return [];
    }
  });
  return {
    projects: validRecords(snapshot.projects, sanitizeProject),
    designs: validRecords(snapshot.designs, sanitizeDesign),
    metadata: snapshot.metadata,
  };
}

export function readLegacyWeddingEvent(raw: string | null): WeddingEventData | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { weddingEvent?: unknown };
    return value.weddingEvent && typeof value.weddingEvent === "object"
      ? mergeWeddingEvent(value.weddingEvent as Partial<WeddingEventData>)
      : null;
  } catch {
    return null;
  }
}

type InitializeOptions = FactoryOptions & { onMigrationCommitted?: () => void };

export async function initializeWeddingWorkspace(
  storage: WeddingWorkspaceStorage,
  legacyRaw: string | null,
  options: InitializeOptions = {},
): Promise<WeddingWorkspaceState> {
  const loaded = normalizeWeddingWorkspace(await storage.load());
  if (loaded.projects.length) {
    const activeProjectId = loaded.projects.some((item) => item.id === loaded.metadata?.activeProjectId)
      ? loaded.metadata!.activeProjectId!
      : loaded.projects[0].id;
    const metadata: WeddingWorkspaceMetadata = {
      schemaVersion: 1,
      activeProjectId,
      legacyMigrationVersion: Math.max(
        loaded.metadata?.legacyMigrationVersion ?? 0,
        weddingLegacyMigrationVersion,
      ),
    };
    if (
      loaded.metadata?.activeProjectId !== metadata.activeProjectId ||
      loaded.metadata?.legacyMigrationVersion !== metadata.legacyMigrationVersion
    ) {
      await storage.commit({ metadata });
    }
    options.onMigrationCommitted?.();
    return { projects: loaded.projects, designs: loaded.designs, activeProjectId, metadata };
  }

  const legacyEvent = readLegacyWeddingEvent(legacyRaw);
  const project = createWeddingProject(
    legacyEvent ?? defaultWeddingEvent,
    legacyEvent ? "زفافي" : "زفاف جديد",
    options,
  );
  const metadata: WeddingWorkspaceMetadata = {
    schemaVersion: 1,
    activeProjectId: project.id,
    legacyMigrationVersion: weddingLegacyMigrationVersion,
  };
  await storage.commit({ projects: [project], metadata });
  options.onMigrationCommitted?.();
  return { projects: [project], designs: loaded.designs, activeProjectId: project.id, metadata };
}
