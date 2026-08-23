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
import { defaultWeddingEvent, type WeddingEventData } from "./model.ts";
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
};

const WeddingWorkspaceContext = createContext<WeddingWorkspaceContextValue | null>(null);
const legacyStorageKey = "luxury-rsvp-engine";

function removeLegacyWeddingEvent(): void {
  const raw = localStorage.getItem(legacyStorageKey);
  if (!raw) return;
  try {
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
    const legacyRaw = localStorage.getItem(legacyStorageKey);
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

  const activeProject = useCallback(() => {
    const current = workspaceRef.current;
    if (!current) return fallbackRef.current;
    return current.projects.find((project) => project.id === current.activeProjectId) ?? current.projects[0];
  }, []);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const version = editVersionRef.current;
    await enqueue({ projects: [activeProject()] }, version);
  }, [activeProject, enqueue]);

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
      void enqueue({ projects: [updated] }, version).catch(() => undefined);
    }, 500);
  }, [activeProject, enqueue, setWorkspace]);

  const createProject = useCallback(async (name: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    const project = createWeddingProject(defaultWeddingEvent, name);
    const metadata = { ...current.metadata, activeProjectId: project.id };
    await enqueue({ projects: [project], metadata });
    setWorkspace({ ...current, projects: [...current.projects, project], activeProjectId: project.id, metadata });
  }, [enqueue, saveNow, setWorkspace]);

  const openProject = useCallback(async (id: string) => {
    const current = workspaceRef.current!;
    if (id === current.activeProjectId || !current.projects.some((project) => project.id === id)) return;
    await saveNow();
    const latest = workspaceRef.current!;
    const metadata = { ...latest.metadata, activeProjectId: id };
    await enqueue({ metadata });
    setWorkspace({ ...latest, activeProjectId: id, metadata });
  }, [enqueue, saveNow, setWorkspace]);

  const renameProject = useCallback(async (name: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    const project = renameWeddingProject(activeProject(), name);
    await enqueue({ projects: [project] });
    setWorkspace({ ...current, projects: current.projects.map((item) => item.id === project.id ? project : item) });
  }, [activeProject, enqueue, saveNow, setWorkspace]);

  const duplicateProject = useCallback(async (name?: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    const project = duplicateWeddingProject(activeProject(), name);
    const metadata = { ...current.metadata, activeProjectId: project.id };
    await enqueue({ projects: [project], metadata });
    setWorkspace({ ...current, projects: [...current.projects, project], activeProjectId: project.id, metadata });
  }, [activeProject, enqueue, saveNow, setWorkspace]);

  const deleteProject = useCallback(async () => {
    await saveNow();
    const current = workspaceRef.current!;
    const deleting = activeProject();
    const remaining = current.projects.filter((project) => project.id !== deleting.id);
    const replacement = remaining[0] ?? createWeddingProject(defaultWeddingEvent);
    const projects = remaining.length ? remaining : [replacement];
    const metadata = { ...current.metadata, activeProjectId: replacement.id };
    await enqueue({
      projects: remaining.length ? undefined : [replacement],
      deleteProjectIds: [deleting.id],
      metadata,
    });
    setWorkspace({ ...current, projects, activeProjectId: replacement.id, metadata });
  }, [activeProject, enqueue, saveNow, setWorkspace]);

  const saveCurrentDesign = useCallback(async (name: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    const design = createSavedDesignFromEvent(activeProject().event, name);
    await enqueue({ designs: [design] });
    setWorkspace({ ...current, designs: [...current.designs, design] });
  }, [activeProject, enqueue, saveNow, setWorkspace]);

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
    await enqueue({ designs: [design] });
    setWorkspace({ ...current, designs: current.designs.map((item) => item.id === id ? design : item) });
  }, [enqueue, saveNow, setWorkspace]);

  const deleteDesign = useCallback(async (id: string) => {
    await saveNow();
    const current = workspaceRef.current!;
    await enqueue({ deleteDesignIds: [id] });
    setWorkspace({ ...current, designs: current.designs.filter((design) => design.id !== id) });
  }, [enqueue, saveNow, setWorkspace]);

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
  }), [workspace, saveStatus, storageError, preserveLegacyWedding, updateActiveEvent, saveNow, createProject, openProject, renameProject, duplicateProject, deleteProject, saveCurrentDesign, applyDesign, renameDesign, deleteDesign]);

  return <WeddingWorkspaceContext.Provider value={value}>{workspace ? children : null}</WeddingWorkspaceContext.Provider>;
}

export function useWeddingWorkspace(): WeddingWorkspaceContextValue {
  const value = useContext(WeddingWorkspaceContext);
  if (!value) throw new Error("Wedding workspace context unavailable.");
  return value;
}
