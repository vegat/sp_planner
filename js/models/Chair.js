export class Chair {
    constructor({ id, tableId, x, y, side, guestId = null }) {
        this.id = id;
        this.tableId = tableId;
        this.x = x;
        this.y = y;
        this.side = side;
        this.guestId = guestId;
    }

    moveBy(deltaX, deltaY) {
        this.x += deltaX;
        this.y += deltaY;
    }

    assignGuest(guestId) {
        this.guestId = guestId;
    }

    clearGuest() {
        this.guestId = null;
    }

    clone() {
        return new Chair({
            id: this.id,
            tableId: this.tableId,
            x: this.x,
            y: this.y,
            side: this.side,
            guestId: this.guestId
        });
    }

    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            side: this.side,
            guestId: this.guestId
        };
    }

    static fromJSON(tableId, data) {
        return new Chair({
            id: data.id,
            tableId,
            x: data.x,
            y: data.y,
            side: data.side,
            guestId: data.guestId || null
        });
    }
}
