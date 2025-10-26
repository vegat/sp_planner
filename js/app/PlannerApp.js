import { PlannerState } from '../state/PlannerState.js';
import { Room } from '../models/Room.js';
import { PlannerRenderer } from '../ui/PlannerRenderer.js';
import { StorageService } from '../services/StorageService.js';
import { History } from '../services/History.js';
import { STATE_VERSION } from '../core/constants.js';
import { snap } from '../utils/math.js';

export class PlannerApp {
    constructor(elements) {
        this.elements = elements;
        this.room = new Room(elements.hallSvg, elements.plannerContainer, elements.plannerSection);
        this.state = new PlannerState(this.room);
        this.history = new History();
        this.storage = new StorageService({ plannerContainer: elements.plannerContainer });
        this.selectedTables = new Set();
        this.selectionState = null;
        this.draggingGuestId = null;
        this.dragContext = null;
        this.renderer = new PlannerRenderer({
            room: this.room,
            state: this.state,
            elements,
            selectedTables: this.selectedTables
        });
        this.renderer.setHandlers({
            onTablePointerDown: (event, table) => this.onTablePointerDown(event, table),
            onTableSettings: tableId => this.openTableModal(tableId),
            onChairClick: (event, table, chair) => this.onChairClick(event, table, chair),
            onChairDragEnter: (event, table, chair) => this.onChairDragEnter(event, table, chair),
            onChairDragLeave: event => this.onChairDragLeave(event),
            onChairDragOver: event => this.onChairDragOver(event),
            onChairDrop: (event, table, chair) => this.onChairDrop(event, table, chair),
            onGuestDragStart: (event, guest) => this.onGuestDragStart(event, guest),
            onGuestDragEnd: () => this.onGuestDragEnd()
        });
    }

    async init() {
        this.bindEvents();
        this.room.updateScale();
        this.storage.startAutoSave(() => this.persistLocal());
        const remote = await this.storage.loadRemoteIfNeeded();
        if (remote) {
            this.state.loadFromRaw(remote);
        } else {
            const local = this.storage.loadLocal();
            if (local) {
                this.state.loadFromRaw(local);
            } else {
                this.state.createDefaultLayout();
            }
        }
        this.history.reset();
        this.pushHistory();
        this.render();
    }

    bindEvents() {
        const {
            tableCountInput,
            modeToggle,
            undoBtn,
            redoBtn,
            resetBtn,
            shareBtn,
            guestForm,
            guestNameInput,
            gridToggle,
            plannerContainer,
            chairModalClose,
            tableModalClose,
            tableModalCancel,
            clearChairBtn
        } = this.elements;

        window.addEventListener('resize', () => {
            if (this.room.updateScale()) {
                this.renderTablesOnly();
            }
        });

        plannerContainer.addEventListener('pointerdown', event => this.onPlannerPointerDown(event));
        document.addEventListener('pointermove', event => this.onPointerMove(event));
        document.addEventListener('pointerup', event => this.onPointerUp(event));

        tableCountInput.addEventListener('input', () => {
            const value = Number(tableCountInput.value);
            if (Number.isFinite(value)) {
                this.onTableCountChange(value);
            }
        });

        modeToggle.addEventListener('change', () => {
            this.onModeToggle(modeToggle.checked ? 'more' : 'less');
        });

        undoBtn.addEventListener('click', () => this.undo());
        redoBtn.addEventListener('click', () => this.redo());
        resetBtn.addEventListener('click', () => this.resetLayout());
        shareBtn.addEventListener('click', () => this.sharePlan());

        guestForm.addEventListener('submit', event => {
            event.preventDefault();
            const name = guestNameInput.value.trim();
            if (name) {
                this.pushHistory();
                this.state.addGuest(name);
                guestNameInput.value = '';
                this.persistLocal();
                this.renderGuests();
                this.renderSummary();
            }
        });

        gridToggle.addEventListener('change', () => {
            plannerContainer.classList.toggle('no-grid', !gridToggle.checked);
        });

        chairModalClose.addEventListener('click', () => this.hideChairModal());
        clearChairBtn.addEventListener('click', () => this.clearCurrentChair());
        this.elements.chairForm.addEventListener('submit', event => this.onChairFormSubmit(event));

        tableModalClose.addEventListener('click', () => this.hideTableModal());
        tableModalCancel.addEventListener('click', () => this.hideTableModal());
        this.elements.tableHeadCheckbox.addEventListener('change', () => this.updateHeadSeatField(this.elements.tableHeadCheckbox.checked));
        this.elements.tableForm.addEventListener('submit', event => this.onTableFormSubmit(event));
    }

    render() {
        this.renderer.renderAll();
        this.updateUndoRedoButtons();
    }

    renderTablesOnly() {
        this.renderer.renderTables();
    }

    renderGuests() {
        this.renderer.renderGuests();
    }

    renderSummary() {
        this.renderer.renderSummary();
    }

    pushHistory(snapshot = this.state.toJSON()) {
        this.history.push(snapshot);
        this.updateUndoRedoButtons();
    }

    updateUndoRedoButtons() {
        this.elements.undoBtn.disabled = !this.history.canUndo();
        this.elements.redoBtn.disabled = !this.history.canRedo();
    }

    undo() {
        if (!this.history.canUndo()) return;
        const snapshot = this.history.undo(this.state.toJSON());
        this.state.loadFromRaw(snapshot);
        this.render();
        this.persistLocal();
    }

    redo() {
        if (!this.history.canRedo()) return;
        const snapshot = this.history.redo(this.state.toJSON());
        this.state.loadFromRaw(snapshot);
        this.render();
        this.persistLocal();
    }

    resetLayout() {
        if (!confirm('Czy na pewno chcesz zresetować układ sali?')) {
            return;
        }
        this.pushHistory();
        this.state.createDefaultLayout();
        this.persistLocal();
        this.render();
    }

    persistLocal() {
        const snapshot = this.state.toJSON();
        snapshot.version = STATE_VERSION;
        this.storage.saveLocal(snapshot);
    }

    async sharePlan() {
        const snapshot = this.state.toJSON();
        snapshot.version = STATE_VERSION;
        try {
            const response = await this.storage.saveRemote(snapshot);
            if (response && response.link) {
                this.elements.shareResult.textContent = `Link do planu: ${response.link}`;
                this.elements.shareResult.classList.remove('hidden');
            }
        } catch (error) {
            console.error(error);
        }
    }

    onTableCountChange(value) {
        this.pushHistory();
        if (this.state.setTableCount(value)) {
            this.persistLocal();
            this.render();
        }
    }

    onModeToggle(mode) {
        this.pushHistory();
        this.state.setMode(mode);
        this.persistLocal();
        this.render();
    }

    onTablePointerDown(event, table) {
        if (event.target.closest('.table-settings')) {
            return;
        }
        event.preventDefault();
        const isMulti = event.shiftKey || event.ctrlKey || event.metaKey;
        if (!this.selectedTables.has(table.id)) {
            if (!isMulti) {
                this.selectedTables.clear();
            }
            this.selectedTables.add(table.id);
        } else if (isMulti) {
            this.selectedTables.delete(table.id);
        }
        if (!this.selectedTables.size) {
            this.selectedTables.add(table.id);
        }
        const tables = Array.from(this.selectedTables).map(id => this.state.tables.find(tbl => tbl.id === id));
        const rect = this.elements.plannerContainer.getBoundingClientRect();
        const pointer = {
            x: (event.clientX - rect.left) / this.room.scale,
            y: (rect.bottom - event.clientY) / this.room.scale
        };
        this.dragContext = {
            type: 'tables',
            pointerStart: pointer,
            tables,
            initialPositions: tables.map(tbl => ({ id: tbl.id, x: tbl.x, y: tbl.y })),
            snapshot: this.state.toJSON()
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    onPlannerPointerDown(event) {
        if (event.target.closest('.table') || event.target.closest('.chair') || event.target.closest('.table-settings')) {
            return;
        }
        const rect = this.elements.plannerContainer.getBoundingClientRect();
        const startX = (event.clientX - rect.left) / this.room.scale;
        const startY = (rect.bottom - event.clientY) / this.room.scale;
        this.selectionState = {
            active: true,
            start: { x: startX, y: startY },
            current: { x: startX, y: startY }
        };
        this.updateSelectionBox();
    }

    onPointerMove(event) {
        if (this.dragContext && this.dragContext.type === 'tables') {
            this.handleTableDrag(event);
            return;
        }
        if (this.selectionState?.active) {
            const rect = this.elements.plannerContainer.getBoundingClientRect();
            const currentX = (event.clientX - rect.left) / this.room.scale;
            const currentY = (rect.bottom - event.clientY) / this.room.scale;
            this.selectionState.current = { x: currentX, y: currentY };
            this.updateSelectionBox();
        }
    }

    onPointerUp() {
        if (this.dragContext && this.dragContext.type === 'tables') {
            this.finalizeTableDrag();
        }
        if (this.selectionState?.active) {
            const minX = Math.min(this.selectionState.start.x, this.selectionState.current.x);
            const maxX = Math.max(this.selectionState.start.x, this.selectionState.current.x);
            const minY = Math.min(this.selectionState.start.y, this.selectionState.current.y);
            const maxY = Math.max(this.selectionState.start.y, this.selectionState.current.y);
            const ids = this.state.tables
                .filter(tbl => tbl.x >= minX && tbl.x <= maxX && tbl.y >= minY && tbl.y <= maxY)
                .map(tbl => tbl.id);
            this.selectedTables.clear();
            ids.forEach(id => this.selectedTables.add(id));
            this.selectionState = null;
            this.hideSelectionBox();
            this.renderTablesOnly();
        }
        this.dragContext = null;
    }

    handleTableDrag(event) {
        const rect = this.elements.plannerContainer.getBoundingClientRect();
        const pointerX = (event.clientX - rect.left) / this.room.scale;
        const pointerY = (rect.bottom - event.clientY) / this.room.scale;
        const deltaX = pointerX - this.dragContext.pointerStart.x;
        const deltaY = pointerY - this.dragContext.pointerStart.y;
        const snapDeltaX = snap(deltaX);
        const snapDeltaY = snap(deltaY);
        const movingIds = new Set(this.dragContext.tables.map(table => table.id));
        const candidates = this.dragContext.initialPositions.map(initial => ({
            id: initial.id,
            x: initial.x + snapDeltaX,
            y: initial.y + snapDeltaY
        }));
        const isValid = candidates.every(candidate => {
            const table = this.dragContext.tables.find(tbl => tbl.id === candidate.id);
            if (!table) return false;
            const rotation = table.rotation || 0;
            if (!this.room.isPositionWithinHall(candidate.x, candidate.y, rotation)) {
                return false;
            }
            if (this.room.collidesWithColumns(candidate.x, candidate.y, rotation)) {
                return false;
            }
            return !this.state.collidesWithTables(candidate.x, candidate.y, table.id, rotation, movingIds);
        });
        if (!isValid) {
            return;
        }
        this.dragContext.tables.forEach((table, index) => {
            const candidate = candidates[index];
            table.x = candidate.x;
            table.y = candidate.y;
        });
        this.renderTablesOnly();
    }

    finalizeTableDrag() {
        if (this.dragContext?.snapshot) {
            this.pushHistory(this.dragContext.snapshot);
        }
        this.state.recomputeGroups();
        this.state.recomputeChairs();
        this.persistLocal();
        this.render();
    }

    updateSelectionBox() {
        if (!this.selectionState?.active) {
            this.hideSelectionBox();
            return;
        }
        const { selectionBox } = this.elements;
        selectionBox.classList.remove('hidden');
        const minX = Math.min(this.selectionState.start.x, this.selectionState.current.x);
        const maxX = Math.max(this.selectionState.start.x, this.selectionState.current.x);
        const minY = Math.min(this.selectionState.start.y, this.selectionState.current.y);
        const maxY = Math.max(this.selectionState.start.y, this.selectionState.current.y);
        selectionBox.style.left = `${this.room.metersToPixels(minX)}px`;
        selectionBox.style.top = `${this.room.metersToPixels(this.room.height - maxY)}px`;
        selectionBox.style.width = `${this.room.metersToPixels(maxX - minX)}px`;
        selectionBox.style.height = `${this.room.metersToPixels(maxY - minY)}px`;
    }

    hideSelectionBox() {
        this.elements.selectionBox.classList.add('hidden');
    }

    onChairClick(event, table, chair) {
        event.stopPropagation();
        this.openChairModal(table, chair);
    }

    onChairDragEnter(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drop-target');
    }

    onChairDragLeave(event) {
        event.currentTarget.classList.remove('drop-target');
    }

    onChairDragOver(event) {
        event.preventDefault();
    }

    onChairDrop(event, table, chair) {
        event.preventDefault();
        event.currentTarget.classList.remove('drop-target');
        if (!this.draggingGuestId) {
            return;
        }
        this.pushHistory();
        this.state.assignGuestToChair(this.draggingGuestId, chair.id);
        this.draggingGuestId = null;
        this.persistLocal();
        this.renderTablesOnly();
        this.renderGuests();
        this.renderSummary();
    }

    onGuestDragStart(event, guest) {
        this.draggingGuestId = guest.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', guest.id);
    }

    onGuestDragEnd() {
        this.draggingGuestId = null;
    }

    openChairModal(table, chair) {
        this.currentChair = { tableId: table.id, chairId: chair.id };
        const guest = chair.guestId ? this.state.getGuestById(chair.guestId) : null;
        this.elements.chairGuestInput.value = guest ? guest.name : '';
        this.elements.chairModal.classList.remove('hidden');
    }

    hideChairModal() {
        this.currentChair = null;
        this.elements.chairModal.classList.add('hidden');
    }

    clearCurrentChair() {
        if (!this.currentChair) return;
        this.pushHistory();
        this.state.clearChair(this.currentChair.chairId);
        this.hideChairModal();
        this.persistLocal();
        this.render();
    }

    onChairFormSubmit(event) {
        event.preventDefault();
        if (!this.currentChair) {
            return;
        }
        const name = this.elements.chairGuestInput.value.trim();
        this.pushHistory();
        if (!name) {
            this.state.clearChair(this.currentChair.chairId);
        } else {
            let guest = this.state.guests.find(item => item.name.toLowerCase() === name.toLowerCase());
            if (!guest) {
                guest = this.state.addGuest(name);
            }
            this.state.assignGuestToChair(guest.id, this.currentChair.chairId);
        }
        this.hideChairModal();
        this.persistLocal();
        this.render();
    }

    openTableModal(tableId) {
        const table = this.state.tables.find(item => item.id === tableId);
        if (!table) return;
        this.currentTableId = tableId;
        this.elements.tableDescriptionInput.value = table.description;
        this.elements.tableRotationSelect.value = String(table.rotation);
        this.elements.tableHeadCheckbox.checked = table.isHead;
        this.updateHeadSeatField(table.isHead);
        this.elements.tableHeadSeatsSelect.value = String(table.headSeatCount);
        this.elements.tableModal.classList.remove('hidden');
    }

    hideTableModal() {
        this.currentTableId = null;
        this.elements.tableModal.classList.add('hidden');
    }

    updateHeadSeatField(show) {
        if (show) {
            this.elements.tableHeadSeatsField.classList.remove('hidden');
        } else {
            this.elements.tableHeadSeatsField.classList.add('hidden');
        }
    }

    onTableFormSubmit(event) {
        event.preventDefault();
        if (!this.currentTableId) {
            return;
        }
        const table = this.state.tables.find(item => item.id === this.currentTableId);
        if (!table) return;
        this.pushHistory();
        table.setDescription(this.elements.tableDescriptionInput.value.trim());
        table.setRotation(Number(this.elements.tableRotationSelect.value));
        const isHead = this.elements.tableHeadCheckbox.checked;
        table.setHead(isHead);
        if (isHead) {
            table.setHeadSeatCount(Number(this.elements.tableHeadSeatsSelect.value));
        }
        this.state.recomputeGroups();
        this.state.recomputeChairs();
        this.hideTableModal();
        this.persistLocal();
        this.render();
    }
}
