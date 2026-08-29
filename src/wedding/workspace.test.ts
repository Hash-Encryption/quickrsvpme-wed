import assert from "node:assert/strict";
import test from "node:test";
import { defaultWeddingEvent } from "./model.ts";
import { defaultWeddingArtworkSettings } from "./upload.ts";
import {
  addWeddingProject,
  applySavedDesignToEvent,
  createSavedDesignFromEvent,
  createSerializedWeddingWorkspaceWriter,
  createWeddingProject,
  deleteWeddingProjectFromState,
  duplicateWeddingProject,
  initializeWeddingWorkspace,
  normalizeWeddingWorkspace,
  renameWeddingProject,
  switchActiveWeddingProject,
  updateWeddingProjectEvent,
  type WeddingWorkspaceCommit,
  type WeddingWorkspaceSnapshot,
  type WeddingWorkspaceState,
  type WeddingWorkspaceStorage,
} from "./workspace.ts";

class MemoryStorage implements WeddingWorkspaceStorage {
  snapshot: WeddingWorkspaceSnapshot = { projects: [], designs: [], metadata: null };
  commits = 0;
  failCommit = false;

  async load() { return structuredClone(this.snapshot); }
  async commit(change: WeddingWorkspaceCommit) {
    if (this.failCommit) throw new Error("quota");
    this.commits += 1;
    const projects = this.snapshot.projects.filter((item) => !change.deleteProjectIds?.includes(item.id));
    const designs = this.snapshot.designs.filter((item) => !change.deleteDesignIds?.includes(item.id));
    for (const project of change.projects ?? []) {
      const index = projects.findIndex((item) => item.id === project.id);
      index < 0 ? projects.push(structuredClone(project)) : projects.splice(index, 1, structuredClone(project));
    }
    for (const design of change.designs ?? []) {
      const index = designs.findIndex((item) => item.id === design.id);
      index < 0 ? designs.push(structuredClone(design)) : designs.splice(index, 1, structuredClone(design));
    }
    this.snapshot = { projects, designs, metadata: change.metadata ?? this.snapshot.metadata };
  }
}

const legacyRaw = (weddingEvent: unknown) => JSON.stringify({ mode: "wedding", rsvp: "pending", weddingEvent });

function stateWith(project = createWeddingProject(defaultWeddingEvent, "A", { id: "a", now: "2026-01-01" })): WeddingWorkspaceState {
  return {
    projects: [project],
    designs: [],
    activeProjectId: project.id,
    metadata: { schemaVersion: 1, activeProjectId: project.id, legacyMigrationVersion: 1 },
  };
}

test("legacy Phase 4 Wedding migrates to exactly one project and migration is idempotent", async () => {
  const storage = new MemoryStorage();
  let cleared = 0;
  const visual = { source: "uploaded-background" as const, uploadedBackground: { dataUrl: "data:image/png;base64,AA==", fileName: "legacy.png", mimeType: "image/png" } };
  const legacy = { ...defaultWeddingEvent, brideName: "ليان", templateId: "midnight-gold", visual, presentation: { layoutPresetId: "editorial-offset" as const, motionPresetId: "editorial-glide" as const } };
  const first = await initializeWeddingWorkspace(storage, legacyRaw(legacy), {
    id: "migrated",
    now: "2026-01-01",
    onMigrationCommitted: () => cleared++,
  });
  const second = await initializeWeddingWorkspace(storage, legacyRaw(defaultWeddingEvent), { onMigrationCommitted: () => cleared++ });
  assert.equal(first.projects.length, 1);
  assert.equal(first.projects[0].event.brideName, "ليان");
  assert.equal(first.projects[0].event.templateId, "midnight-gold");
  assert.deepEqual(first.projects[0].event.presentation, { ...legacy.presentation, safeZone: "auto", transforms: defaultWeddingEvent.presentation.transforms });
  assert.deepEqual(first.projects[0].event.visual, { ...visual, ...defaultWeddingArtworkSettings });
  assert.equal(second.projects.length, 1);
  assert.equal(second.projects[0].id, "migrated");
  assert.equal(storage.commits, 1);
  assert.equal(cleared, 2);
});

test("autosave writer serializes older and newer persistence operations", async () => {
  const started: string[] = [];
  const releases: Array<() => void> = [];
  const writer = createSerializedWeddingWorkspaceWriter((change) => new Promise<void>((resolve) => {
    started.push(change.projects?.[0].name ?? "unknown");
    releases.push(resolve);
  }));
  const oldWrite = writer({ projects: [createWeddingProject(defaultWeddingEvent, "old", { id: "old" })] });
  const newWrite = writer({ projects: [createWeddingProject(defaultWeddingEvent, "new", { id: "new" })] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["old"]);
  releases.shift()!();
  await oldWrite;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["old", "new"]);
  releases.shift()!();
  await newWrite;
});

test("serialized writer recovers after failure without letting old state overtake new state", async () => {
  const committed: string[] = [];
  let attempts = 0;
  const writer = createSerializedWeddingWorkspaceWriter(async (change) => {
    attempts += 1;
    if (attempts === 1) throw new Error("quota");
    committed.push(change.projects?.[0].name ?? "unknown");
  });
  const oldWrite = writer({ projects: [createWeddingProject(defaultWeddingEvent, "old", { id: "old" })] });
  const newWrite = writer({ projects: [createWeddingProject(defaultWeddingEvent, "new", { id: "new" })] });
  await assert.rejects(oldWrite, /quota/);
  await newWrite;
  assert.deepEqual(committed, ["new"]);
});

test("corrupt legacy Wedding resolves safely", async () => {
  const storage = new MemoryStorage();
  const result = await initializeWeddingWorkspace(storage, legacyRaw({ templateId: "missing", visual: { source: "bad" }, presentation: { layoutPresetId: "bad" } }), { id: "safe" });
  assert.equal(result.projects[0].event.templateId, defaultWeddingEvent.templateId);
  assert.deepEqual(result.projects[0].event.visual, { source: "template" });
  assert.deepEqual(result.projects[0].event.presentation, defaultWeddingEvent.presentation);
});

test("failed migration does not mark or erase the legacy Wedding", async () => {
  const storage = new MemoryStorage();
  storage.failCommit = true;
  let cleared = false;
  await assert.rejects(initializeWeddingWorkspace(storage, legacyRaw(defaultWeddingEvent), { onMigrationCommitted: () => { cleared = true; } }));
  assert.equal(cleared, false);
  assert.equal(storage.snapshot.metadata, null);
  assert.equal(storage.snapshot.projects.length, 0);
});

test("project create, rename, duplicate, switch, and delete preserve valid active state", () => {
  const first = createWeddingProject({ ...defaultWeddingEvent, brideName: "A" }, "First", { id: "a", now: "1" });
  const created = createWeddingProject({ ...defaultWeddingEvent, brideName: "B" }, "Second", { id: "b", now: "2" });
  let workspace = addWeddingProject(stateWith(first), created);
  assert.equal(workspace.projects.length, 2);
  assert.equal(workspace.activeProjectId, "b");
  const renamed = renameWeddingProject(created, "Renamed", "3");
  assert.equal(renamed.name, "Renamed");
  const duplicate = duplicateWeddingProject(renamed, undefined, { id: "c", now: "4" });
  assert.equal(duplicate.id, "c");
  assert.equal(duplicate.event.brideName, "B");
  workspace = addWeddingProject(workspace, duplicate);
  workspace = switchActiveWeddingProject(workspace, "a");
  assert.equal(workspace.activeProjectId, "a");
  workspace = deleteWeddingProjectFromState(workspace, "a");
  assert.equal(workspace.activeProjectId, "b");
  workspace = deleteWeddingProjectFromState(deleteWeddingProjectFromState(workspace, "b"), "c", { id: "fresh", now: "5" });
  assert.equal(workspace.projects.length, 1);
  assert.equal(workspace.activeProjectId, "fresh");
});

test("edits remain isolated between projects", () => {
  const first = createWeddingProject({ ...defaultWeddingEvent, brideName: "A" }, "A", { id: "a" });
  const second = createWeddingProject({ ...defaultWeddingEvent, brideName: "B" }, "B", { id: "b" });
  const edited = updateWeddingProjectEvent(first, { ...first.event, brideName: "Edited" });
  assert.equal(edited.event.brideName, "Edited");
  assert.equal(second.event.brideName, "B");
});

test("Wedding invitation locale persists per project without affecting saved designs", () => {
  const arabic = createWeddingProject({ ...defaultWeddingEvent, invitationLocale: "ar" }, "Arabic");
  const english = createWeddingProject({ ...defaultWeddingEvent, invitationLocale: "en" }, "English");
  assert.equal(arabic.event.invitationLocale, "ar");
  assert.equal(english.event.invitationLocale, "en");
  assert.equal("invitationLocale" in createSavedDesignFromEvent(english.event, "Look"), false);
});

test("Saved Design extraction has only the explicit appearance allow-list", () => {
  const design = createSavedDesignFromEvent({ ...defaultWeddingEvent, brideName: "SECRET", musicUrl: "secret.mp3" }, "Look", { id: "d", now: "1" });
  assert.deepEqual(Object.keys(design).sort(), ["createdAt", "id", "name", "presentation", "style", "templateId", "updatedAt", "version", "visual"]);
  assert.equal("brideName" in design, false);
  assert.equal("musicUrl" in design, false);
  assert.equal("backgroundMediaUrl" in design, false);
});

test("applying a Saved Design preserves all dynamic Wedding content", () => {
  const source = { ...defaultWeddingEvent, brideName: "Design bride", venue: "Design venue", musicUrl: "design.mp3", templateId: "midnight-gold" };
  const target = { ...defaultWeddingEvent, brideName: "Target bride", groomName: "Target groom", venue: "Target venue", musicUrl: "target.mp3", backgroundMediaUrl: "target.mp4" };
  const applied = applySavedDesignToEvent(target, createSavedDesignFromEvent(source, "Look"));
  const { templateId: _targetTemplate, visual: _targetVisual, style: _targetStyle, presentation: _targetPresentation, ...targetContent } = target;
  const { templateId: _appliedTemplate, visual: _appliedVisual, style: _appliedStyle, presentation: _appliedPresentation, ...appliedContent } = applied;
  assert.deepEqual(appliedContent, targetContent);
  assert.equal(applied.templateId, "midnight-gold");
});

test("built-in template Saved Design roundtrips layout and motion", () => {
  const event = { ...defaultWeddingEvent, templateId: "pearl-arch", presentation: { ...defaultWeddingEvent.presentation, layoutPresetId: "editorial-offset" as const, motionPresetId: "editorial-glide" as const, safeZone: "bottom" as const } };
  const design = createSavedDesignFromEvent(event, "Pearl", { id: "pearl" });
  const applied = applySavedDesignToEvent(defaultWeddingEvent, design);
  assert.equal(applied.templateId, "pearl-arch");
  assert.deepEqual(applied.presentation, event.presentation);
});

test("custom layout geometry roundtrips through project and Saved Design persistence", () => {
  const transforms = {
    global: { scale: 1.12, x: -0.04, y: 0.09 },
    blocks: {
      principals: { scale: 1.2, x: 0.03, y: 0.08 },
      "date-time": { scale: 0.9, x: -0.02, y: -0.05 },
      venue: { scale: 1.15, x: 0.01, y: 0.04 },
    },
  };
  const project = createWeddingProject({ presentation: { ...defaultWeddingEvent.presentation, transforms } }, "Custom", { id: "custom" });
  const design = createSavedDesignFromEvent(project.event, "Custom geometry", { id: "geometry" });
  const reloaded = normalizeWeddingWorkspace({ projects: [project], designs: [design], metadata: { schemaVersion: 1, activeProjectId: project.id, legacyMigrationVersion: 1 } });
  assert.deepEqual(reloaded.projects[0].event.presentation.transforms, transforms);
  assert.deepEqual(reloaded.designs[0].presentation.transforms, transforms);
  assert.deepEqual(applySavedDesignToEvent(defaultWeddingEvent, reloaded.designs[0]).presentation.transforms, transforms);
});

test("uploaded-background Saved Design roundtrips safely", () => {
  const visual = { source: "uploaded-background" as const, uploadedBackground: { dataUrl: "data:image/png;base64,AA==", fileName: "look.png", mimeType: "image/png" }, ...defaultWeddingArtworkSettings };
  const design = createSavedDesignFromEvent({ ...defaultWeddingEvent, visual }, "Upload", { id: "upload" });
  const applied = applySavedDesignToEvent(defaultWeddingEvent, design);
  assert.deepEqual(applied.visual, visual);
});

test("old Saved Designs without Phase 3 placement fields remain readable", () => {
  const design = createSavedDesignFromEvent(defaultWeddingEvent, "Legacy", { id: "legacy-design", now: "1" });
  const legacy = {
    ...design,
    visual: {
      source: "uploaded-background",
      uploadedBackground: { dataUrl: "data:image/png;base64,AA==", fileName: "old.png", mimeType: "image/png" },
    },
    presentation: {
      layoutPresetId: "editorial-offset",
      motionPresetId: "editorial-glide",
    },
  };
  const normalized = normalizeWeddingWorkspace({ projects: [], designs: [legacy as never], metadata: null });
  assert.deepEqual(normalized.designs[0].visual, { ...legacy.visual, ...defaultWeddingArtworkSettings });
  assert.deepEqual(normalized.designs[0].presentation, { ...legacy.presentation, safeZone: "auto", transforms: defaultWeddingEvent.presentation.transforms });
});

test("invalid persisted template, visual, and presentation resolve safely", () => {
  const project = createWeddingProject(defaultWeddingEvent, "Bad", { id: "bad" });
  const snapshot = normalizeWeddingWorkspace({
    projects: [{ ...project, event: { ...project.event, templateId: "future", visual: { source: "broken" }, presentation: { layoutPresetId: "broken", motionPresetId: "broken" } } } as never],
    designs: [],
    metadata: { schemaVersion: 1, activeProjectId: "bad", legacyMigrationVersion: 1 },
  });
  assert.equal(snapshot.projects[0].event.templateId, defaultWeddingEvent.templateId);
  assert.deepEqual(snapshot.projects[0].event.visual, { source: "template" });
  assert.deepEqual(snapshot.projects[0].event.presentation, defaultWeddingEvent.presentation);
});

test("workspace load repairs a missing active project ID", async () => {
  const storage = new MemoryStorage();
  storage.snapshot = {
    projects: [createWeddingProject(defaultWeddingEvent, "Valid", { id: "valid" })],
    designs: [],
    metadata: { schemaVersion: 1, activeProjectId: "missing", legacyMigrationVersion: 1 },
  };
  const workspace = await initializeWeddingWorkspace(storage, null);
  assert.equal(workspace.activeProjectId, "valid");
  assert.equal(storage.snapshot.metadata?.activeProjectId, "valid");
});

test("corrupt current-version records do not hide valid projects and designs", () => {
  const project = createWeddingProject(defaultWeddingEvent, "Valid", { id: "valid" });
  const design = createSavedDesignFromEvent(defaultWeddingEvent, "Valid", { id: "design" });
  const snapshot = normalizeWeddingWorkspace({
    projects: [project, { version: 1, id: "", event: {} } as never],
    designs: [design, { version: 1, id: "", name: "Broken" } as never],
    metadata: { schemaVersion: 1, activeProjectId: project.id, legacyMigrationVersion: 1 },
  });
  assert.deepEqual(snapshot.projects.map(({ id }) => id), ["valid"]);
  assert.deepEqual(snapshot.designs.map(({ id }) => id), ["design"]);
});

test("future project and design record versions are rejected", () => {
  const project = createWeddingProject(defaultWeddingEvent, "Future", { id: "future" });
  const design = createSavedDesignFromEvent(defaultWeddingEvent, "Future", { id: "future-design" });
  assert.throws(() => normalizeWeddingWorkspace({ projects: [{ ...project, version: 2 } as never], designs: [], metadata: null }), /Unsupported/);
  assert.throws(() => normalizeWeddingWorkspace({ projects: [], designs: [{ ...design, version: 2 } as never], metadata: null }), /Unsupported/);
});

test("unknown future persistence version is not overwritten", async () => {
  const storage = new MemoryStorage();
  storage.snapshot.metadata = { schemaVersion: 2, activeProjectId: null, legacyMigrationVersion: 1 } as never;
  await assert.rejects(initializeWeddingWorkspace(storage, null), /Unsupported/);
  assert.equal(storage.commits, 0);
});

test("generated project and design IDs remain distinct", () => {
  const first = createWeddingProject();
  const second = createWeddingProject();
  const firstDesign = createSavedDesignFromEvent(defaultWeddingEvent, "One");
  const secondDesign = createSavedDesignFromEvent(defaultWeddingEvent, "Two");
  assert.notEqual(first.id, second.id);
  assert.notEqual(firstDesign.id, secondDesign.id);
  assert.notEqual(first.id, firstDesign.id);
});
