import { CHAIR_OFFSET, CONNECT_ALIGNMENT_TOLERANCE, CONNECT_THRESHOLD, HEAD_SEATS_MAX, HEAD_SEATS_MIN, TABLE_LENGTH, TABLE_WIDTH } from '../core/constants.js';
import { Chair } from './Chair.js';
import { clamp, normalizeRotation } from '../utils/math.js';
import { tableHalfDimensionsForRotation, tableRectAt } from '../utils/geometry.js';

export class Table {
    constructor({
        id,
        number,
        x,
        y,
        rotation = 0,
        description = '',
        isHead = false,
        headSeatCount = HEAD_SEATS_MAX,
        chairs = [],
        groupId = null
    }) {
        this.id = id;
        this.number = number;
        this.x = x;
        this.y = y;
        this.rotation = normalizeRotation(rotation);
        this.description = description;
        this.isHead = isHead;
        this.headSeatCount = Table.clampHeadSeatCount(headSeatCount);
        this.groupId = groupId || id;
        this.chairs = chairs.map(chair => chair instanceof Chair ? chair : Chair.fromJSON(id, chair));
    }

    clone() {
        return new Table({
            id: this.id,
            number: this.number,
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            description: this.description,
            isHead: this.isHead,
            headSeatCount: this.headSeatCount,
            chairs: this.chairs.map(chair => chair.clone()),
            groupId: this.groupId
        });
    }

    setRotation(rotation) {
        this.rotation = normalizeRotation(rotation);
    }

    moveBy(deltaX, deltaY) {
        this.x += deltaX;
        this.y += deltaY;
        this.chairs.forEach(chair => chair.moveBy(deltaX, deltaY));
    }

    setDescription(description) {
        this.description = description ?? '';
    }

    setHead(isHead) {
        this.isHead = Boolean(isHead);
        if (!this.isHead) {
            this.headSeatCount = Table.clampHeadSeatCount(HEAD_SEATS_MAX);
        }
    }

    setHeadSeatCount(count) {
        this.headSeatCount = Table.clampHeadSeatCount(count);
    }

    get label() {
        return this.description ? `Stół ${this.number}: ${this.description}` : `Stół ${this.number}`;
    }

    orientation() {
        return normalizeRotation(this.rotation) === 90 ? 'vertical' : 'horizontal';
    }

    rect() {
        return tableRectAt(this.x, this.y, this.rotation);
    }

    halfDimensions() {
        return tableHalfDimensionsForRotation(this.rotation);
    }

    chooseHeadSide(room) {
        const orientation = this.orientation();
        const rect = this.rect();
        if (orientation === 'horizontal') {
            const spaceTop = room.height - rect.bottom;
            const spaceBottom = rect.top;
            return spaceTop <= spaceBottom ? 'top' : 'bottom';
        }
        const spaceRight = room.width - rect.right;
        const spaceLeft = rect.left;
        return spaceRight <= spaceLeft ? 'right' : 'left';
    }

    headChairsFromPositions(positions) {
        return positions.map((pos, index) => new Chair({
            id: `${this.id}_c${index + 1}`,
            tableId: this.id,
            x: pos.x,
            y: pos.y,
            side: pos.side,
            guestId: pos.guestId || null
        }));
    }

    assignChairsFromPositions(positions, previousAssignments = []) {
        const chairs = positions.map((pos, index) => {
            const previous = previousAssignments[index];
            return new Chair({
                id: `${this.id}_c${index + 1}`,
                tableId: this.id,
                x: pos.x,
                y: pos.y,
                side: pos.side,
                guestId: previous ? previous.guestId : pos.guestId || null
            });
        });
        this.chairs = chairs;
    }

    toJSON() {
        return {
            id: this.id,
            number: this.number,
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            description: this.description,
            isHead: this.isHead,
            headSeatCount: this.headSeatCount,
            chairs: this.chairs.map(chair => chair.toJSON()),
            groupId: this.groupId
        };
    }

    static clampHeadSeatCount(value) {
        const numeric = Number.isFinite(value) ? value : HEAD_SEATS_MAX;
        return clamp(Math.round(numeric), HEAD_SEATS_MIN, HEAD_SEATS_MAX);
    }

    static orientationFor(table) {
        return normalizeRotation(table.rotation || 0) === 90 ? 'vertical' : 'horizontal';
    }

    static tableRectFor(table) {
        return tableRectAt(table.x, table.y, table.rotation || 0);
    }

    static connectionBetween(a, b) {
        if (a.isHead || b.isHead) return null;
        const orientationA = Table.orientationFor(a);
        const orientationB = Table.orientationFor(b);
        if (orientationA !== orientationB) return null;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (orientationA === 'horizontal') {
            if (dy <= CONNECT_ALIGNMENT_TOLERANCE && Math.abs(dx - TABLE_LENGTH) <= CONNECT_THRESHOLD) {
                return { orientation: 'horizontal', type: 'length' };
            }
            return null;
        }
        if (dx <= CONNECT_ALIGNMENT_TOLERANCE && Math.abs(dy - TABLE_LENGTH) <= CONNECT_THRESHOLD) {
            return { orientation: 'vertical', type: 'length' };
        }
        return null;
    }

    static shouldConnect(a, b) {
        return Boolean(Table.connectionBetween(a, b));
    }

    static alignTables(a, b, connection = Table.connectionBetween(a, b)) {
        if (!connection) {
            return;
        }
        const { orientation } = connection;
        if (orientation === 'horizontal') {
            const [anchor, target] = a.x <= b.x ? [a, b] : [b, a];
            const direction = target.x >= anchor.x ? 1 : -1;
            target.y = anchor.y;
            target.x = anchor.x + direction * TABLE_LENGTH;
            return;
        }
        const [anchor, target] = a.y <= b.y ? [a, b] : [b, a];
        const direction = target.y >= anchor.y ? 1 : -1;
        target.x = anchor.x;
        target.y = anchor.y + direction * TABLE_LENGTH;
    }
}
