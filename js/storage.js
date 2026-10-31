/**
 * SIRA PWA - Storage Engine (IndexedDB + LocalStorage)
 */

import { SAMPLE_7C_STUDENTS, createSample7CPreferences, createDefaultClassroomConfig } from './models.js';

const DB_NAME = 'SiraPwaDB';
const DB_VERSION = 1;
const STORE_NAME = 'classroom_store';

class StorageManager {
  constructor() {
    this.db = null;
    this.readyPromise = this.initDB();
  }

  async initDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to localStorage');
        resolve(null);
        return;
      }
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = () => {
        console.warn('IndexedDB failed to open, fallback to localStorage');
        resolve(null);
      };
    });
  }

  async getClassroom() {
    await this.readyPromise;
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('current_classroom');
        req.onsuccess = () => {
          if (req.result) {
            resolve(req.result.data);
          } else {
            const initial = this.createInitialClassroom();
            this.saveClassroom(initial);
            resolve(initial);
          }
        };
        req.onerror = () => resolve(this.loadFromLocalStorage());
      });
    } else {
      return this.loadFromLocalStorage();
    }
  }

  async saveClassroom(classroom) {
    await this.readyPromise;
    // Always mirror to localStorage as backup
    try {
      localStorage.setItem('sira_classroom', JSON.stringify(classroom));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id: 'current_classroom', data: classroom });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    }
    return true;
  }

  createInitialClassroom() {
    return {
      id: 'class_7c',
      name: '7-C Sınıfı',
      students: JSON.parse(JSON.stringify(SAMPLE_7C_STUDENTS)),
      preferences: createSample7CPreferences(),
      config: createDefaultClassroomConfig(),
      plan: null,
      originalMasterPlan: null,
      deskCards: {},
      forbiddenPairs: [],
      planHistory: [],
      lastEarthquakeSummary: null
    };
  }

  loadFromLocalStorage() {
    const raw = localStorage.getItem('sira_classroom');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    const initial = this.createInitialClassroom();
    this.saveClassroom(initial);
    return initial;
  }



  async resetToDefault() {
    const initial = this.createInitialClassroom();
    await this.saveClassroom(initial);
    return initial;
  }
}

export const Storage = new StorageManager();
