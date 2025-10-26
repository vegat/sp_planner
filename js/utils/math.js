import { SNAP_STEP } from '../core/constants.js';

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function snap(value) {
    return Math.round(value / SNAP_STEP) * SNAP_STEP;
}

export function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
}

export function normalizeRotation(rotation) {
    const normalized = ((rotation % 360) + 360) % 360;
    return normalized === 180 ? 0 : normalized;
}
