import { deepCopy } from '../utils/math.js';

export class History {
    constructor(limit = 100) {
        this.limit = limit;
        this.past = [];
        this.future = [];
    }

    push(state) {
        this.past.push(deepCopy(state));
        if (this.past.length > this.limit) {
            this.past.shift();
        }
        this.future.length = 0;
    }

    canUndo() {
        return this.past.length > 0;
    }

    canRedo() {
        return this.future.length > 0;
    }

    undo(currentState) {
        if (!this.canUndo()) {
            return currentState;
        }
        this.future.push(deepCopy(currentState));
        return this.past.pop();
    }

    redo(currentState) {
        if (!this.canRedo()) {
            return currentState;
        }
        const next = this.future.pop();
        this.past.push(deepCopy(currentState));
        return next;
    }

    reset() {
        this.past.length = 0;
        this.future.length = 0;
    }
}
