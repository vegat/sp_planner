import { CHAIR_SIZE, HALL_HEIGHT } from '../core/constants.js';
import { tableHalfDimensionsForRotation } from '../utils/geometry.js';

export class PlannerRenderer {
    constructor({ room, state, elements, selectedTables }) {
        this.room = room;
        this.state = state;
        this.elements = elements;
        this.selectedTables = selectedTables;
        this.handlers = {
            onTablePointerDown: () => {},
            onTableSettings: () => {},
            onChairClick: () => {},
            onChairDragEnter: () => {},
            onChairDragLeave: () => {},
            onChairDragOver: () => {},
            onChairDrop: () => {},
            onGuestDragStart: () => {},
            onGuestDragEnd: () => {},
            onGuestRemove: () => {}
        };
    }

    setHandlers(handlers) {
        this.handlers = { ...this.handlers, ...handlers };
    }

    renderAll() {
        this.room.render();
        this.renderTables();
        this.renderGuests();
        this.renderSummary();
    }

    metersToPixels(value) {
        return this.room.metersToPixels(value);
    }

    toScreenY(value) {
        return this.room.toScreenY(value);
    }

    positionTableElement(element, table) {
        const dims = tableHalfDimensionsForRotation(table.rotation || 0);
        element.style.width = `${this.metersToPixels(dims.halfX * 2)}px`;
        element.style.height = `${this.metersToPixels(dims.halfY * 2)}px`;
        element.style.left = `${this.metersToPixels(table.x - dims.halfX)}px`;
        element.style.top = `${this.metersToPixels(HALL_HEIGHT - table.y - dims.halfY)}px`;
    }

    positionChairElement(element, chair) {
        element.style.left = `${this.metersToPixels(chair.x - CHAIR_SIZE / 2)}px`;
        element.style.top = `${this.metersToPixels(HALL_HEIGHT - chair.y - CHAIR_SIZE / 2)}px`;
    }

    renderTables() {
        const { entitiesLayer } = this.elements;
        entitiesLayer.innerHTML = '';
        const existingIds = new Set(this.state.tables.map(table => table.id));
        Array.from(this.selectedTables).forEach(id => {
            if (!existingIds.has(id)) {
                this.selectedTables.delete(id);
            }
        });
        this.state.tables.forEach(table => {
            const tableEl = document.createElement('div');
            tableEl.className = 'table';
            this.positionTableElement(tableEl, table);
            tableEl.dataset.tableId = table.id;
            if (table.orientation() === 'vertical') {
                tableEl.classList.add('table-vertical');
            }
            if (table.isHead) {
                tableEl.classList.add('table-head');
            }
            if (this.selectedTables.has(table.id)) {
                tableEl.classList.add('selected');
            }

            const label = document.createElement('div');
            label.className = 'table-label';
            const title = document.createElement('span');
            title.className = 'table-label-title';
            title.textContent = `Stół ${table.number}`;
            label.appendChild(title);
            if (table.description) {
                const subtitle = document.createElement('span');
                subtitle.className = 'table-label-subtitle';
                subtitle.textContent = table.description;
                label.appendChild(subtitle);
            }
            tableEl.appendChild(label);

            const settingsBtn = document.createElement('button');
            settingsBtn.type = 'button';
            settingsBtn.className = 'table-settings';
            settingsBtn.setAttribute('aria-label', 'Ustawienia stołu');
            settingsBtn.title = 'Ustawienia stołu';
            settingsBtn.textContent = '⚙️';
            settingsBtn.addEventListener('click', event => {
                event.stopPropagation();
                this.handlers.onTableSettings(table.id);
            });
            tableEl.appendChild(settingsBtn);

            tableEl.addEventListener('pointerdown', event => this.handlers.onTablePointerDown(event, table));

            entitiesLayer.appendChild(tableEl);

            table.chairs.forEach(chair => {
                const chairEl = document.createElement('div');
                chairEl.className = 'chair';
                if (chair.guestId) {
                    const guest = this.state.getGuestById(chair.guestId);
                    if (guest) {
                        chairEl.classList.add('assigned');
                        chairEl.textContent = guest.initials;
                        chairEl.title = guest.name;
                    }
                }
                this.positionChairElement(chairEl, chair);
                chairEl.dataset.tableId = table.id;
                chairEl.dataset.chairId = chair.id;
                chairEl.addEventListener('click', event => this.handlers.onChairClick(event, table, chair));
                chairEl.addEventListener('dragover', event => this.handlers.onChairDragOver(event, table, chair));
                chairEl.addEventListener('dragenter', event => this.handlers.onChairDragEnter(event, table, chair));
                chairEl.addEventListener('dragleave', event => this.handlers.onChairDragLeave(event, table, chair));
                chairEl.addEventListener('drop', event => this.handlers.onChairDrop(event, table, chair));
                entitiesLayer.appendChild(chairEl);
            });
        });
    }

    renderSummary() {
        const { summaryTables, summarySeatsTotal, summarySeatsFree, summaryAssigned, summaryUnassigned, tableCountInput, tableCountValue, modeToggle, modeLabel } = this.elements;
        const summary = this.state.summary;
        summaryTables.textContent = String(summary.tables);
        summarySeatsTotal.textContent = String(summary.totalSeats);
        summarySeatsFree.textContent = String(summary.freeSeats);
        summaryAssigned.textContent = String(summary.assignedGuests);
        summaryUnassigned.textContent = String(summary.unassignedGuests);
        tableCountInput.value = this.state.settings.tableCount;
        tableCountValue.textContent = String(this.state.settings.tableCount);
        modeToggle.checked = this.state.settings.mode === 'more';
        modeLabel.textContent = this.state.settings.mode === 'more' ? 'Więcej osób' : 'Mniej osób';
    }

    renderGuests() {
        const { guestList } = this.elements;
        guestList.innerHTML = '';
        this.state.guests.forEach(guest => {
            const li = document.createElement('li');
            li.className = guest.assignedTo ? 'guest assigned' : 'guest';
            li.dataset.guestId = guest.id;
            li.draggable = true;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'guest-name';
            nameSpan.textContent = guest.name;
            li.appendChild(nameSpan);

            const actions = document.createElement('div');
            actions.className = 'guest-actions';
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'guest-remove';
            removeBtn.textContent = 'Usuń';
            removeBtn.addEventListener('pointerdown', event => event.stopPropagation());
            removeBtn.addEventListener('click', event => {
                event.stopPropagation();
                this.handlers.onGuestRemove(guest);
            });
            actions.appendChild(removeBtn);
            li.appendChild(actions);
            li.addEventListener('dragstart', event => this.handlers.onGuestDragStart(event, guest));
            li.addEventListener('dragend', event => this.handlers.onGuestDragEnd(event, guest));
            guestList.appendChild(li);
        });
    }
}
