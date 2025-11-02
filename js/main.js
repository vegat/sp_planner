import { PlannerApp } from './app/PlannerApp.js';

function qs(selector) {
    return document.querySelector(selector);
}

document.addEventListener('DOMContentLoaded', () => {
    const plannerContainer = qs('#plannerContainer');
    const selectionBox = document.createElement('div');
    selectionBox.id = 'selectionBox';
    selectionBox.className = 'selection-box hidden';
    plannerContainer.appendChild(selectionBox);

    const elements = {
        plannerContainer,
        plannerSection: qs('.planner'),
        hallSvg: qs('#hallSvg'),
        entitiesLayer: qs('#entitiesLayer'),
        tableCountInput: qs('#tableCount'),
        tableCountValue: qs('#tableCountValue'),
        modeToggle: qs('#modeToggle'),
        modeLabel: qs('#modeLabel'),
        undoBtn: qs('#undoBtn'),
        redoBtn: qs('#redoBtn'),
        resetBtn: qs('#resetBtn'),
        shareBtn: qs('#shareBtn'),
        summaryTables: qs('#summaryTables'),
        summarySeatsTotal: qs('#summarySeatsTotal'),
        summarySeatsFree: qs('#summarySeatsFree'),
        summaryAssigned: qs('#summaryAssigned'),
        summaryUnassigned: qs('#summaryUnassigned'),
        guestForm: qs('#guestForm'),
        guestNameInput: qs('#guestName'),
        guestList: qs('#guestList'),
        chairModal: qs('#chairModal'),
        chairForm: qs('#chairForm'),
        chairGuestInput: qs('#chairGuest'),
        chairModalClose: qs('#modalClose'),
        clearChairBtn: qs('#clearChair'),
        shareResult: qs('#shareResult'),
        gridToggle: qs('#gridToggle'),
        tableModal: qs('#tableModal'),
        tableForm: qs('#tableForm'),
        tableDescriptionInput: qs('#tableDescription'),
        tableRotationSelect: qs('#tableRotation'),
        tableHeadCheckbox: qs('#tableHead'),
        tableHeadSeatsField: qs('#tableHeadSeatsField'),
        tableHeadSeatsSelect: qs('#tableHeadSeats'),
        tableShortSidesSelect: qs('#tableShortSides'),
        tableModalClose: qs('#tableModalClose'),
        tableModalCancel: qs('#tableModalCancel'),
        selectionBox
    };

    const app = new PlannerApp(elements);
    app.init();
});
