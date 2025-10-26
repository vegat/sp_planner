import { CHAIR_OFFSET, CONNECT_THRESHOLD, HEAD_SEATS_MAX, HEAD_SEATS_MIN, TABLE_LENGTH, TABLE_WIDTH } from '../core/constants.js';
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

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    setRotation(rotation) {
        this.rotation = normalizeRotation(rotation);
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

    static shouldConnect(a, b) {
        if (a.isHead || b.isHead) return false;
        const orientationA = Table.orientationFor(a);
        const orientationB = Table.orientationFor(b);
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

    static alignTables(a, b) {
        const orientation = Table.orientationFor(a);
        if (orientation !== Table.orientationFor(b)) {
            return;
        }
        if (orientation === 'horizontal') {
            const avgY = (a.y + b.y) / 2;
            a.y = avgY;
            b.y = avgY;
            if (a.x < b.x) {
                a.x = b.x - TABLE_LENGTH;
            } else {
                a.x = b.x + TABLE_LENGTH;
            }
        } else {
            const avgX = (a.x + b.x) / 2;
            a.x = avgX;
            b.x = avgX;
            if (a.y < b.y) {
                a.y = b.y - TABLE_LENGTH;
            } else {
                a.y = b.y + TABLE_LENGTH;
            }
        }
    }
}
