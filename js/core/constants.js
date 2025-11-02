export const TABLE_LENGTH = 2.3;
export const TABLE_WIDTH = 1.0;
export const HALL_WIDTH = 25;
export const HALL_HEIGHT = 11;
export const CHAIR_OFFSET = 0.4;
export const CHAIR_EDGE_CLEARANCE = 0.35;
export const CHAIR_SIZE = 0.45;
export const SNAP_STEP = 0.25;
export const CONNECT_THRESHOLD = 0.2;
export const CONNECT_ALIGNMENT_TOLERANCE = 0.3;
export const AUTO_SAVE_MS = 10000;
export const DEFAULT_TABLE_COUNT = 13;
export const HEAD_SEATS_MIN = 2;
export const HEAD_SEATS_MAX = 4;
export const LOCAL_STORAGE_KEY = 'stara_podkowa_planer_state_v1';
export const STATE_VERSION = 4;

export const hallPolygon = [
    { x: 0, y: 0 },
    { x: 4.3, y: 0 },
    { x: 4.3, y: 2.3 },
    { x: 0, y: 5.3 },
    { x: 0, y: HALL_HEIGHT },
    { x: HALL_WIDTH, y: HALL_HEIGHT },
    { x: HALL_WIDTH, y: 0 },
    { x: 0, y: 0 }
];

export const pillars = [5, 10, 15, 20].map(x => ({
    x,
    y: 5.5,
    width: 0.4,
    height: 0.4
}));

export const references = [
    {
        from: { x: 0, y: 5.3 },
        to: { x: 0, y: 11 },
        label: 'Wejście na zaplecze',
        labelPosition: { x: 1.4, y: 8.15 }
    },
    {
        from: { x: 8, y: 11 },
        to: { x: 14, y: 11 },
        label: 'Brama na łąkę',
        labelPosition: { x: 7.5, y: 10.6 }
    },
    {
        from: { x: 16, y: 11 },
        to: { x: 22, y: 11 },
        label: 'Przeszklona brama'
    },
    {
        from: { x: 16.5, y: 1 },
        to: { x: 17.5, y: 1 },
        label: 'Wejście'
    }
];

export const defaultLayoutBlueprint = [
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
