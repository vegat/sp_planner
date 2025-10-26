import { AUTO_SAVE_MS, LOCAL_STORAGE_KEY } from '../core/constants.js';

export class StorageService {
    constructor({ plannerContainer }) {
        this.localKey = LOCAL_STORAGE_KEY;
        this.autoSaveTimer = null;
        this.plannerContainer = plannerContainer;
    }

    saveLocal(state) {
        if (state && state.settings) {
            state.settings.tableCount = state.tables.length;
        }
        state.version = state.version || 1;
        localStorage.setItem(this.localKey, JSON.stringify(state));
    }

    loadLocal() {
        const raw = localStorage.getItem(this.localKey);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.error('Nie udało się wczytać danych z localStorage', error);
            return null;
        }
    }

    startAutoSave(callback) {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        this.autoSaveTimer = setInterval(() => {
            callback();
        }, AUTO_SAVE_MS);
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    getPlanId() {
        return this.plannerContainer?.dataset?.planId || '';
    }

    async loadRemoteIfNeeded() {
        const planId = this.getPlanId();
        if (!planId) {
            return null;
        }
        try {
            const response = await fetch(`load.php?id=${encodeURIComponent(planId)}`);
            if (!response.ok) {
                throw new Error('Nie udało się wczytać planu z serwera.');
            }
            return await response.json();
        } catch (error) {
            console.error(error);
            alert(error.message);
            return null;
        }
    }

    async saveRemote(state) {
        try {
            const response = await fetch('save.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(state)
            });
            if (!response.ok) {
                throw new Error('Nie udało się zapisać planu na serwerze.');
            }
            return await response.json();
        } catch (error) {
            console.error(error);
            alert(error.message);
            throw error;
        }
    }
}
