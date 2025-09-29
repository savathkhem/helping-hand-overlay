const DEFAULT_RETENTION_POLICY = {
  maxEntries: 50,
  maxAgeDays: 14,
};

const DEFAULT_OPTIONS = {
  collectionKey: "hh-captures-v1",
  thumbnailKey: "hh-capture-thumbnails-v1",
  dbName: "hh-captures",
  dbVersion: 1,
  blobStoreName: "captureBlobs",
  retentionPolicy: DEFAULT_RETENTION_POLICY,
};

const storageGet = (keys) =>
  new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    } catch (err) {
      reject(err);
    }
  });

const storageSet = (entries) =>
  new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(entries, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });

const storageRemove = (keys) =>
  new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });

class CaptureStorage {
  constructor(options = {}) {
    const merged = { ...DEFAULT_OPTIONS, ...options };
    if (options.retentionPolicy) {
      merged.retentionPolicy = { ...DEFAULT_RETENTION_POLICY, ...options.retentionPolicy };
    }
    this.collectionKey = merged.collectionKey;
    this.thumbnailKey = merged.thumbnailKey;
    this.dbName = merged.dbName;
    this.dbVersion = merged.dbVersion;
    this.blobStoreName = merged.blobStoreName;
    this.retentionPolicy = merged.retentionPolicy;
    this._dbPromise = null;
  }

  async init() {
    await this._ensureDatabase();
    await this.enforceRetention();
  }

  async upsertCapture(changes = {}) {
    const { captures, thumbnails } = await this._getCollections();
    const now = Date.now();
    const id = changes.id || `cap_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const current = captures[id] || {
      id,
      createdAt: now,
      updatedAt: now,
      status: "draft",
      prompt: "",
      response: "",
      error: "",
      provider: null,
      threadId: null,
      selection: null,
      mode: null,
      attachments: {},
      metadata: {},
    };

    const next = { ...current, updatedAt: now };

    if (changes.prompt !== undefined) next.prompt = changes.prompt;
    if (changes.response !== undefined) next.response = changes.response;
    if (changes.status !== undefined) next.status = changes.status;
    if (changes.error !== undefined) next.error = changes.error;
    if (changes.provider !== undefined) next.provider = changes.provider;
    if (changes.threadId !== undefined) next.threadId = changes.threadId;
    if (changes.selection !== undefined) next.selection = changes.selection;
    if (changes.mode !== undefined) next.mode = changes.mode;
    if (changes.metadata) next.metadata = { ...next.metadata, ...changes.metadata };
    if (changes.attachments) next.attachments = { ...next.attachments, ...changes.attachments };

    captures[id] = next;

    if (changes.thumbnailDataUrl !== undefined) {
      if (changes.thumbnailDataUrl) {
        thumbnails[id] = changes.thumbnailDataUrl;
      } else {
        delete thumbnails[id];
      }
    }

    await storageSet({
      [this.collectionKey]: captures,
      [this.thumbnailKey]: thumbnails,
    });

    return this._withThumbnail(next, thumbnails[id]);
  }

  async updateCapture(id, updates = {}) {
    return this.upsertCapture({ ...updates, id });
  }

  async getCapture(id) {
    const { captures, thumbnails } = await this._getCollections();
    if (!captures[id]) return null;
    return this._withThumbnail(captures[id], thumbnails[id]);
  }

  async listRecentCaptures(limit = 0) {
    const { captures, thumbnails } = await this._getCollections();
    const sorted = Object.values(captures).sort((a, b) => b.updatedAt - a.updatedAt);
    const slice = limit > 0 ? sorted.slice(0, limit) : sorted;
    return slice.map((entry) => this._withThumbnail(entry, thumbnails[entry.id]));
  }

  async deleteCapture(id) {
    const { captures, thumbnails } = await this._getCollections();
    const record = captures[id];
    if (!record) return;

    delete captures[id];
    delete thumbnails[id];

    await storageSet({
      [this.collectionKey]: captures,
      [this.thumbnailKey]: thumbnails,
    });

    await this._deleteBlobsFor(record);
  }

  async saveBlob(captureId, kind, blob) {
    const db = await this._ensureDatabase();
    const key = this._buildBlobKey(captureId, kind);
    await this._runStoreTransaction("readwrite", (store, resolve, reject) => {
      const request = store.put(blob, key);
      request.onsuccess = () => resolve(key);
      request.onerror = () => reject(request.error || new Error("Blob save failed"));
    });
    return key;
  }

  async getBlob(captureId, kind) {
    const db = await this._ensureDatabase();
    const key = this._buildBlobKey(captureId, kind);
    return this._runStoreTransaction("readonly", (store, resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Blob load failed"));
    });
  }

  async deleteBlob(captureId, kind) {
    const db = await this._ensureDatabase();
    const key = this._buildBlobKey(captureId, kind);
    await this._runStoreTransaction("readwrite", (store, resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Blob delete failed"));
    });
  }

  async enforceRetention(policyOverride) {
    const policy = policyOverride
      ? { ...DEFAULT_RETENTION_POLICY, ...policyOverride }
      : this.retentionPolicy;
    if (!policy) return;

    const { captures, thumbnails } = await this._getCollections();
    const records = Object.values(captures).sort((a, b) => b.updatedAt - a.updatedAt);

    const now = Date.now();
    const maxAgeMs = policy.maxAgeDays ? policy.maxAgeDays * 24 * 60 * 60 * 1000 : null;
    const maxEntries = policy.maxEntries || null;

    const removals = [];
    records.forEach((record, index) => {
      const tooMany = maxEntries !== null && index >= maxEntries;
      const tooOld = maxAgeMs !== null && now - record.updatedAt > maxAgeMs;
      if (tooMany || tooOld) removals.push(record);
    });

    if (!removals.length) return;

    for (const record of removals) {
      delete captures[record.id];
      delete thumbnails[record.id];
      await this._deleteBlobsFor(record);
    }

    await storageSet({
      [this.collectionKey]: captures,
      [this.thumbnailKey]: thumbnails,
    });
  }

  async clearAll() {
    const { captures } = await this._getCollections();
    const all = Object.values(captures);
    await storageRemove([this.collectionKey, this.thumbnailKey]);
    for (const record of all) {
      await this._deleteBlobsFor(record);
    }
  }

  async _getCollections() {
    const result = await storageGet([this.collectionKey, this.thumbnailKey]);
    return {
      captures: result?.[this.collectionKey] || {},
      thumbnails: result?.[this.thumbnailKey] || {},
    };
  }

  _withThumbnail(record, thumbnailDataUrl) {
    return { ...record, thumbnailDataUrl: thumbnailDataUrl || "" };
  }

  async _deleteBlobsFor(record) {
    const attachments = record?.attachments || {};
    const blobKeys = Object.values(attachments)
      .map((entry) => entry?.blobKey)
      .filter(Boolean);
    if (!blobKeys.length) return;

    await this._runStoreTransaction("readwrite", (store, resolve, reject) => {
      let remaining = blobKeys.length;
      const done = () => {
        remaining -= 1;
        if (remaining <= 0) resolve();
      };

      blobKeys.forEach((key) => {
        const request = store.delete(key);
        request.onsuccess = done;
        request.onerror = () => reject(request.error || new Error("Blob delete failed"));
      });
    });
  }

  _buildBlobKey(captureId, kind) {
    return `${captureId}:${kind}`;
  }

  async _ensureDatabase() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.blobStoreName)) {
          db.createObjectStore(this.blobStoreName);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error("Failed to open capture storage database"));
      };
    });

    return this._dbPromise;
  }

  async _runStoreTransaction(mode, executor) {
    const db = await this._ensureDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.blobStoreName, mode);
      tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
      tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
      const store = tx.objectStore(this.blobStoreName);
      executor(store, resolve, reject);
    });
  }
}

window.CaptureStorage = CaptureStorage;
