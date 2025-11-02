export class Guest {
    constructor({ id, name, assignedTo = null }) {
        this.id = id;
        this.name = name;
        this.assignedTo = assignedTo;
    }

    assignTo(chairId) {
        this.assignedTo = chairId;
    }

    clearAssignment() {
        this.assignedTo = null;
    }

    get initials() {
        if (!this.name) return '';
        return this.name
            .split(/\s+/)
            .filter(Boolean)
            .map(part => part[0]?.toUpperCase() ?? '')
            .join('');
    }

    clone() {
        return new Guest({ id: this.id, name: this.name, assignedTo: this.assignedTo });
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            assignedTo: this.assignedTo
        };
    }

    static fromJSON(data) {
        return new Guest({
            id: data.id,
            name: data.name,
            assignedTo: data.assignedTo || null
        });
    }
}
