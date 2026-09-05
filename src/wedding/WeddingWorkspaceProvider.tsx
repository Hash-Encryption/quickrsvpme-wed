import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { defaultWeddingEvent, mergeWeddingEvent, type WeddingEventData } from "./model.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { createDesignDraft, deleteDesignDraft, listDesignDrafts, listEventConfigs, publishArtwork, saveWeddingConfig, updateDesignDraft, uploadDraftArtwork, type DesignDraft } from "../backend/phase2.ts";
import { updateEvent } from "../backend/events.ts";
import { anonymousDesignTransferFailedEvent, anonymousDesignTransferKey, anonymousDesignTransferResultKey, anonymousDesignTransferredEvent, hasDraftTransferMarker, transferredDraftResult, withDraftTransferMarker } from "./anonymous-transfer.ts";
import { IndexedDbWeddingWorkspaceStorage } from "./workspace-storage.ts";
import {
  applySavedDesignToEvent,
  createSerializedWeddingWorkspaceWriter,
  createSavedDesignFromEvent,
  createWeddingProject,
  duplicateWeddingProject,
  initializeWeddingWorkspace,
  readLegacyWeddingEvent,
  renameWeddingProject,
  renameWeddingSavedDesign,
  updateWeddingProjectEvent,
  type WeddingProject,
  type WeddingSavedDesign,
  type WeddingWorkspaceCommit,
  type WeddingWorkspaceState,
  type WeddingWorkspaceStorage,
} from "./workspace.ts";
import { useLocation } from "wouter";

type SaveStatus = "saving" | "saved" | "error";

type WeddingWorkspaceContextValue = {
  ready: boolean;
  projects: WeddingProject[];
  designs: WeddingSavedDesign[];
  activeProject: WeddingProject;
  saveStatus: SaveStatus;
  storageError: string;
  preserveLegacyWedding: boolean;
  updateActiveEvent: (event: WeddingEventData) => void;
  saveNow: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (name: string) => Promise<void>;
  duplicateProject: (name?: string) => Promise<void>;
  deleteProject: () => Promise<void>;
  saveCurrentDesign: (name: string) => Promise<void>;
  applyDesign: (id: string) => void;
  renameDesign: (id: string, name: string) => Promise<void>;
  deleteDesign: (id: string) => Promise<void>;
  openDraft: (id: string) => Promise<void>;
};

const WeddingWorkspaceContext = createContext<WeddingWorkspaceContextValue | null>(null);
const legacyStorageKey = "luxury-rsvp-engine";

function removeLegacyWeddingEvent(): void {
  try {
    const raw = localStorage.getItem(legacyStorageKey);
    if (!raw) return;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!("weddingEvent" in value)) return;
    delete value.weddingEvent;
    localStorage.setItem(legacyStorageKey, JSON.stringify(value));
  } catch {
    // IndexedDB already owns the Wedding; generic persistence will retry the cleanup.
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "تعذر حفظ مساحة عمل الزفاف.";
}

export function WeddingWorkspaceProvider({
  children,
  storage = new IndexedDbWeddingWorkspaceStorage(),
}: {
  children: ReactNode;
  storage?: WeddingWorkspaceStorage;
}) {
  const auth = useAuth();
  const [location] = useLocation();
  const backendHydrationActive = location.startsWith("/weddings/") || location === "/studio/wedding";
  const fallbackRef = useRef(createWeddingProject(defaultWeddingEvent));
  const [workspace, setWorkspaceState] = useState<WeddingWorkspaceState | null>(null);
  const workspaceRef = useRef<WeddingWorkspaceState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [storageError, setStorageError] = useState("");
  const [preserveLegacyWedding, setPreserveLegacyWedding] = useState(false);
  const storageRef = useRef(storage);
  const storageBlockedRef = useRef<Error | null>(null);
  const writerRef = useRef(createSerializedWeddingWorkspaceWriter((change) => {
    if (storageBlockedRef.current) return Promise.reject(storageBlockedRef.current);
    return storageRef.current.commit(change);
  }));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editVersionRef = useRef(0);
  const backendVersionsRef = useRef(new Map<string, number>());
  const backendTemplatesRef = useRef(new Map<string, string | null>());
  const backendTemplateKeysRef = useRef(new Map<string, string | null>());
  const backendArtworkRef = useRef(new Map<string, string | null>());
  const backendConfigurationSignaturesRef = useRef(new Map<string, string>());
  const backendEventMetadataSignaturesRef = useRef(new Map<string, string>());
  const uploadedArtworkRef = useRef(new Map<string, { id: string; publicUrl: string }>());
  const backendDraftsRef = useRef(new Map<string, DesignDraft<Record<string, unknown>>>());
  const transferRef = useRef<Promise<string | null> | null>(null);
  const authenticatedUserRef = useRef<string | null>(null);

  const setWorkspace = useCallback((next: WeddingWorkspaceState) => {
    workspaceRef.current = next;
    setWorkspaceState(next);
  }, []);

  const enqueue = useCallback((change: WeddingWorkspaceCommit, editVersion?: number) => {
    setSaveStatus("saving");
    setStorageError("");
    const operation = writerRef.current(change);
    return operation.then(
      () => {
        if (editVersion === undefined || editVersion === editVersionRef.current) setSaveStatus("saved");
      },
      (error) => {
        setSaveStatus("error");
        setStorageError(errorMessage(error));
        throw error;
      },
    );
  }, []);

  useEffect(() => {
    let live = true;
    let legacyRaw: string | null = null;
    try {
      legacyRaw = localStorage.getItem(legacyStorageKey);
    } catch {
      // IndexedDB remains the Wedding authority when legacy storage is unavailable.
    }
    initializeWeddingWorkspace(storageRef.current, legacyRaw, { onMigrationCommitted: removeLegacyWeddingEvent })
      .then((next) => {
        if (live) setWorkspace(next);
      })
      .catch((error) => {
        if (!live) return;
        storageBlockedRef.current = error instanceof Error ? error : new Error("Unable to load the Wedding workspace.");
        const project = createWeddingProject(readLegacyWeddingEvent(legacyRaw) ?? defaultWeddingEvent, "زفافي");
        setWorkspace({
          projects: [project],
          designs: [],
          activeProjectId: project.id,
          metadata: { schemaVersion: 1, activeProjectId: project.id, legacyMigrationVersion: 0 },
        });
        setPreserveLegacyWedding(true);
        setSaveStatus("error");
        setStorageError(errorMessage(error));
      });
    return () => {
      live = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [setWorkspace]);

  useEffect(() => {
    if (auth.session) {
      authenticatedUserRef.current = auth.session.user.id;
      return;
    }
    if (auth.loading || !authenticatedUserRef.current) return;
    authenticatedUserRef.current = null;
    backendDraftsRef.current.clear();
    backendVersionsRef.current.clear();
    backendConfigurationSignaturesRef.current.clear();
    backendEventMetadataSignaturesRef.current.clear();
    initializeWeddingWorkspace(storageRef.current, null).then(setWorkspace).catch((error) => {
      setSaveStatus("error");
      setStorageError(errorMessage(error));
    });
  }, [auth.loading, auth.session, setWorkspace]);

  useEffect(() => {
    if (!backendHydrationActive || !auth.session || auth.loading) return;
    const events = auth.events.filter((event) => event.product_id === "wedding" && !event.deleted_at);
    let live = true;
    const transfer = async () => {
      if (sessionStorage.getItem(anonymousDesignTransferKey) !== "wedding") return null;
      const current = workspaceRef.current;
      const source = current?.projects.find((project) => project.id === current.activeProjectId);
      if (!source) return null;
      const drafts = await listDesignDrafts<Record<string, unknown>>("wedding");
      let draft = drafts.find((item) => hasDraftTransferMarker(item.configuration, source.id));
      if (!draft) {
        const configuration = withDraftTransferMarker(structuredClone(source.event) as WeddingEventData & Record<string, unknown>, source.id);
        draft = await createDesignDraft("wedding", source.name, configuration);
        if (source.event.visual.source === "uploaded-background" && source.event.visual.uploadedBackground.dataUrl.startsWith("data:")) {
          const artworkId = await uploadDraftArtwork(draft.id, source.event.visual.uploadedBackground.dataUrl, source.event.visual.uploadedBackground.mimeType);
          draft = { ...draft, artwork_asset_id: artworkId };
        }
      }
      sessionStorage.setItem(anonymousDesignTransferResultKey, transferredDraftResult("wedding", draft.id));
      sessionStorage.removeItem(anonymousDesignTransferKey);
      await enqueue({ deleteProjectIds: [source.id] });
      window.dispatchEvent(new Event(anonymousDesignTransferredEvent));
      return draft.id;
    };
    transferRef.current ??= transfer().finally(() => { transferRef.current = null; });
    void transferRef.current.then((transferredDraftId) => Promise.all([listEventConfigs<Partial<WeddingEventData>>("wedding"), listDesignDrafts<Partial<WeddingEventData>>("wedding")]).then(async ([configs, drafts]) => {
      if (!live) return;
      const byEvent = new Map(configs.map((config) => [config.event_id, config]));
      const projects = events.map((event) => {
        const config = byEvent.get(event.id);
        backendVersionsRef.current.set(event.id, config?.version ?? 0);
        backendTemplatesRef.current.set(event.id, config?.template_version_id ?? null);
        backendTemplateKeysRef.current.set(event.id, typeof config?.template_snapshot.templateId === "string" ? config.template_snapshot.templateId : null);
        backendArtworkRef.current.set(event.id, config?.artwork_asset_id ?? null);
        const project = createWeddingProject({ ...config?.configuration, invitationLocale: event.invitation_locale, venue: event.venue_name ?? config?.configuration.venue, city: event.city ?? config?.configuration.city }, event.title, { id: event.id, now: event.created_at });
        backendConfigurationSignaturesRef.current.set(event.id, JSON.stringify(project.event));
        backendEventMetadataSignaturesRef.current.set(event.id, JSON.stringify({ title: event.title, invitation_locale: event.invitation_locale, venue_name: event.venue_name, city: event.city }));
        return project;
      });
      const draftProjects = drafts.map((draft) => {
        backendDraftsRef.current.set(draft.id, draft as DesignDraft<Record<string, unknown>>);
        return createWeddingProject(mergeWeddingEvent(draft.configuration), draft.title, { id: draft.id, now: draft.created_at });
      });
      const current = workspaceRef.current;
      const allProjects = [...projects, ...draftProjects];
      if (!allProjects.length) return;
      await enqueue({ deleteProjectIds: allProjects.map((project) => project.id) });
      const activeProjectId = transferredDraftId ?? (allProjects.some((project) => project.id === current?.activeProjectId) ? current!.activeProjectId : allProjects[0].id);
      setWorkspace({ projects: allProjects, designs: current?.designs ?? [], activeProjectId, metadata: { schemaVersion: 1, activeProjectId, legacyMigrationVersion: 1 } });
    })).catch((error) => {
      if (!live) return;
      setSaveStatus("error");
      setStorageError(errorMessage(error));
      window.dispatchEvent(new CustomEvent(anonymousDesignTransferFailedEvent, { detail: errorMessage(error) }));
    });
    return () => { live = false; };
  }, [auth.events, auth.loading, auth.session, backendHydrationActive, enqueue, setWorkspace]);

  const saveBackendProject = useCallback(async (project: WeddingProject) => {
    if (!auth.session) return;
    const configuration = structuredClone(project.event) as WeddingEventData & Record<string, unknown>;
    const draft = backendDraftsRef.current.get(project.id);
    if (draft) {
      let currentDraft = draft;
      let artworkId = draft.artwork_asset_id;
      if (!artworkId && configuration.visual.source === "uploaded-background" && configuration.visual.uploadedBackground.dataUrl.startsWith("data:")) {
        artworkId = await uploadDraftArtwork(draft.id, configuration.visual.uploadedBackground.dataUrl, configuration.visual.uploadedBackground.mimeType);
        currentDraft = (await listDesignDrafts<Record<string, unknown>>("wedding")).find((item) => item.id === draft.id) ?? draft;
      }
      const saved = await updateDesignDraft({ ...currentDraft, artwork_asset_id: artworkId }, project.name, configuration);
      backendDraftsRef.current.set(project.id, { ...saved, artwork_asset_id: artworkId });
      return;
    }
    if (!auth.events.some((event) => event.id === project.id)) return;
    const configurationSignature = JSON.stringify(project.event);
    if (backendConfigurationSignaturesRef.current.get(project.id) !== configurationSignature) {
      let artworkId = backendArtworkRef.current.get(project.id) ?? null;
      if (configuration.visual.source === "uploaded-background" && configuration.visual.uploadedBackground.dataUrl.startsWith("data:")) {
        const dataUrl = configuration.visual.uploadedBackground.dataUrl;
        const artwork = uploadedArtworkRef.current.get(dataUrl) ?? await publishArtwork(project.id, dataUrl, configuration.visual.uploadedBackground.mimeType);
        artworkId = artwork.id;
        uploadedArtworkRef.current.set(dataUrl, artwork);
        configuration.visual.uploadedBackground.dataUrl = artwork.publicUrl;
      }
      const existingTemplateId = backendTemplateKeysRef.current.get(project.id) === project.event.templateId ? backendTemplatesRef.current.get(project.id) : null;
      const saved = await saveWeddingConfig(project.id, configuration, backendVersionsRef.current.get(project.id) ?? 0, artworkId, existingTemplateId);
      backendVersionsRef.current.set(project.id, saved.version);
      backendTemplatesRef.current.set(project.id, saved.template_version_id);
      backendTemplateKeysRef.current.set(project.id, project.event.templateId);
      backendArtworkRef.current.set(project.id, saved.artwork_asset_id ?? artworkId);
      backendConfigurationSignaturesRef.current.set(project.id, configurationSignature);
    }
    const eventMetadata = { title: project.name, invitation_locale: project.event.invitationLocale, venue_name: project.event.venue || null, city: project.event.city || null };
    const eventMetadataSignature = JSON.stringify(eventMetadata);
    if (backendEventMetadataSignaturesRef.current.get(project.id) !== eventMetadataSignature) {
      await updateEvent(project.id, eventMetadata);
      backendEventMetadataSignaturesRef.current.set(project.id, eventMetadataSignature);
    }
  }, [auth.events, auth.session]);

  const activeProject = useCallback(() => {
    const current = workspaceRef.current;
    if (!current) return fallbackRef.current;
    return current.projects.find((project) => project.id === current.activeProjectId) ?? current.projects[0];
  }, []);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const version = editVersionRef.current;
    const project = activeProject();
    const localSave = auth.session && (backendDraftsRef.current.has(project.id) || auth.events.some((event) => event.id === project.id)) ? Promise.resolve() : enqueue({ projects: [project] }, version);
    await Promise.all([localSave, saveBackendProject(project)]);
  }, [activeProject, auth.events, auth.session, enqueue, saveBackendProject]);

  const updateActiveEvent = useCallback((event: WeddingEventData) => {
    const current = workspaceRef.current;
    if (!current) return;
    const updated = updateWeddingProjectEvent(activeProject(), event);
    const next = {
      ...current,
      projects: current.projects.map((project) => project.id === updated.id ? updated : project),
    };
    setWorkspace(next);
    const version = ++editVersionRef.current;
    setSaveStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const localSave = auth.session && (backendDraftsRef.current.has(updated.id) || auth.events.some((item) => item.id === updated.id)) ? Promise.resolve() : enqueue({ projects: [updated] }, version);
      void Promise.all([localSave, saveBackendProject(updated)]).catch((error) => {
        setSaveStatus("error");
        setStorageError(errorMessage(error));
      });
    }, 2000);
  }, [activeProject, auth.events, auth.session, enqueue, saveBackendProject, setWorkspace]);

  const createProject = useCallback(async (name: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    let project = createWeddingProject(defaultWeddingEvent, name);
    if (auth.session) {
      const draft = await createDesignDraft("wedding", name, structuredClone(project.event) as WeddingEventData & Record<string, unknown>);
      backendDraftsRef.current.set(draft.id, draft);
      project = createWeddingProject(draft.configuration, draft.title, { id: draft.id, now: draft.created_at });
    }
    const metadata = { ...current.metadata, activeProjectId: project.id };
    if (!auth.session) await enqueue({ projects: [project], metadata });
    setWorkspace({ ...current, projects: [...current.projects, project], activeProjectId: project.id, metadata });
  }, [auth.session, enqueue, saveNow, setWorkspace]);

  const openProject = useCallback(async (id: string) => {
    const current = workspaceRef.current!;
    if (id === current.activeProjectId || !current.projects.some((project) => project.id === id)) return;
    await saveNow();
    const latest = workspaceRef.current!;
    const metadata = { ...latest.metadata, activeProjectId: id };
    if (!auth.session) await enqueue({ metadata });
    setWorkspace({ ...latest, activeProjectId: id, metadata });
  }, [auth.session, enqueue, saveNow, setWorkspace]);

  const renameProject = useCallback(async (name: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    const project = renameWeddingProject(activeProject(), name);
    if (!auth.session) await enqueue({ projects: [project] });
    else await saveBackendProject(project);
    setWorkspace({ ...current, projects: current.projects.map((item) => item.id === project.id ? project : item) });
  }, [activeProject, auth.session, enqueue, saveBackendProject, saveNow, setWorkspace]);

  const duplicateProject = useCallback(async (name?: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    let project = duplicateWeddingProject(activeProject(), name);
    if (auth.session) {
      const draft = await createDesignDraft("wedding", project.name, structuredClone(project.event) as WeddingEventData & Record<string, unknown>);
      backendDraftsRef.current.set(draft.id, draft);
      project = createWeddingProject(draft.configuration, draft.title, { id: draft.id, now: draft.created_at });
    }
    const metadata = { ...current.metadata, activeProjectId: project.id };
    if (!auth.session) await enqueue({ projects: [project], metadata });
    setWorkspace({ ...current, projects: [...current.projects, project], activeProjectId: project.id, metadata });
  }, [activeProject, auth.session, enqueue, saveNow, setWorkspace]);

  const deleteProject = useCallback(async () => {
    await saveNow();
    const current = workspaceRef.current!;
    const deleting = activeProject();
    const remaining = current.projects.filter((project) => project.id !== deleting.id);
    const replacement = remaining[0] ?? createWeddingProject(defaultWeddingEvent);
    const projects = remaining.length ? remaining : [replacement];
    const metadata = { ...current.metadata, activeProjectId: replacement.id };
    if (backendDraftsRef.current.has(deleting.id)) {
      await deleteDesignDraft(deleting.id);
      backendDraftsRef.current.delete(deleting.id);
    }
    if (!auth.session) await enqueue({
      projects: remaining.length ? undefined : [replacement],
      deleteProjectIds: [deleting.id],
      metadata,
    });
    setWorkspace({ ...current, projects, activeProjectId: replacement.id, metadata });
  }, [activeProject, auth.session, enqueue, saveNow, setWorkspace]);

  const openDraft = useCallback(async (id: string) => {
    const draft = (await listDesignDrafts<Record<string, unknown>>("wedding")).find((item) => item.id === id);
    if (!draft) throw new Error("Design Draft not found.");
    backendDraftsRef.current.set(id, draft);
    const current = workspaceRef.current!;
    const project = createWeddingProject(mergeWeddingEvent(draft.configuration), draft.title, { id: draft.id, now: draft.created_at });
    const projects = current.projects.some((item) => item.id === id) ? current.projects.map((item) => item.id === id ? project : item) : [...current.projects, project];
    setWorkspace({ ...current, projects, activeProjectId: id, metadata: { ...current.metadata, activeProjectId: id } });
  }, [setWorkspace]);

  const saveCurrentDesign = useCallback(async (name: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    let design = createSavedDesignFromEvent(activeProject().event, name);
    if (auth.session) {
      const record = await createDesignDraft("wedding", name, { templateId: design.templateId, visual: design.visual, style: design.style, presentation: design.presentation });
      backendDraftsRef.current.set(record.id, record);
      design = { ...design, id: record.id, createdAt: record.created_at, updatedAt: record.updated_at };
    } else await enqueue({ designs: [design] });
    setWorkspace({ ...current, designs: [...current.designs, design] });
  }, [activeProject, auth.session, enqueue, saveNow, setWorkspace]);

  const applyDesign = useCallback((id: string) => {
    const current = workspaceRef.current;
    const design = current?.designs.find((item) => item.id === id);
    if (!design) return;
    updateActiveEvent(applySavedDesignToEvent(activeProject().event, design));
  }, [activeProject, updateActiveEvent]);

  const renameDesign = useCallback(async (id: string, name: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    const existing = current.designs.find((design) => design.id === id);
    if (!existing) return;
    const design = renameWeddingSavedDesign(existing, name);
    const backend = backendDraftsRef.current.get(id);
    if (auth.session && backend) backendDraftsRef.current.set(id, await updateDesignDraft(backend, name, backend.configuration));
    else await enqueue({ designs: [design] });
    setWorkspace({ ...current, designs: current.designs.map((item) => item.id === id ? design : item) });
  }, [auth.session, enqueue, saveNow, setWorkspace]);

  const deleteDesign = useCallback(async (id: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    if (auth.session) await deleteDesignDraft(id); else await enqueue({ deleteDesignIds: [id] });
    setWorkspace({ ...current, designs: current.designs.filter((design) => design.id !== id) });
  }, [auth.session, enqueue, saveNow, setWorkspace]);

  const value = useMemo<WeddingWorkspaceContextValue>(() => ({
    ready: Boolean(workspace),
    projects: workspace?.projects ?? [fallbackRef.current],
    designs: workspace?.designs ?? [],
    activeProject: workspace ? workspace.projects.find((project) => project.id === workspace.activeProjectId) ?? workspace.projects[0] : fallbackRef.current,
    saveStatus,
    storageError,
    preserveLegacyWedding,
    updateActiveEvent,
    saveNow,
    createProject,
    openProject,
    renameProject,
    duplicateProject,
    deleteProject,
    saveCurrentDesign,
    applyDesign,
    renameDesign,
    deleteDesign,
    openDraft,
  }), [workspace, saveStatus, storageError, preserveLegacyWedding, updateActiveEvent, saveNow, createProject, openProject, renameProject, duplicateProject, deleteProject, saveCurrentDesign, applyDesign, renameDesign, deleteDesign, openDraft]);

  return <WeddingWorkspaceContext.Provider value={value}>{workspace ? children : null}</WeddingWorkspaceContext.Provider>;
}

export function useWeddingWorkspace(): WeddingWorkspaceContextValue {
  const value = useContext(WeddingWorkspaceContext);
  if (!value) throw new Error("Wedding workspace context unavailable.");
  return value;
}
