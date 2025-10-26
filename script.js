(() => {
    const SCALE = 40;
    const TABLE_LENGTH = 2.3;
    const TABLE_WIDTH = 1.0;
    const HALL_WIDTH = 25;
    const HALL_HEIGHT = 11;
    const CHAIR_OFFSET = 0.4;
    const CHAIR_SIZE = 0.45;
    const SNAP_STEP = 0.25;
    const CONNECT_THRESHOLD = 0.2;
    const AUTO_SAVE_MS = 10000;
    const LOCAL_STORAGE_KEY = 'stara_podkowa_planer_state_v1';

    const hallPolygon = [
        { x: 0, y: 0 },
        { x: 4.3, y: 0 },
        { x: 4.3, y: 2.3 },
        { x: 0, y: 5.3 },
        { x: 0, y: HALL_HEIGHT },
        { x: HALL_WIDTH, y: HALL_HEIGHT },
        { x: HALL_WIDTH, y: 0 },
        { x: 0, y: 0 }
    ];

    const pillars = [5, 10, 15, 20].map(x => ({
        x,
        y: 5.5,
        width: 0.4,
        height: 0.4
    }));

    const references = [
        { from: { x: 0, y: 5.3 }, to: { x: 0, y: 11 }, label: 'Wejście na zaplecze' },
        { from: { x: 8, y: 11 }, to: { x: 14, y: 11 }, label: 'Brama na łąkę' },
        { from: { x: 16, y: 11 }, to: { x: 22, y: 11 }, label: 'Przeszklona brama' },
        { from: { x: 11.5, y: 0 }, to: { x: 13.5, y: 0 }, label: 'Wejście' }
    ];

    const plannerContainer = document.getElementById('plannerContainer');
    const hallSvg = document.getElementById('hallSvg');
    const entitiesLayer = document.getElementById('entitiesLayer');
    const tableCountInput = document.getElementById('tableCount');
    const tableCountValue = document.getElementById('tableCountValue');
    const modeToggle = document.getElementById('modeToggle');
    const modeLabel = document.getElementById('modeLabel');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const resetBtn = document.getElementById('resetBtn');
    const shareBtn = document.getElementById('shareBtn');
    const summaryTables = document.getElementById('summaryTables');
    const summarySeatsTotal = document.getElementById('summarySeatsTotal');
    const summarySeatsFree = document.getElementById('summarySeatsFree');
    const summaryAssigned = document.getElementById('summaryAssigned');
    const summaryUnassigned = document.getElementById('summaryUnassigned');
    const guestForm = document.getElementById('guestForm');
    const guestNameInput = document.getElementById('guestName');
    const guestList = document.getElementById('guestList');
    const chairModal = document.getElementById('chairModal');
    const chairForm = document.getElementById('chairForm');
    const chairGuestInput = document.getElementById('chairGuest');
    const chairModalClose = document.getElementById('modalClose');
    const clearChairBtn = document.getElementById('clearChair');
    const shareResult = document.getElementById('shareResult');
    const gridToggle = document.getElementById('gridToggle');

    let chairContext = null;
    let autoSaveTimer = null;

    const history = {
        past: [],
        future: []
    };

    let state = createEmptyState();

    function createEmptyState() {
        return {
            version: 2,
            tables: [],
            guests: [],
            settings: {
                mode: 'less',
                tableCount: 4
            }
        };
    }

    function deepCopy(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function pushHistory() {
        history.past.push(deepCopy(state));
        if (history.past.length > 100) {
            history.past.shift();
        }
        history.future.length = 0;
        updateUndoRedoButtons();
    }

    function undo() {
        if (!history.past.length) {
            return;
        }
        history.future.push(deepCopy(state));
        state = history.past.pop();
        updateUndoRedoButtons();
        render();
        persistLocal();
    }

    function redo() {
        if (!history.future.length) {
            return;
        }
        history.past.push(deepCopy(state));
        state = history.future.pop();
        updateUndoRedoButtons();
        render();
        persistLocal();
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = history.past.length === 0;
        redoBtn.disabled = history.future.length === 0;
    }

    function metersToPixels(value) {
        return value * SCALE;
    }

    function toScreenY(value) {
        return metersToPixels(HALL_HEIGHT - value);
    }

    function positionTableElement(tableElement, table) {
        tableElement.style.left = `${metersToPixels(table.x - TABLE_LENGTH / 2)}px`;
        tableElement.style.top = `${metersToPixels(HALL_HEIGHT - table.y - TABLE_WIDTH / 2)}px`;
    }

    function positionChairElement(chairElement, chair) {
        chairElement.style.left = `${metersToPixels(chair.x - CHAIR_SIZE / 2)}px`;
        chairElement.style.top = `${metersToPixels(HALL_HEIGHT - chair.y - CHAIR_SIZE / 2)}px`;
    }

    function renderHall() {
        hallSvg.setAttribute('viewBox', `0 0 ${metersToPixels(HALL_WIDTH)} ${metersToPixels(HALL_HEIGHT)}`);
        hallSvg.innerHTML = '';

        const hallPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        hallPath.setAttribute('points', hallPolygon.map(p => `${metersToPixels(p.x)},${toScreenY(p.y)}`).join(' '));
        hallPath.setAttribute('fill', '#e0f2fe');
        hallPath.setAttribute('stroke', '#1d4ed8');
        hallPath.setAttribute('stroke-width', '2');
        hallSvg.appendChild(hallPath);

        pillars.forEach(pillar => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', metersToPixels(pillar.x - pillar.width / 2));
            rect.setAttribute('y', metersToPixels(HALL_HEIGHT - pillar.y - pillar.height / 2));
            rect.setAttribute('width', metersToPixels(pillar.width));
            rect.setAttribute('height', metersToPixels(pillar.height));
            rect.setAttribute('rx', metersToPixels(0.05));
            rect.setAttribute('ry', metersToPixels(0.05));
            rect.classList.add('pillar');
            hallSvg.appendChild(rect);
        });

        references.forEach(ref => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('reference');
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', metersToPixels(ref.from.x));
            line.setAttribute('y1', toScreenY(ref.from.y));
            line.setAttribute('x2', metersToPixels(ref.to.x));
            line.setAttribute('y2', toScreenY(ref.to.y));
            group.appendChild(line);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const textX = (ref.from.x + ref.to.x) / 2;
            const textY = (ref.from.y + ref.to.y) / 2;
            text.setAttribute('x', metersToPixels(textX));
            text.setAttribute('y', toScreenY(textY) - 6);
            text.setAttribute('text-anchor', 'middle');
            text.textContent = ref.label;
            group.appendChild(text);
            hallSvg.appendChild(group);
        });
    }

    function computeDefaultTables(count) {
        const positions = [];
        const rows = [2.2, 4.2, 6.2, 8.2];
        const maxCols = 4;
        const spacingX = TABLE_LENGTH + 1.2;
        const startX = 11.8;
        for (let row of rows) {
            for (let col = 0; col < maxCols; col++) {
                if (positions.length >= count) {
                    break;
                }
                const x = startX + col * spacingX;
                const candidate = { x, y: row };
                if (isPositionWithinHall(candidate.x, candidate.y) && !collidesWithColumns(candidate.x, candidate.y, null) && !defaultWouldCollide(candidate, positions)) {
                    positions.push(candidate);
                }
            }
            if (positions.length >= count) {
                break;
            }
        }
        return positions;
    }

    function defaultWouldCollide(candidate, placed) {
        return placed.some(p => rectanglesIntersect(tableRect(candidate.x, candidate.y), tableRect(p.x, p.y)));
    }

    function createDefaultState(tableCount) {
        const newState = createEmptyState();
        newState.settings.tableCount = tableCount;
        const positions = computeDefaultTables(tableCount);
        positions.forEach((pos, index) => {
            const tableId = `t${index + 1}`;
            newState.tables.push({
                id: tableId,
                number: index + 1,
                x: pos.x,
                y: pos.y,
                rotation: 0,
                description: '',
                chairs: [],
                groupId: tableId
            });
        });
        recomputeGroups(newState);
        recomputeChairs(newState);
        return newState;
    }

    function tableRect(x, y) {
        return {
            left: x - TABLE_LENGTH / 2,
            right: x + TABLE_LENGTH / 2,
            top: y - TABLE_WIDTH / 2,
            bottom: y + TABLE_WIDTH / 2
        };
    }

    function rectanglesIntersect(a, b) {
        return !(a.left >= b.right || a.right <= b.left || a.top >= b.bottom || a.bottom <= b.top);
    }

    function collidesWithColumns(x, y, ignoreTableId) {
        const rect = tableRect(x, y);
        return pillars.some(pillar => {
            const pillarRect = {
                left: pillar.x - pillar.width / 2,
                right: pillar.x + pillar.width / 2,
                top: pillar.y - pillar.height / 2,
                bottom: pillar.y + pillar.height / 2
            };
            return !(rect.left >= pillarRect.right || rect.right <= pillarRect.left || rect.top >= pillarRect.bottom || rect.bottom <= pillarRect.top);
        });
    }

    function isPositionWithinHall(x, y) {
        const rect = tableRect(x, y);
        const corners = [
            { x: rect.left, y: rect.top },
            { x: rect.right, y: rect.top },
            { x: rect.right, y: rect.bottom },
            { x: rect.left, y: rect.bottom }
        ];
        return corners.every(pt => pointInPolygon(pt, hallPolygon));
    }

    function pointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 1e-9) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function collidesWithTables(x, y, movingTableId) {
        const rect = tableRect(x, y);
        return state.tables.some(table => {
            if (table.id === movingTableId) return false;
            const otherRect = tableRect(table.x, table.y);
            return rectanglesIntersect(rect, otherRect);
        });
    }

    function snap(value) {
        return Math.round(value / SNAP_STEP) * SNAP_STEP;
    }

    function recomputeGroups(currentState) {
        const adjacency = new Map();
        currentState.tables.forEach(table => adjacency.set(table.id, new Set()));
        for (let i = 0; i < currentState.tables.length; i++) {
            for (let j = i + 1; j < currentState.tables.length; j++) {
                const a = currentState.tables[i];
                const b = currentState.tables[j];
                if (tablesShouldConnect(a, b)) {
                    adjacency.get(a.id).add(b.id);
                    adjacency.get(b.id).add(a.id);
                    alignTables(a, b);
                }
            }
        }
        const visited = new Set();
        currentState.tables.forEach(table => {
            if (visited.has(table.id)) return;
            const queue = [table.id];
            const groupId = queue[0];
            while (queue.length) {
                const current = queue.shift();
                if (visited.has(current)) continue;
                visited.add(current);
                const t = currentState.tables.find(item => item.id === current);
                if (t) {
                    t.groupId = groupId;
                }
                adjacency.get(current).forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                });
            }
        });
    }

    function tablesShouldConnect(a, b) {
        if (Math.abs(a.y - b.y) > 0.15) return false;
        const distance = Math.abs(a.x - b.x);
        return Math.abs(distance - TABLE_LENGTH) <= CONNECT_THRESHOLD;
    }

    function alignTables(a, b) {
        if (Math.abs(a.y - b.y) <= 0.15) {
            const averageY = (a.y + b.y) / 2;
            a.y = averageY;
            b.y = averageY;
        }
        if (a.x < b.x) {
            b.x = a.x + TABLE_LENGTH;
        } else {
            a.x = b.x + TABLE_LENGTH;
        }
    }

    function recomputeChairs(currentState) {
        const groups = new Map();
        currentState.tables.forEach(table => {
            if (!groups.has(table.groupId)) {
                groups.set(table.groupId, []);
            }
            groups.get(table.groupId).push(table);
        });

        const mode = currentState.settings.mode;
        const basePerSide = mode === 'less' ? 3 : 4;

        const previousAssignments = new Map();
        currentState.tables.forEach(table => {
            previousAssignments.set(table.id, table.chairs.map(chair => ({ id: chair.id, guestId: chair.guestId })));
        });

        const removedGuests = new Set();

        groups.forEach(tablesInGroup => {
            tablesInGroup.sort((a, b) => a.x - b.x);
            const groupStart = tablesInGroup[0].x - TABLE_LENGTH / 2;
            const groupEnd = tablesInGroup[tablesInGroup.length - 1].x + TABLE_LENGTH / 2;
            const usableLength = groupEnd - groupStart - 0.3;
            const connections = Math.max(0, tablesInGroup.length - 1);
            const chairsPerSide = basePerSide * tablesInGroup.length + connections;
            const positionsTop = [];
            const positionsBottom = [];
            const step = chairsPerSide > 1 ? usableLength / (chairsPerSide - 1) : 0;
            const centerY = tablesInGroup.reduce((sum, t) => sum + t.y, 0) / tablesInGroup.length;
            const offsetY = TABLE_WIDTH / 2 + CHAIR_OFFSET;
            for (let i = 0; i < chairsPerSide; i++) {
                const x = groupStart + 0.15 + i * step;
                positionsTop.push({ x, y: centerY + offsetY });
                positionsBottom.push({ x, y: centerY - offsetY });
            }
            const allPositions = [...positionsTop.map((pos, idx) => ({ ...pos, side: 'top', order: idx })), ...positionsBottom.map((pos, idx) => ({ ...pos, side: 'bottom', order: idx }))];

            tablesInGroup.forEach(table => {
                const rect = tableRect(table.x, table.y);
                const relevant = allPositions.filter(pos => pos.x >= rect.left - 1e-6 && pos.x <= rect.right + 1e-6);
                relevant.sort((a, b) => a.side.localeCompare(b.side) || a.order - b.order);
                const prev = previousAssignments.get(table.id) || [];
                const newChairs = relevant.map((pos, index) => {
                    const prevEntry = prev[index];
                    return {
                        id: `${table.id}_c${index + 1}`,
                        x: pos.x,
                        y: pos.y,
                        side: pos.side,
                        guestId: prevEntry ? prevEntry.guestId : null
                    };
                });
                if (prev.length > newChairs.length) {
                    prev.slice(newChairs.length).forEach(item => {
                        if (item.guestId) {
                            removedGuests.add(item.guestId);
                        }
                    });
                }
                table.chairs = newChairs;
            });
        });

        if (removedGuests.size) {
            state.guests.forEach(guest => {
                if (removedGuests.has(guest.id)) {
                    guest.assignedTo = null;
                }
            });
        }
    }

    function applyRemovedGuestFallback() {
        // Ensure guests removed from chairs go back to unassigned list
        const assignedSeats = new Set();
        state.tables.forEach(table => {
            table.chairs.forEach(chair => {
                if (chair.guestId) {
                    assignedSeats.add(chair.guestId);
                }
            });
        });
        state.guests.forEach(guest => {
            if (guest.assignedTo && !assignedSeats.has(guest.id)) {
                guest.assignedTo = null;
            }
        });
    }

    function renderTables() {
        entitiesLayer.innerHTML = '';
        state.tables.forEach(table => {
            const tableEl = document.createElement('div');
            tableEl.className = 'table';
            tableEl.style.width = `${metersToPixels(TABLE_LENGTH)}px`;
            tableEl.style.height = `${metersToPixels(TABLE_WIDTH)}px`;
            positionTableElement(tableEl, table);
            tableEl.dataset.tableId = table.id;

            const label = document.createElement('div');
            label.className = 'table-label';
            label.textContent = table.description ? `Stół ${table.number}: ${table.description}` : `Stół ${table.number}`;
            tableEl.appendChild(label);

            if (table.description) {
                const description = document.createElement('div');
                description.className = 'table-description';
                description.textContent = table.description;
                tableEl.appendChild(description);
            }

            tableEl.addEventListener('pointerdown', onTablePointerDown);
            tableEl.addEventListener('dblclick', () => {
                const newDescription = prompt('Opis stołu', table.description || '');
                if (newDescription !== null) {
                    pushHistory();
                    table.description = newDescription.trim();
                    render();
                    persistLocal();
                }
            });

            entitiesLayer.appendChild(tableEl);

            table.chairs.forEach(chair => {
                const chairEl = document.createElement('div');
                chairEl.className = 'chair';
                if (chair.guestId) {
                    const guest = state.guests.find(g => g.id === chair.guestId);
                    if (guest) {
                        chairEl.classList.add('assigned');
                        chairEl.textContent = initials(guest.name);
                        chairEl.title = guest.name;
                    }
                }
                positionChairElement(chairEl, chair);
                chairEl.dataset.tableId = table.id;
                chairEl.dataset.chairId = chair.id;
                chairEl.addEventListener('click', onChairClick);
                entitiesLayer.appendChild(chairEl);
            });
        });
    }

    function initials(name) {
        return name.split(/\s+/).filter(Boolean).map(part => part[0].toUpperCase()).slice(0, 2).join('');
    }

    function renderSummary() {
        summaryTables.textContent = String(state.tables.length);
        const totalSeats = state.tables.reduce((sum, table) => sum + table.chairs.length, 0);
        const occupiedSeats = state.tables.reduce((sum, table) => sum + table.chairs.filter(chair => chair.guestId).length, 0);
        const freeSeats = Math.max(0, totalSeats - occupiedSeats);
        summarySeatsTotal.textContent = String(totalSeats);
        summarySeatsFree.textContent = String(freeSeats);
        const assignedGuests = state.guests.filter(guest => guest.assignedTo).length;
        const unassignedGuests = state.guests.length - assignedGuests;
        summaryAssigned.textContent = String(assignedGuests);
        summaryUnassigned.textContent = String(unassignedGuests);
        tableCountInput.value = state.settings.tableCount;
        tableCountValue.textContent = String(state.settings.tableCount);
        modeToggle.checked = state.settings.mode === 'more';
        modeLabel.textContent = state.settings.mode === 'more' ? 'Więcej osób' : 'Mniej osób';
    }

    function renderGuests() {
        guestList.innerHTML = '';
        state.guests
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
            .forEach(guest => {
                const li = document.createElement('li');
                if (guest.assignedTo) {
                    li.classList.add('assigned');
                }
                const nameSpan = document.createElement('span');
                nameSpan.textContent = guest.name;
                const status = document.createElement('span');
                status.className = 'status';
                status.textContent = guest.assignedTo ? 'przypisany' : 'wolny';
                li.appendChild(nameSpan);
                li.appendChild(status);
                guestList.appendChild(li);
            });
    }

    function render() {
        renderTables();
        renderSummary();
        renderGuests();
    }

    function onTablePointerDown(event) {
        const tableId = event.currentTarget.dataset.tableId;
        const table = state.tables.find(t => t.id === tableId);
        if (!table) return;
        event.preventDefault();
        pushHistory();
        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        const initialX = table.x;
        const initialY = table.y;
        const originalChairPositions = new Map();
        const chairOffsets = new Map();
        table.chairs.forEach(chair => {
            originalChairPositions.set(chair.id, { x: chair.x, y: chair.y });
            chairOffsets.set(chair.id, {
                offsetX: chair.x - table.x,
                offsetY: chair.y - table.y,
                element: entitiesLayer.querySelector(`.chair[data-chair-id="${chair.id}"]`)
            });
        });
        const tableElement = event.currentTarget;
        tableElement.classList.add('dragging');
        if (tableElement.setPointerCapture) {
            try {
                tableElement.setPointerCapture(pointerId);
            } catch (error) {
                // ignore pointer capture errors
            }
        }

        const applyChairOffsets = () => {
            chairOffsets.forEach((info, chairId) => {
                const chair = table.chairs.find(c => c.id === chairId);
                if (!chair) return;
                chair.x = table.x + info.offsetX;
                chair.y = table.y + info.offsetY;
                if (info.element) {
                    positionChairElement(info.element, chair);
                }
            });
        };

        const onMove = moveEvent => {
            moveEvent.preventDefault();
            const deltaX = (moveEvent.clientX - startX) / SCALE;
            const deltaY = (moveEvent.clientY - startY) / SCALE;
            table.x = initialX + deltaX;
            table.y = initialY - deltaY;
            positionTableElement(tableElement, table);
            applyChairOffsets();
        };

        const onUp = upEvent => {
            upEvent.preventDefault();
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            if (tableElement.releasePointerCapture) {
                try {
                    tableElement.releasePointerCapture(pointerId);
                } catch (error) {
                    // ignore release errors
                }
            }
            tableElement.classList.remove('dragging');

            table.x = snap(table.x);
            table.y = snap(table.y);
            applyChairOffsets();

            const connection = findConnection(table);
            if (connection) {
                table.x = connection.x;
                table.y = connection.y;
                applyChairOffsets();
            }

            if (!isPositionWithinHall(table.x, table.y) || collidesWithColumns(table.x, table.y, table.id) || collidesWithTables(table.x, table.y, table.id)) {
                table.x = initialX;
                table.y = initialY;
                table.chairs.forEach(chair => {
                    const original = originalChairPositions.get(chair.id);
                    if (original) {
                        chair.x = original.x;
                        chair.y = original.y;
                    }
                });
            }

            recomputeGroups(state);
            recomputeChairs(state);
            applyRemovedGuestFallback();
            render();
            persistLocal();
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }

    function findConnection(table) {
        let best = null;
        state.tables.forEach(other => {
            if (other.id === table.id) return;
            if (Math.abs(other.y - table.y) > 0.2) return;
            const distance = Math.abs(other.x - table.x);
            if (Math.abs(distance - TABLE_LENGTH) <= CONNECT_THRESHOLD) {
                const targetX = other.x > table.x ? other.x - TABLE_LENGTH : other.x + TABLE_LENGTH;
                best = { x: targetX, y: other.y };
            }
        });
        return best;
    }

    function onChairClick(event) {
        const tableId = event.currentTarget.dataset.tableId;
        const chairId = event.currentTarget.dataset.chairId;
        chairContext = { tableId, chairId };
        const table = state.tables.find(t => t.id === tableId);
        const chair = table ? table.chairs.find(c => c.id === chairId) : null;
        if (!chair) return;
        const guest = chair.guestId ? state.guests.find(g => g.id === chair.guestId) : null;
        chairGuestInput.value = guest ? guest.name : '';
        chairModal.classList.remove('hidden');
        chairGuestInput.focus();
    }

    function closeChairModal() {
        chairModal.classList.add('hidden');
        chairGuestInput.value = '';
        chairContext = null;
    }

    chairModalClose.addEventListener('click', closeChairModal);
    chairModal.addEventListener('click', event => {
        if (event.target === chairModal) {
            closeChairModal();
        }
    });

    chairForm.addEventListener('submit', event => {
        event.preventDefault();
        if (!chairContext) return;
        const name = chairGuestInput.value.trim();
        const table = state.tables.find(t => t.id === chairContext.tableId);
        if (!table) return;
        const chair = table.chairs.find(c => c.id === chairContext.chairId);
        if (!chair) return;

        pushHistory();

        if (!name) {
            if (chair.guestId) {
                const guest = state.guests.find(g => g.id === chair.guestId);
                if (guest) {
                    guest.assignedTo = null;
                }
                chair.guestId = null;
            }
            closeChairModal();
            render();
            persistLocal();
            return;
        }

        let guest = state.guests.find(g => g.name.toLowerCase() === name.toLowerCase());
        if (guest && guest.assignedTo && guest.assignedTo !== chair.id) {
            const confirmDuplicate = confirm(`${guest.name} jest już przypisany/a do innego miejsca. Czy chcesz kontynuować?`);
            if (!confirmDuplicate) {
                closeChairModal();
                return;
            }
        }

        if (!guest) {
            guest = {
                id: `g${Date.now()}${Math.random().toString(16).slice(2)}`,
                name,
                assignedTo: null
            };
            state.guests.push(guest);
        }

        if (chair.guestId && chair.guestId !== guest.id) {
            const previousGuest = state.guests.find(g => g.id === chair.guestId);
            if (previousGuest) {
                previousGuest.assignedTo = null;
            }
        }

        guest.assignedTo = chair.id;
        chair.guestId = guest.id;

        closeChairModal();
        render();
        persistLocal();
    });

    clearChairBtn.addEventListener('click', () => {
        if (!chairContext) return;
        const table = state.tables.find(t => t.id === chairContext.tableId);
        if (!table) return;
        const chair = table.chairs.find(c => c.id === chairContext.chairId);
        if (!chair) return;
        pushHistory();
        if (chair.guestId) {
            const guest = state.guests.find(g => g.id === chair.guestId);
            if (guest) {
                guest.assignedTo = null;
            }
            chair.guestId = null;
        }
        closeChairModal();
        render();
        persistLocal();
    });

    guestForm.addEventListener('submit', event => {
        event.preventDefault();
        const name = guestNameInput.value.trim();
        if (!name) return;
        pushHistory();
        if (!state.guests.some(g => g.name.toLowerCase() === name.toLowerCase())) {
            state.guests.push({
                id: `g${Date.now()}${Math.random().toString(16).slice(2)}`,
                name,
                assignedTo: null
            });
        }
        guestNameInput.value = '';
        renderGuests();
        renderSummary();
        persistLocal();
    });

    tableCountInput.addEventListener('input', event => {
        const count = Number(event.target.value);
        tableCountValue.textContent = String(count);
    });

    tableCountInput.addEventListener('change', event => {
        const newCount = Number(event.target.value);
        adjustTableCount(newCount);
    });

    modeToggle.addEventListener('change', () => {
        const mode = modeToggle.checked ? 'more' : 'less';
        if (mode === state.settings.mode) return;
        pushHistory();
        state.settings.mode = mode;
        recomputeChairs(state);
        applyRemovedGuestFallback();
        render();
        persistLocal();
    });

    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    resetBtn.addEventListener('click', () => {
        if (!confirm('Czy na pewno chcesz zresetować układ sali?')) {
            return;
        }
        pushHistory();
        state = createDefaultState(state.settings.tableCount);
        render();
        persistLocal();
    });

    shareBtn.addEventListener('click', async () => {
        try {
            shareBtn.disabled = true;
            shareBtn.textContent = 'Zapisywanie...';
            const response = await fetch('save.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(state)
            });
            if (!response.ok) {
                throw new Error('Nie udało się zapisać planu');
            }
            const data = await response.json();
            if (data && data.url) {
                shareResult.classList.remove('hidden');
                shareResult.innerHTML = `<strong>Link do planu:</strong><br><a href="${data.url}">${data.url}</a>`;
                if (navigator.clipboard) {
                    try {
                        await navigator.clipboard.writeText(data.url);
                        shareResult.innerHTML += '<p>Link został skopiowany do schowka.</p>';
                    } catch (err) {
                        // ignore clipboard errors
                    }
                }
            }
        } catch (error) {
            alert(error.message);
        } finally {
            shareBtn.disabled = false;
            shareBtn.textContent = 'Udostępnij link do planu stołów';
        }
    });

    gridToggle.addEventListener('change', () => {
        plannerContainer.classList.toggle('no-grid', !gridToggle.checked);
    });

    function adjustTableCount(newCount) {
        if (newCount === state.tables.length) {
            state.settings.tableCount = newCount;
            renderSummary();
            persistLocal();
            return;
        }
        pushHistory();
        if (newCount > state.tables.length) {
            while (state.tables.length < newCount) {
                addTable();
            }
        } else {
            removeTables(state.tables.length - newCount);
        }
        state.settings.tableCount = newCount;
        ensureTableNumbers();
        recomputeGroups(state);
        recomputeChairs(state);
        applyRemovedGuestFallback();
        render();
        persistLocal();
    }

    function ensureTableNumbers() {
        state.tables.forEach((table, index) => {
            table.number = index + 1;
        });
    }

    function addTable() {
        const newId = `t${Date.now()}${Math.random().toString(16).slice(2)}`;
        const defaultPositions = computeDefaultTables(state.tables.length + 1);
        let position = defaultPositions[state.tables.length];
        if (!position) {
            position = findFreeSpot();
        }
        state.tables.push({
            id: newId,
            number: state.tables.length + 1,
            x: position.x,
            y: position.y,
            rotation: 0,
            description: '',
            chairs: [],
            groupId: newId
        });
    }

    function findFreeSpot() {
        for (let x = 11.5; x <= 23; x += 0.5) {
            for (let y = 1.5; y <= 9.5; y += 0.5) {
                if (isPositionWithinHall(x, y) && !collidesWithColumns(x, y, null) && !collidesWithTables(x, y, null)) {
                    return { x, y };
                }
            }
        }
        return { x: 12, y: 2 };
    }

    function removeTables(count) {
        const tablesWithGuests = state.tables.map(table => ({
            table,
            guestCount: table.chairs.filter(chair => chair.guestId).length
        }));
        const withoutGuests = tablesWithGuests.filter(item => item.guestCount === 0).map(item => item.table);
        const toRemove = [];
        withoutGuests.slice(0, count).forEach(table => toRemove.push(table));
        if (toRemove.length < count) {
            const remaining = count - toRemove.length;
            const candidates = tablesWithGuests
                .filter(item => item.guestCount > 0)
                .sort((a, b) => a.guestCount - b.guestCount);
            if (candidates.length) {
                const confirmRemoval = confirm('Aby osiągnąć żądaną liczbę stołów, konieczne będzie usunięcie stołów z gośćmi. Kontynuować?');
                if (!confirmRemoval) {
                    history.past.pop();
                    updateUndoRedoButtons();
                    tableCountInput.value = state.tables.length;
                    tableCountValue.textContent = String(state.tables.length);
                    return;
                }
            }
            candidates.slice(0, remaining).forEach(item => toRemove.push(item.table));
        }

        toRemove.forEach(table => {
            table.chairs.forEach(chair => {
                if (chair.guestId) {
                    const guest = state.guests.find(g => g.id === chair.guestId);
                    if (guest) {
                        guest.assignedTo = null;
                    }
                }
            });
            state.tables = state.tables.filter(t => t.id !== table.id);
        });
    }

    function persistLocal() {
        state.version = 2;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    }

    function loadFromLocalStorage() {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.error('Nie udało się wczytać danych z localStorage', error);
            return null;
        }
    }

    function scheduleAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
        }
        autoSaveTimer = setInterval(() => {
            persistLocal();
        }, AUTO_SAVE_MS);
    }

    async function loadFromServerIfNeeded() {
        const planId = plannerContainer.dataset.planId;
        if (!planId) {
            return null;
        }
        try {
            const response = await fetch(`load.php?id=${encodeURIComponent(planId)}`);
            if (!response.ok) {
                throw new Error('Nie udało się wczytać planu z serwera.');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(error);
            alert(error.message);
            return null;
        }
    }

    function hydrateState(data) {
        state = createEmptyState();
        const sourceVersion = data.version || 1;
        const needsFlip = sourceVersion < 2;
        state.settings = data.settings || state.settings;
        state.tables = (data.tables || []).map((table, index) => ({
            id: table.id || `t${index + 1}`,
            number: table.number || index + 1,
            x: table.x,
            y: needsFlip && typeof table.y === 'number' ? HALL_HEIGHT - table.y : table.y,
            rotation: table.rotation || 0,
            description: table.description || '',
            chairs: Array.isArray(table.chairs) ? table.chairs.map((chair, chairIndex) => ({
                id: chair.id || `${table.id}_c${chairIndex + 1}`,
                x: chair.x,
                y: needsFlip && typeof chair.y === 'number' ? HALL_HEIGHT - chair.y : chair.y,
                side: chair.side || 'top',
                guestId: chair.guest || chair.guestId || null
            })) : [],
            groupId: table.groupId || table.id
        }));
        state.version = 2;
        state.guests = Array.isArray(data.guests) ? data.guests.map(guest => ({
            id: guest.id || `g${guest.name}`,
            name: guest.name,
            assignedTo: guest.assignedTo || guest.seatId || null
        })) : [];

        // ensure guests from chairs exist in guest list
        state.tables.forEach(table => {
            table.chairs.forEach(chair => {
                if (chair.guestId && !state.guests.some(g => g.id === chair.guestId)) {
                    const name = typeof chair.guest === 'string' ? chair.guest : 'Gość';
                    state.guests.push({
                        id: chair.guestId,
                        name,
                        assignedTo: chair.id
                    });
                }
            });
        });

        recomputeGroups(state);
        recomputeChairs(state);
        applyRemovedGuestFallback();
    }

    async function init() {
        renderHall();
        const serverData = await loadFromServerIfNeeded();
        if (serverData) {
            hydrateState(serverData);
            persistLocal();
        } else {
            const local = loadFromLocalStorage();
            if (local) {
                hydrateState(local);
            } else {
                state = createDefaultState(4);
            }
        }
        render();
        scheduleAutoSave();
        updateUndoRedoButtons();
    }

    init();
})();
