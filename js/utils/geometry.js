import { CHAIR_SIZE, TABLE_LENGTH, TABLE_WIDTH } from '../core/constants.js';
import { normalizeRotation } from './math.js';

export function tableHalfDimensionsForRotation(rotation) {
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

export function tableRectAt(x, y, rotation) {
    const { halfX, halfY } = tableHalfDimensionsForRotation(rotation);
    return {
        left: x - halfX,
        right: x + halfX,
        top: y - halfY,
        bottom: y + halfY
    };
}

export function chairRectAt(x, y) {
    const half = CHAIR_SIZE / 2;
    return {
        left: x - half,
        right: x + half,
        top: y - half,
        bottom: y + half
    };
}

export function rectanglesIntersect(a, b) {
    return !(a.left >= b.right || a.right <= b.left || a.top >= b.bottom || a.bottom <= b.top);
}

export function pointInPolygon(point, polygon) {
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
