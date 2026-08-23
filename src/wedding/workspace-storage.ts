import {
  UnsupportedWeddingWorkspaceVersionError,
  type WeddingWorkspaceCommit,
  type WeddingWorkspaceSnapshot,
  type WeddingWorkspaceStorage,
} from "./workspace.ts";

const databaseName = "quickrsvp-wedding-workspace";
const databaseVersion = 1;
const metadataKey = "workspace";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

export class IndexedDbWeddingWorkspaceStorage implements WeddingWorkspaceStorage {
  private database?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) {
          reject(new Error("IndexedDB is unavailable in this browser."));
          return;
        }
        const request = indexedDB.open(databaseName, databaseVersion);
        request.onupgradeneeded = () => {
          const database = request.result;
          for (const store of ["projects", "designs", "meta"]) {
            if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: store === "meta" ? "key" : "id" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          const error = request.error;
          reject(error?.name === "VersionError" ? new UnsupportedWeddingWorkspaceVersionError("future") : error);
        };
        request.onblocked = () => reject(new Error("Wedding workspace database upgrade is blocked."));
      });
    }
    return this.database;
  }

  async load(): Promise<WeddingWorkspaceSnapshot> {
    try {
      const database = await this.open();
      const transaction = database.transaction(["projects", "designs", "meta"], "readonly");
      const [projects, designs, metadataRecord] = await Promise.all([
        requestResult(transaction.objectStore("projects").getAll()),
        requestResult(transaction.objectStore("designs").getAll()),
        requestResult(transaction.objectStore("meta").get(metadataKey)),
      ]);
      await transactionDone(transaction);
      const metadata = metadataRecord && typeof metadataRecord === "object"
        ? (metadataRecord as { value?: WeddingWorkspaceSnapshot["metadata"] }).value ?? null
        : null;
      return { projects, designs, metadata } as WeddingWorkspaceSnapshot;
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unable to load the Wedding workspace.");
    }
  }

  async commit(change: WeddingWorkspaceCommit): Promise<void> {
    try {
      const database = await this.open();
      const stores = [
        ...(change.projects || change.deleteProjectIds ? ["projects"] : []),
        ...(change.designs || change.deleteDesignIds ? ["designs"] : []),
        ...(change.metadata ? ["meta"] : []),
      ];
      if (!stores.length) return;
      const transaction = database.transaction(stores, "readwrite");
      const requests: IDBRequest[] = [];
      for (const project of change.projects ?? []) requests.push(transaction.objectStore("projects").put(project));
      for (const id of change.deleteProjectIds ?? []) requests.push(transaction.objectStore("projects").delete(id));
      for (const design of change.designs ?? []) requests.push(transaction.objectStore("designs").put(design));
      for (const id of change.deleteDesignIds ?? []) requests.push(transaction.objectStore("designs").delete(id));
      if (change.metadata) requests.push(transaction.objectStore("meta").put({ key: metadataKey, value: change.metadata }));
      await Promise.all(requests.map((request) => requestResult(request)));
      await transactionDone(transaction);
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unable to save the Wedding workspace.");
    }
  }
}
