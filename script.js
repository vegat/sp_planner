(() => {
    let SCALE = 40;
    const TABLE_LENGTH = 2.3;
    const TABLE_WIDTH = 1.0;
    const HALL_WIDTH = 25;
    const HALL_HEIGHT = 11;
    const CHAIR_OFFSET = 0.4;
    const CHAIR_SIZE = 0.45;
    const SNAP_STEP = 0.25;
    const CONNECT_THRESHOLD = 0.2;
    const AUTO_SAVE_MS = 10000;
    const DEFAULT_TABLE_COUNT = 13;
    const HEAD_SEATS_MIN = 2;
    const HEAD_SEATS_MAX = 4;
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

    const defaultLayoutBlueprint = [
        { x: 12.5, y: 9.6, rotation: 0, isHead: true, headSeatCount: 4 },
        { x: 7.5, y: 7.6, rotation: 0 },
        { x: 12.5, y: 7.6, rotation: 0 },
        { x: 17.5, y: 7.6, rotation: 0 },
        { x: 21.5, y: 7.6, rotation: 0 },
        { x: 7.5, y: 5.4, rotation: 0 },
        { x: 12.5, y: 5.4, rotation: 0 },
        { x: 17.5, y: 5.4, rotation: 0 },
        { x: 21.5, y: 5.4, rotation: 0 },
        { x: 7.5, y: 3.0, rotation: 0 },
        { x: 12.5, y: 3.0, rotation: 0 },
        { x: 17.5, y: 3.0, rotation: 0 },
        { x: 21.5, y: 3.0, rotation: 0 },
        { x: 7.5, y: 1.1, rotation: 0 },
        { x: 17.5, y: 1.1, rotation: 0 },
        { x: 21.5, y: 1.1, rotation: 0 }
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
    const tableModal = document.getElementById('tableModal');
    const tableForm = document.getElementById('tableForm');
    const tableDescriptionInput = document.getElementById('tableDescription');
    const tableRotationSelect = document.getElementById('tableRotation');
    const tableHeadCheckbox = document.getElementById('tableHead');
    const tableHeadSeatsField = document.getElementById('tableHeadSeatsField');
    const tableHeadSeatsSelect = document.getElementById('tableHeadSeats');
    const tableModalClose = document.getElementById('tableModalClose');
    const tableModalCancel = document.getElementById('tableModalCancel');
    const plannerSection = document.querySelector('.planner');

    let chairContext = null;
    let tableContext = null;
    let autoSaveTimer = null;

    const history = {
        past: [],
        future: []
    };

    let state = createEmptyState();

    function createEmptyState() {
        return {
            version: 4,
            tables: [],
            guests: [],
            settings: {
                mode: 'less',
                tableCount: DEFAULT_TABLE_COUNT
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

    function normalizeRotation(rotation) {
        return Math.abs(rotation) % 180 === 90 ? 90 : 0;
    }

    function defaultHeadSeatCount(mode = (state && state.settings ? state.settings.mode : 'less')) {
        return mode === 'more' ? HEAD_SEATS_MAX : Math.min(HEAD_SEATS_MAX, 3);
    }

    function clampHeadSeatCount(value, mode = (state && state.settings ? state.settings.mode : 'less')) {
        if (!Number.isFinite(value)) {
            return defaultHeadSeatCount(mode);
        }
        return Math.min(HEAD_SEATS_MAX, Math.max(HEAD_SEATS_MIN, Math.round(value)));
    }

    function tableHalfDimensionsForRotation(rotation) {
        const normalized = normalizeRotation(rotation || 0);
        if (normalized === 90) {
            return {
                halfX: TABLE_WIDTH / 2,
                halfY: TABLE_LENGTH / 2
            };
        }
        return {
            halfX: TABLE_LENGTH / 2,
            halfY: TABLE_WIDTH / 2
        };
    }

    function tableRectAt(x, y, rotation) {
        const { halfX, halfY } = tableHalfDimensionsForRotation(rotation);
        return {
            left: x - halfX,
            right: x + halfX,
            top: y - halfY,
            bottom: y + halfY
        };
    }

    function tableRectFor(table) {
        return tableRectAt(table.x, table.y, table.rotation || 0);
    }

    function tableOrientation(table) {
        return normalizeRotation(table.rotation || 0) === 90 ? 'vertical' : 'horizontal';
    }

    function chooseHeadSide(table) {
        const orientation = tableOrientation(table);
        const rect = tableRectFor(table);
        if (orientation === 'horizontal') {
            const spaceTop = HALL_HEIGHT - rect.bottom;
            const spaceBottom = rect.top;
            return spaceTop <= spaceBottom ? 'top' : 'bottom';
        }
        const spaceRight = HALL_WIDTH - rect.right;
        const spaceLeft = rect.left;
        return spaceRight <= spaceLeft ? 'right' : 'left';
    }

    function updateScale() {
        if (!plannerSection) return false;
        const availableWidth = plannerSection.clientWidth;
        const availableHeight = plannerSection.clientHeight;
        if (!availableWidth || !availableHeight) {
            return false;
        }
        const newScale = Math.max(20, Math.min(availableWidth / HALL_WIDTH, availableHeight / HALL_HEIGHT));
        const changed = Math.abs(newScale - SCALE) > 0.001;
        SCALE = newScale;
        document.documentElement.style.setProperty('--scale', newScale.toString());
        plannerContainer.style.width = `${HALL_WIDTH * newScale}px`;
        plannerContainer.style.height = `${HALL_HEIGHT * newScale}px`;
        return changed;
    }

    function positionTableElement(tableElement, table) {
        const dims = tableHalfDimensionsForRotation(table.rotation || 0);
        tableElement.style.width = `${metersToPixels(dims.halfX * 2)}px`;
        tableElement.style.height = `${metersToPixels(dims.halfY * 2)}px`;
        tableElement.style.left = `${metersToPixels(table.x - dims.halfX)}px`;
        tableElement.style.top = `${metersToPixels(HALL_HEIGHT - table.y - dims.halfY)}px`;
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
        for (const entry of defaultLayoutBlueprint) {
            if (positions.length >= count) {
                break;
            }
            const candidate = {
                x: entry.x,
                y: entry.y,
                rotation: normalizeRotation(entry.rotation || 0),
                isHead: Boolean(entry.isHead),
                headSeatCount: clampHeadSeatCount(entry.headSeatCount ?? defaultHeadSeatCount('less'), 'less')
            };
            if (isPositionWithinHall(candidate.x, candidate.y, candidate.rotation) && !collidesWithColumns(candidate.x, candidate.y, null, candidate.rotation) && !defaultWouldCollide(candidate, positions)) {
                positions.push(candidate);
            }
        }
        let attempts = 0;
        while (positions.length < count && attempts < 200) {
            const fallback = findFreeSpot(positions);
            if (!defaultWouldCollide(fallback, positions) && isPositionWithinHall(fallback.x, fallback.y, fallback.rotation) && !collidesWithColumns(fallback.x, fallback.y, null, fallback.rotation)) {
                positions.push(fallback);
            }
            attempts++;
        }
        return positions.slice(0, count);
    }

    function defaultWouldCollide(candidate, placed) {
        const candidateRect = tableRectAt(candidate.x, candidate.y, candidate.rotation || 0);
        return placed.some(p => rectanglesIntersect(candidateRect, tableRectAt(p.x, p.y, p.rotation || 0)));
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
                rotation: pos.rotation || 0,
                isHead: Boolean(pos.isHead),
                headSeatCount: clampHeadSeatCount(pos.headSeatCount ?? defaultHeadSeatCount(newState.settings.mode), newState.settings.mode),
                description: '',
                chairs: [],
                groupId: tableId
            });
        });
        recomputeGroups(newState);
        recomputeChairs(newState);
        return newState;
    }

    function rectanglesIntersect(a, b) {
        return !(a.left >= b.right || a.right <= b.left || a.top >= b.bottom || a.bottom <= b.top);
    }

    function collidesWithColumns(x, y, ignoreTableId, rotation = 0) {
        const rect = tableRectAt(x, y, rotation);
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

    function isPositionWithinHall(x, y, rotation = 0) {
        const rect = tableRectAt(x, y, rotation);
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

    function collidesWithTables(x, y, movingTableId, rotation = 0) {
        const rect = tableRectAt(x, y, rotation);
        return state.tables.some(table => {
            if (table.id === movingTableId) return false;
            const otherRect = tableRectFor(table);
            return rectanglesIntersect(rect, otherRect);
        });
    }

    function snap(value) {
        return Math.round(value / SNAP_STEP) * SNAP_STEP;
    }

    function recomputeGroups(currentState) {
        const adjacency = new Map();
        currentState.tables.forEach(table => {
            table.rotation = normalizeRotation(table.rotation || 0);
            adjacency.set(table.id, new Set());
        });
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
        if (a.isHead || b.isHead) return false;
        const orientationA = tableOrientation(a);
        const orientationB = tableOrientation(b);
        if (orientationA !== orientationB) return false;
        if (orientationA === 'horizontal') {
            if (Math.abs(a.y - b.y) > 0.15) return false;
            const distance = Math.abs(a.x - b.x);
            return Math.abs(distance - TABLE_LENGTH) <= CONNECT_THRESHOLD;
        }
        if (Math.abs(a.x - b.x) > 0.15) return false;
        const distance = Math.abs(a.y - b.y);
        return Math.abs(distance - TABLE_LENGTH) <= CONNECT_THRESHOLD;
    }

    function alignTables(a, b) {
        const orientation = tableOrientation(a);
        if (orientation !== tableOrientation(b)) {
            return;
        }
        if (orientation === 'horizontal') {
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
        } else {
            if (Math.abs(a.x - b.x) <= 0.15) {
                const averageX = (a.x + b.x) / 2;
                a.x = averageX;
                b.x = averageX;
            }
            if (a.y < b.y) {
                b.y = a.y + TABLE_LENGTH;
            } else {
                a.y = b.y + TABLE_LENGTH;
            }
        }
    }

    function updateHeadTableChairs(table, previousAssignments, removedGuests, mode) {
        const seatCount = clampHeadSeatCount(table.headSeatCount ?? defaultHeadSeatCount(mode), mode);
        table.headSeatCount = seatCount;
        const orientation = tableOrientation(table);
        const rect = tableRectFor(table);
        const { halfX, halfY } = tableHalfDimensionsForRotation(table.rotation || 0);
        const offset = orientation === 'horizontal' ? halfY + CHAIR_OFFSET : halfX + CHAIR_OFFSET;
        const side = chooseHeadSide(table);
        const usableLength = orientation === 'horizontal'
            ? Math.max(0, rect.right - rect.left - 0.3)
            : Math.max(0, rect.bottom - rect.top - 0.3);
        const step = seatCount > 1 ? usableLength / (seatCount - 1) : 0;
        const prev = previousAssignments.get(table.id) || [];
        const newChairs = [];
        for (let i = 0; i < seatCount; i++) {
            if (orientation === 'horizontal') {
                const x = rect.left + 0.15 + i * step;
                const y = side === 'top' ? table.y + offset : table.y - offset;
                const prevEntry = prev[i];
                newChairs.push({
                    id: `${table.id}_c${i + 1}`,
                    x,
                    y,
                    side,
                    guestId: prevEntry ? prevEntry.guestId : null
                });
            } else {
                const y = rect.top + 0.15 + i * step;
                const x = side === 'right' ? table.x + offset : table.x - offset;
                const prevEntry = prev[i];
                newChairs.push({
                    id: `${table.id}_c${i + 1}`,
                    x,
                    y,
                    side,
                    guestId: prevEntry ? prevEntry.guestId : null
                });
            }
        }
        if (prev.length > newChairs.length) {
            prev.slice(newChairs.length).forEach(item => {
                if (item.guestId) {
                    removedGuests.add(item.guestId);
                }
            });
        }
        table.chairs = newChairs;
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
            if (!tablesInGroup.length) {
                return;
            }
            const normalTables = tablesInGroup.filter(table => !table.isHead);
            if (normalTables.length) {
                const orientation = tableOrientation(normalTables[0]);
                const sorted = normalTables
                    .slice()
                    .sort((a, b) => orientation === 'horizontal' ? a.x - b.x : a.y - b.y);
                const firstRect = tableRectFor(sorted[0]);
                const lastRect = tableRectFor(sorted[sorted.length - 1]);
                const groupStart = orientation === 'horizontal' ? firstRect.left : firstRect.top;
                const groupEnd = orientation === 'horizontal' ? lastRect.right : lastRect.bottom;
                const usableLength = Math.max(0, groupEnd - groupStart - 0.3);
                const connections = Math.max(0, sorted.length - 1);
                const chairsPerSide = basePerSide * sorted.length + connections;
                const step = chairsPerSide > 1 ? usableLength / (chairsPerSide - 1) : 0;
                const centerCoordinate = orientation === 'horizontal'
                    ? sorted.reduce((sum, t) => sum + t.y, 0) / sorted.length
                    : sorted.reduce((sum, t) => sum + t.x, 0) / sorted.length;
                const offset = orientation === 'horizontal'
                    ? tableHalfDimensionsForRotation(sorted[0].rotation).halfY + CHAIR_OFFSET
                    : tableHalfDimensionsForRotation(sorted[0].rotation).halfX + CHAIR_OFFSET;

                const positionsPrimary = [];
                const positionsSecondary = [];
                for (let i = 0; i < chairsPerSide; i++) {
                    if (orientation === 'horizontal') {
                        const x = groupStart + 0.15 + i * step;
                        positionsPrimary.push({ x, y: centerCoordinate + offset, side: 'top', order: i });
                        positionsSecondary.push({ x, y: centerCoordinate - offset, side: 'bottom', order: i });
                    } else {
                        const y = groupStart + 0.15 + i * step;
                        positionsPrimary.push({ x: centerCoordinate + offset, y, side: 'right', order: i });
                        positionsSecondary.push({ x: centerCoordinate - offset, y, side: 'left', order: i });
                    }
                }
                const allPositions = [...positionsPrimary, ...positionsSecondary];
                const sideOrder = orientation === 'horizontal'
                    ? { top: 0, bottom: 1 }
                    : { left: 0, right: 1 };

                sorted.forEach(table => {
                    const rect = tableRectFor(table);
                    const relevant = allPositions.filter(pos => {
                        if (orientation === 'horizontal') {
                            return pos.x >= rect.left - 1e-6 && pos.x <= rect.right + 1e-6;
                        }
                        return pos.y >= rect.top - 1e-6 && pos.y <= rect.bottom + 1e-6;
                    });
                    relevant.sort((a, b) => {
                        const orderA = sideOrder[a.side] ?? 0;
                        const orderB = sideOrder[b.side] ?? 0;
                        if (orderA !== orderB) {
                            return orderA - orderB;
                        }
                        return a.order - b.order;
                    });
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
            }

            const headTables = tablesInGroup.filter(table => table.isHead);
            headTables.forEach(table => {
                updateHeadTableChairs(table, previousAssignments, removedGuests, mode);
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
            positionTableElement(tableEl, table);
            tableEl.dataset.tableId = table.id;
            if (tableOrientation(table) === 'vertical') {
                tableEl.classList.add('table-vertical');
            }
            if (table.isHead) {
                tableEl.classList.add('table-head');
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
                openTableModal(table.id);
            });
            tableEl.appendChild(settingsBtn);

            tableEl.addEventListener('pointerdown', onTablePointerDown);

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

    function seatCountForTable(table) {
        const mode = state.settings ? state.settings.mode : 'less';
        if (table && Number.isFinite(table.headSeatCount)) {
            return clampHeadSeatCount(table.headSeatCount, mode);
        }
        return clampHeadSeatCount(defaultHeadSeatCount(mode), mode);
    }

    function updateHeadSeatField(table) {
        if (!tableHeadSeatsField || !tableHeadSeatsSelect) return;
        const isHead = tableHeadCheckbox.checked;
        tableHeadSeatsField.classList.toggle('hidden', !isHead);
        tableHeadSeatsSelect.disabled = !isHead;
        if (isHead) {
            tableHeadSeatsSelect.value = String(seatCountForTable(table));
        }
    }

    function openTableModal(tableId) {
        const table = state.tables.find(t => t.id === tableId);
        if (!table) return;
        tableContext = tableId;
        tableDescriptionInput.value = table.description || '';
        tableRotationSelect.value = String(normalizeRotation(table.rotation || 0));
        tableHeadCheckbox.checked = Boolean(table.isHead);
        if (tableHeadSeatsSelect) {
            tableHeadSeatsSelect.value = String(seatCountForTable(table));
        }
        updateHeadSeatField(table);
        tableModal.classList.remove('hidden');
        tableDescriptionInput.focus();
    }

    function closeTableModal() {
        tableModal.classList.add('hidden');
        tableDescriptionInput.value = '';
        tableContext = null;
    }

    function onTablePointerDown(event) {
        const tableId = event.currentTarget.dataset.tableId;
        const table = state.tables.find(t => t.id === tableId);
        if (!table) return;
        if (event.target.closest('.table-settings')) {
            return;
        }
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

            if (!isPositionWithinHall(table.x, table.y, table.rotation) || collidesWithColumns(table.x, table.y, table.id, table.rotation) || collidesWithTables(table.x, table.y, table.id, table.rotation)) {
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
        const orientation = tableOrientation(table);
        state.tables.forEach(other => {
            if (other.id === table.id) return;
            if (tableOrientation(other) !== orientation) return;
            if (orientation === 'horizontal') {
                if (Math.abs(other.y - table.y) > 0.2) return;
                const distance = other.x - table.x;
                if (Math.abs(Math.abs(distance) - TABLE_LENGTH) <= CONNECT_THRESHOLD) {
                    const targetX = distance > 0 ? other.x - TABLE_LENGTH : other.x + TABLE_LENGTH;
                    best = { x: targetX, y: other.y };
                }
            } else {
                if (Math.abs(other.x - table.x) > 0.2) return;
                const distance = other.y - table.y;
                if (Math.abs(Math.abs(distance) - TABLE_LENGTH) <= CONNECT_THRESHOLD) {
                    const targetY = distance > 0 ? other.y - TABLE_LENGTH : other.y + TABLE_LENGTH;
                    best = { x: other.x, y: targetY };
                }
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

    tableModalClose.addEventListener('click', closeTableModal);
    tableModalCancel.addEventListener('click', closeTableModal);
    tableModal.addEventListener('click', event => {
        if (event.target === tableModal) {
            closeTableModal();
        }
    });

    tableHeadCheckbox.addEventListener('change', () => {
        const table = tableContext ? state.tables.find(t => t.id === tableContext) : null;
        updateHeadSeatField(table);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            if (!chairModal.classList.contains('hidden')) {
                closeChairModal();
            }
            if (!tableModal.classList.contains('hidden')) {
                closeTableModal();
            }
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

    tableForm.addEventListener('submit', event => {
        event.preventDefault();
        if (!tableContext) return;
        const table = state.tables.find(t => t.id === tableContext);
        if (!table) return;
        const description = tableDescriptionInput.value.trim();
        const rotation = normalizeRotation(Number(tableRotationSelect.value));
        const isHead = tableHeadCheckbox.checked;
        const requestedSeatCount = tableHeadSeatsSelect ? Number(tableHeadSeatsSelect.value) : NaN;
        const seatCount = clampHeadSeatCount(Number.isFinite(requestedSeatCount) ? requestedSeatCount : seatCountForTable(table), state.settings.mode);
        const rotationChanged = rotation !== table.rotation;
        if (rotationChanged) {
            const fits = isPositionWithinHall(table.x, table.y, rotation) && !collidesWithColumns(table.x, table.y, table.id, rotation) && !collidesWithTables(table.x, table.y, table.id, rotation);
            if (!fits) {
                alert('Nie można obrócić stołu w tym miejscu. Przesuń stół i spróbuj ponownie.');
                return;
            }
        }
        const currentSeatCount = seatCountForTable(table);
        const seatChanged = seatCount !== currentSeatCount;
        if (description === (table.description || '') && rotation === table.rotation && isHead === Boolean(table.isHead) && !seatChanged) {
            closeTableModal();
            return;
        }
        pushHistory();
        table.description = description;
        table.rotation = rotation;
        table.isHead = isHead;
        table.headSeatCount = seatCount;
        recomputeGroups(state);
        recomputeChairs(state);
        applyRemovedGuestFallback();
        render();
        persistLocal();
        closeTableModal();
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
            position = findFreeSpot(state.tables, 0, state.settings.mode);
        }
        state.tables.push({
            id: newId,
            number: state.tables.length + 1,
            x: position.x,
            y: position.y,
            rotation: position.rotation || 0,
            isHead: Boolean(position.isHead),
            headSeatCount: clampHeadSeatCount(position.headSeatCount ?? defaultHeadSeatCount(state.settings.mode), state.settings.mode),
            description: '',
            chairs: [],
            groupId: newId
        });
    }

    function findFreeSpot(existing = state.tables, rotation = 0, mode = state.settings ? state.settings.mode : 'less') {
        for (let x = 11.5; x <= 23; x += 0.5) {
            for (let y = 1.5; y <= 9.5; y += 0.5) {
                if (!isPositionWithinHall(x, y, rotation) || collidesWithColumns(x, y, null, rotation)) {
                    continue;
                }
                const candidateRect = tableRectAt(x, y, rotation);
                const collision = existing.some(table => {
                    const rot = table.rotation || 0;
                    const rect = tableRectAt(table.x, table.y, rot);
                    return rectanglesIntersect(candidateRect, rect);
                });
                if (!collision) {
                    return {
                        x,
                        y,
                        rotation,
                        isHead: false,
                        headSeatCount: clampHeadSeatCount(defaultHeadSeatCount(mode), mode)
                    };
                }
            }
        }
        return {
            x: 12,
            y: 2,
            rotation,
            isHead: false,
            headSeatCount: clampHeadSeatCount(defaultHeadSeatCount(mode), mode)
        };
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
        if (state && state.settings) {
            state.settings.tableCount = state.tables.length;
        }
        state.version = 4;
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
        if (!state.settings.mode) {
            state.settings.mode = 'less';
        }
        const mode = state.settings && state.settings.mode ? state.settings.mode : 'less';
        state.tables = (data.tables || []).map((table, index) => {
            const rotation = normalizeRotation(table.rotation || 0);
            const rawSeatCount = typeof table.headSeatCount === 'number'
                ? table.headSeatCount
                : typeof table.headSeatCount === 'string'
                    ? Number(table.headSeatCount)
                    : NaN;
            const derivedSeatCount = Array.isArray(table.chairs) && table.isHead ? table.chairs.length : undefined;
            const seatCount = clampHeadSeatCount(
                Number.isFinite(rawSeatCount)
                    ? rawSeatCount
                    : (typeof derivedSeatCount === 'number' && derivedSeatCount > 0
                        ? derivedSeatCount
                        : defaultHeadSeatCount(mode)),
                mode
            );
            const mapped = {
                id: table.id || `t${index + 1}`,
                number: table.number || index + 1,
                x: table.x,
                y: needsFlip && typeof table.y === 'number' ? HALL_HEIGHT - table.y : table.y,
                rotation,
                isHead: Boolean(table.isHead),
                headSeatCount: seatCount,
                description: table.description || '',
                chairs: Array.isArray(table.chairs) ? table.chairs.map((chair, chairIndex) => ({
                    id: chair.id || `${table.id || `t${index + 1}`}_c${chairIndex + 1}`,
                    x: chair.x,
                    y: needsFlip && typeof chair.y === 'number' ? HALL_HEIGHT - chair.y : chair.y,
                    side: chair.side || 'top',
                    guestId: chair.guest || chair.guestId || null
                })) : [],
                groupId: table.groupId || table.id || `t${index + 1}`
            };
            if (!mapped.isHead && sourceVersion < 3) {
                mapped.isHead = false;
            }
            return mapped;
        });
        const resolvedTableCount = state.tables.length || state.settings.tableCount || DEFAULT_TABLE_COUNT;
        state.settings.tableCount = resolvedTableCount;
        state.version = 4;
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
        updateScale();
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
                state = createDefaultState(DEFAULT_TABLE_COUNT);
            }
        }
        render();
        scheduleAutoSave();
        updateUndoRedoButtons();
        if (typeof ResizeObserver !== 'undefined' && plannerSection) {
            const resizeObserver = new ResizeObserver(() => {
                if (updateScale()) {
                    renderHall();
                    render();
                }
            });
            resizeObserver.observe(plannerSection);
        } else {
            window.addEventListener('resize', () => {
                if (updateScale()) {
                    renderHall();
                    render();
                }
            });
        }
    }

    init();
})();
