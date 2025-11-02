import { DEFAULT_TABLE_COUNT, HEAD_SEATS_MAX, HEAD_SEATS_MIN, STATE_VERSION, defaultLayoutBlueprint } from '../core/constants.js';
import { Table } from '../models/Table.js';
import { Guest } from '../models/Guest.js';
import { clamp, normalizeRotation } from '../utils/math.js';
import { chairRectAt, rectanglesIntersect, tableHalfDimensionsForRotation, tableRectAt } from '../utils/geometry.js';
import { CHAIR_EDGE_CLEARANCE, CHAIR_OFFSET } from '../core/constants.js';

export class PlannerState {
    constructor(room) {
        this.room = room;
        this.version = STATE_VERSION;
        this.tables = [];
        this.guests = [];
        this.settings = {
            mode: 'less',
            tableCount: DEFAULT_TABLE_COUNT
        };
    }

    defaultHeadSeatCount(mode = this.settings.mode) {
        return mode === 'more' ? HEAD_SEATS_MAX : Math.min(HEAD_SEATS_MAX, 3);
    }

    clampHeadSeatCount(value, mode = this.settings.mode) {
        if (!Number.isFinite(value)) {
            return this.defaultHeadSeatCount(mode);
        }
        return clamp(Math.round(value), HEAD_SEATS_MIN, HEAD_SEATS_MAX);
    }

    createDefaultLayout(count = this.settings.tableCount) {
        const positions = this.computeDefaultTables(count);
        this.tables = positions.map((pos, index) => new Table({
            id: `t${index + 1}`,
            number: index + 1,
            x: pos.x,
            y: pos.y,
            rotation: pos.rotation || 0,
            isHead: Boolean(pos.isHead),
            headSeatCount: this.clampHeadSeatCount(pos.headSeatCount ?? this.defaultHeadSeatCount(this.settings.mode), this.settings.mode),
            description: pos.description || '',
            chairs: [],
            groupId: `t${index + 1}`
        }));
        this.recomputeGroups();
        this.recomputeChairs();
        this.settings.tableCount = this.tables.length;
    }

    computeDefaultTables(count) {
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
                headSeatCount: this.clampHeadSeatCount(entry.headSeatCount ?? this.defaultHeadSeatCount('less'), 'less')
            };
            if (this.room.isPositionWithinHall(candidate.x, candidate.y, candidate.rotation) &&
                !this.room.collidesWithColumns(candidate.x, candidate.y, candidate.rotation) &&
                !this.defaultWouldCollide(candidate, positions)) {
                positions.push(candidate);
            }
        }
        let attempts = 0;
        while (positions.length < count && attempts < 200) {
            const fallback = this.findFreeSpot(positions);
            if (!this.defaultWouldCollide(fallback, positions) &&
                this.room.isPositionWithinHall(fallback.x, fallback.y, fallback.rotation) &&
                !this.room.collidesWithColumns(fallback.x, fallback.y, fallback.rotation)) {
                positions.push(fallback);
            }
            attempts++;
        }
        return positions.slice(0, count);
    }

    defaultWouldCollide(candidate, placed) {
        const candidateRect = tableRectAt(candidate.x, candidate.y, candidate.rotation || 0);
        return placed.some(p => rectanglesIntersect(candidateRect, tableRectAt(p.x, p.y, p.rotation || 0)));
    }

    findFreeSpot(existing = this.tables, rotation = 0, mode = this.settings.mode) {
        for (let x = 11.5; x <= 23; x += 0.5) {
            for (let y = 1.5; y <= 9.5; y += 0.5) {
                if (!this.room.isPositionWithinHall(x, y, rotation) || this.room.collidesWithColumns(x, y, rotation)) {
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
                        headSeatCount: this.clampHeadSeatCount(this.defaultHeadSeatCount(mode), mode)
                    };
                }
            }
        }
        return {
            x: 12,
            y: 2,
            rotation,
            isHead: false,
            headSeatCount: this.clampHeadSeatCount(this.defaultHeadSeatCount(mode), mode)
        };
    }

    toJSON() {
        return {
            version: this.version,
            tables: this.tables.map(table => table.toJSON()),
            guests: this.guests.map(guest => guest.toJSON()),
            settings: { ...this.settings }
        };
    }

    loadFromRaw(data) {
        this.version = data.version || STATE_VERSION;
        this.settings = {
            mode: data.settings?.mode || 'less',
            tableCount: data.settings?.tableCount || DEFAULT_TABLE_COUNT
        };
        const mode = this.settings.mode;
        const previousAssignments = new Map();
        this.tables = (data.tables || []).map((table, index) => {
            const rotation = normalizeRotation(table.rotation || 0);
            const rawSeatCount = typeof table.headSeatCount === 'number'
                ? table.headSeatCount
                : typeof table.headSeatCount === 'string'
                    ? Number(table.headSeatCount)
                    : NaN;
            const derivedSeatCount = Array.isArray(table.chairs) && table.isHead ? table.chairs.length : undefined;
            const seatCount = Number.isFinite(rawSeatCount)
                ? rawSeatCount
                : (typeof derivedSeatCount === 'number' && derivedSeatCount > 0
                    ? derivedSeatCount
                    : this.defaultHeadSeatCount(mode));
            const normalizedSeatCount = this.clampHeadSeatCount(seatCount, mode);
            const newTable = new Table({
                id: table.id || `t${index + 1}`,
                number: table.number || index + 1,
                x: table.x,
                y: table.y,
                rotation,
                isHead: Boolean(table.isHead),
                headSeatCount: normalizedSeatCount,
                description: table.description || '',
                chairs: [],
                groupId: table.groupId || table.id || `t${index + 1}`
            });
            previousAssignments.set(newTable.id, (table.chairs || []).map(chair => ({
                id: chair.id,
                guestId: chair.guest ?? chair.guestId ?? null
            })));
            return newTable;
        });

        const idMap = new Map();
        this.tables.forEach((table, index) => {
            const newId = table.id || `t${index + 1}`;
            idMap.set(table.id, newId);
            table.id = newId;
            table.number = index + 1;
            table.groupId = table.groupId || newId;
        });

        const removedGuests = new Set();
        this.recomputeGroups();
        this.recomputeChairs(previousAssignments, removedGuests);

        this.guests = (data.guests || []).map(guest => new Guest({
            id: guest.id,
            name: guest.name,
            assignedTo: guest.assignedTo || guest.seatId || null
        }));
        this.applyRemovedGuestFallback(removedGuests);
        this.settings.tableCount = this.tables.length;
    }

    ensureTableNumbers() {
        this.tables.sort((a, b) => a.number - b.number);
        this.tables.forEach((table, index) => {
            table.number = index + 1;
        });
    }

    collidesWithTables(x, y, movingTableId, rotation = 0, ignoredIds = new Set()) {
        const rect = tableRectAt(x, y, rotation);
        const ignored = new Set([movingTableId, ...ignoredIds]);
        return this.tables.some(table => {
            if (ignored.has(table.id)) return false;
            const otherRect = tableRectAt(table.x, table.y, table.rotation || 0);
            return rectanglesIntersect(rect, otherRect);
        });
    }

    chairCollidesWithTables(sourceTableId, chairRect, ignoredIds = new Set()) {
        const ignored = new Set([sourceTableId, ...ignoredIds]);
        return this.tables.some(table => {
            if (ignored.has(table.id)) {
                return false;
            }
            const rect = tableRectAt(table.x, table.y, table.rotation || 0);
            return rectanglesIntersect(chairRect, rect);
        });
    }

    validateCandidateTables(candidates, movingIds = new Set()) {
        for (const candidate of candidates) {
            const table = this.tables.find(tbl => tbl.id === candidate.id);
            if (!table) {
                continue;
            }
            const rotation = table.rotation || 0;
            if (!this.room.isPositionWithinHall(candidate.x, candidate.y, rotation)) {
                return { valid: false, reason: 'hall-bounds' };
            }
            if (this.room.collidesWithColumns(candidate.x, candidate.y, rotation)) {
                return { valid: false, reason: 'pillar-hit' };
            }
            if (this.collidesWithTables(candidate.x, candidate.y, table.id, rotation, movingIds)) {
                return { valid: false, reason: 'table-collision' };
            }
            const deltaX = candidate.x - table.x;
            const deltaY = candidate.y - table.y;
            if (!table.chairs || !table.chairs.length) {
                continue;
            }
            for (const chair of table.chairs) {
                const newX = chair.x + deltaX;
                const newY = chair.y + deltaY;
                if (!this.room.isChairWithinHall(newX, newY)) {
                    return { valid: false, reason: 'chair-bounds' };
                }
                if (this.room.chairCollidesWithColumns(newX, newY)) {
                    return { valid: false, reason: 'chair-pillar' };
                }
                const chairRect = chairRectAt(newX, newY);
                if (this.chairCollidesWithTables(table.id, chairRect, movingIds)) {
                    return { valid: false, reason: 'chair-table' };
                }
            }
        }
        return { valid: true };
    }

    recomputeGroups() {
        const adjacency = new Map();
        this.tables.forEach(table => {
            table.rotation = normalizeRotation(table.rotation || 0);
            adjacency.set(table.id, new Set());
        });
        for (let i = 0; i < this.tables.length; i++) {
            for (let j = i + 1; j < this.tables.length; j++) {
                const a = this.tables[i];
                const b = this.tables[j];
                const connection = Table.connectionBetween(a, b);
                if (connection) {
                    adjacency.get(a.id).add(b.id);
                    adjacency.get(b.id).add(a.id);
                    Table.alignTables(a, b, connection);
                }
            }
        }
        const visited = new Set();
        this.tables.forEach(table => {
            if (visited.has(table.id)) return;
            const queue = [table.id];
            const groupId = queue[0];
            while (queue.length) {
                const current = queue.shift();
                if (visited.has(current)) continue;
                visited.add(current);
                const target = this.tables.find(item => item.id === current);
                if (target) {
                    target.groupId = groupId;
                }
                adjacency.get(current).forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                });
            }
        });
    }

    recomputeChairs(previousAssignments = new Map(), removedGuests = new Set()) {
        const groups = new Map();
        this.tables.forEach(table => {
            if (!groups.has(table.groupId)) {
                groups.set(table.groupId, []);
            }
            groups.get(table.groupId).push(table);
        });

        const mode = this.settings.mode;
        const basePerSide = mode === 'less' ? 3 : 4;

        if (!previousAssignments.size) {
            this.tables.forEach(table => {
                previousAssignments.set(table.id, table.chairs.map(chair => ({ id: chair.id, guestId: chair.guestId })));
            });
        }

        groups.forEach(tablesInGroup => {
            if (!tablesInGroup.length) {
                return;
            }
            const normalTables = tablesInGroup.filter(table => !table.isHead);
            if (normalTables.length) {
                const orientation = Table.orientationFor(normalTables[0]);
                const sorted = normalTables
                    .slice()
                    .sort((a, b) => orientation === 'horizontal' ? a.x - b.x : a.y - b.y);
                const firstRect = Table.tableRectFor(sorted[0]);
                const lastRect = Table.tableRectFor(sorted[sorted.length - 1]);
                const groupStart = orientation === 'horizontal' ? firstRect.left : firstRect.top;
                const groupEnd = orientation === 'horizontal' ? lastRect.right : lastRect.bottom;
                const usableLength = Math.max(0, groupEnd - groupStart - 2 * CHAIR_EDGE_CLEARANCE);
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
                        const x = groupStart + CHAIR_EDGE_CLEARANCE + i * step;
                        positionsPrimary.push({ x, y: centerCoordinate + offset, side: 'top', order: i });
                        positionsSecondary.push({ x, y: centerCoordinate - offset, side: 'bottom', order: i });
                    } else {
                        const y = groupStart + CHAIR_EDGE_CLEARANCE + i * step;
                        positionsPrimary.push({ x: centerCoordinate + offset, y, side: 'right', order: i });
                        positionsSecondary.push({ x: centerCoordinate - offset, y, side: 'left', order: i });
                    }
                }
                const allPositions = [...positionsPrimary, ...positionsSecondary];
                const sideOrder = orientation === 'horizontal'
                    ? { top: 0, bottom: 1 }
                    : { left: 0, right: 1 };

                sorted.forEach(table => {
                    const rect = Table.tableRectFor(table);
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
                    const newChairs = relevant.map((pos, index) => ({
                        id: `${table.id}_c${index + 1}`,
                        x: pos.x,
                        y: pos.y,
                        side: pos.side,
                        guestId: prev[index] ? prev[index].guestId : null
                    }));
                    if (prev.length > newChairs.length) {
                        prev.slice(newChairs.length).forEach(item => {
                            if (item.guestId) {
                                removedGuests.add(item.guestId);
                            }
                        });
                    }
                    table.assignChairsFromPositions(newChairs, prev);
                });
            }

            const headTables = tablesInGroup.filter(table => table.isHead);
            headTables.forEach(table => {
                this.updateHeadTableChairs(table, previousAssignments, removedGuests, mode);
            });
        });

        this.applyRemovedGuestFallback(removedGuests);
    }

    updateHeadTableChairs(table, previousAssignments, removedGuests, mode) {
        const seatCount = this.clampHeadSeatCount(table.headSeatCount ?? this.defaultHeadSeatCount(mode), mode);
        table.headSeatCount = seatCount;
        const orientation = Table.orientationFor(table);
        const rect = Table.tableRectFor(table);
        const { halfX, halfY } = tableHalfDimensionsForRotation(table.rotation || 0);
        const offset = orientation === 'horizontal' ? halfY + CHAIR_OFFSET : halfX + CHAIR_OFFSET;
        const side = table.chooseHeadSide(this.room);
        const axisStart = orientation === 'horizontal'
            ? rect.left + CHAIR_EDGE_CLEARANCE
            : rect.top + CHAIR_EDGE_CLEARANCE;
        const axisEnd = orientation === 'horizontal'
            ? rect.right - CHAIR_EDGE_CLEARANCE
            : rect.bottom - CHAIR_EDGE_CLEARANCE;
        const axisSpan = Math.max(0, axisEnd - axisStart);
        const axisCenter = axisStart + axisSpan / 2;
        let axisPositions;
        if (seatCount === 2) {
            const gap = Math.min(axisSpan / 3, 0.7);
            axisPositions = [axisCenter - gap / 2, axisCenter + gap / 2];
        } else if (seatCount === 3) {
            const gap = Math.min(axisSpan / 6, 0.3);
            axisPositions = [axisCenter - gap, axisCenter, axisCenter + gap];
        } else {
            const step = seatCount > 1 ? axisSpan / (seatCount - 1) : 0;
            axisPositions = Array.from({ length: seatCount }, (_, index) => axisStart + index * step);
        }
        axisPositions = axisPositions.map(position => clamp(position, axisStart, axisEnd)).sort((a, b) => a - b);
        const prev = previousAssignments.get(table.id) || [];
        const newChairs = axisPositions.map((coord, index) => {
            if (orientation === 'horizontal') {
                const y = side === 'top' ? table.y + offset : table.y - offset;
                return {
                    id: `${table.id}_c${index + 1}`,
                    x: coord,
                    y,
                    side,
                    guestId: prev[index] ? prev[index].guestId : null
                };
            }
            const x = side === 'right' ? table.x + offset : table.x - offset;
            return {
                id: `${table.id}_c${index + 1}`,
                x,
                y: coord,
                side,
                guestId: prev[index] ? prev[index].guestId : null
            };
        });
        if (prev.length > newChairs.length) {
            prev.slice(newChairs.length).forEach(item => {
                if (item.guestId) {
                    removedGuests.add(item.guestId);
                }
            });
        }
        table.assignChairsFromPositions(newChairs, prev);
    }

    applyRemovedGuestFallback(removedGuests) {
        if (!removedGuests || !removedGuests.size) {
            return;
        }
        const assignedSeats = new Set();
        this.tables.forEach(table => {
            table.chairs.forEach(chair => {
                if (chair.guestId) {
                    assignedSeats.add(chair.guestId);
                }
            });
        });
        this.guests.forEach(guest => {
            if (removedGuests.has(guest.id)) {
                guest.clearAssignment();
            } else if (guest.assignedTo && !assignedSeats.has(guest.id)) {
                guest.clearAssignment();
            }
        });
    }

    findChairById(chairId) {
        for (const table of this.tables) {
            const chair = table.chairs.find(c => c.id === chairId);
            if (chair) {
                return { table, chair };
            }
        }
        return { table: null, chair: null };
    }

    addGuest(name) {
        const guest = new Guest({
            id: `g${Date.now()}${Math.random().toString(16).slice(2)}`,
            name,
            assignedTo: null
        });
        this.guests.push(guest);
        return guest;
    }

    getGuestById(id) {
        return this.guests.find(guest => guest.id === id) || null;
    }

    removeGuest(guestId) {
        this.guests = this.guests.filter(guest => guest.id !== guestId);
        this.tables.forEach(table => {
            table.chairs.forEach(chair => {
                if (chair.guestId === guestId) {
                    chair.clearGuest();
                }
            });
        });
    }

    assignGuestToChair(guestId, chairId) {
        const guest = this.guests.find(item => item.id === guestId);
        if (!guest) {
            return;
        }
        const { table, chair } = this.findChairById(chairId);
        if (!table || !chair) {
            return;
        }
        if (guest.assignedTo && guest.assignedTo !== chairId) {
            const { chair: previousChair } = this.findChairById(guest.assignedTo);
            if (previousChair) {
                previousChair.clearGuest();
            }
        }
        if (chair.guestId && chair.guestId !== guestId) {
            const otherGuest = this.guests.find(item => item.id === chair.guestId);
            if (otherGuest) {
                otherGuest.clearAssignment();
            }
        }
        chair.assignGuest(guestId);
        guest.assignTo(chairId);
    }

    clearChair(chairId) {
        const { chair } = this.findChairById(chairId);
        if (!chair) return;
        if (chair.guestId) {
            const guest = this.guests.find(item => item.id === chair.guestId);
            if (guest) {
                guest.clearAssignment();
            }
        }
        chair.clearGuest();
    }

    ensureGuestsAlignment() {
        const assigned = new Set();
        this.tables.forEach(table => {
            table.chairs.forEach(chair => {
                if (chair.guestId) {
                    assigned.add(chair.guestId);
                }
            });
        });
        this.guests.forEach(guest => {
            if (guest.assignedTo && !assigned.has(guest.id)) {
                guest.clearAssignment();
            }
        });
    }

    addTable() {
        const newId = `t${Date.now()}${Math.random().toString(16).slice(2)}`;
        const defaultPositions = this.computeDefaultTables(this.tables.length + 1);
        let position = defaultPositions[this.tables.length];
        if (!position) {
            position = this.findFreeSpot(this.tables, 0, this.settings.mode);
        }
        const table = new Table({
            id: newId,
            number: this.tables.length + 1,
            x: position.x,
            y: position.y,
            rotation: position.rotation || 0,
            isHead: Boolean(position.isHead),
            headSeatCount: this.clampHeadSeatCount(position.headSeatCount ?? this.defaultHeadSeatCount(this.settings.mode), this.settings.mode),
            description: '',
            chairs: [],
            groupId: newId
        });
        this.tables.push(table);
        this.settings.tableCount = this.tables.length;
        this.recomputeGroups();
        this.recomputeChairs();
        return table;
    }

    removeTables(count) {
        const tablesWithGuests = this.tables.map(table => ({
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
                    return false;
                }
                candidates.slice(0, remaining).forEach(item => toRemove.push(item.table));
            }
        }
        const removedGuests = new Set();
        this.tables = this.tables.filter(table => {
            if (!toRemove.includes(table)) {
                return true;
            }
            table.chairs.forEach(chair => {
                if (chair.guestId) {
                    removedGuests.add(chair.guestId);
                }
            });
            return false;
        });
        this.guests.forEach(guest => {
            if (removedGuests.has(guest.id)) {
                guest.clearAssignment();
            }
        });
        this.ensureTableNumbers();
        this.settings.tableCount = this.tables.length;
        this.recomputeGroups();
        this.recomputeChairs();
        return true;
    }

    setTableCount(count) {
        const desired = clamp(Math.round(count), 4, 16);
        if (desired === this.tables.length) {
            return true;
        }
        if (desired > this.tables.length) {
            const toAdd = desired - this.tables.length;
            for (let i = 0; i < toAdd; i++) {
                this.addTable();
            }
            return true;
        }
        const toRemove = this.tables.length - desired;
        return this.removeTables(toRemove);
    }

    setMode(mode) {
        const normalized = mode === 'more' ? 'more' : 'less';
        if (this.settings.mode === normalized) {
            return;
        }
        this.settings.mode = normalized;
        this.tables.forEach(table => {
            if (table.isHead) {
                table.headSeatCount = this.clampHeadSeatCount(table.headSeatCount, normalized);
            }
        });
        this.recomputeChairs();
    }

    get summary() {
        const totalSeats = this.tables.reduce((sum, table) => sum + table.chairs.length, 0);
        const assigned = this.tables.reduce((sum, table) => sum + table.chairs.filter(chair => chair.guestId).length, 0);
        return {
            tables: this.tables.length,
            totalSeats,
            assignedGuests: assigned,
            freeSeats: Math.max(0, totalSeats - assigned),
            unassignedGuests: this.guests.filter(guest => !guest.assignedTo).length
        };
    }
}
