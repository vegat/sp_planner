import { HALL_HEIGHT, HALL_WIDTH, hallPolygon, pillars, references } from '../core/constants.js';
import { chairRectAt, pointInPolygon, tableRectAt } from '../utils/geometry.js';

export class Room {
    constructor(svgElement, containerElement, plannerSection) {
        this.svgElement = svgElement;
        this.containerElement = containerElement;
        this.plannerSection = plannerSection;
        this.scale = 40;
        this.width = HALL_WIDTH;
        this.height = HALL_HEIGHT;
    }

    metersToPixels(value) {
        return value * this.scale;
    }

    toScreenY(value) {
        return this.metersToPixels(this.height - value);
    }

    updateScale() {
        if (!this.plannerSection) {
            return false;
        }
        const availableWidth = this.plannerSection.clientWidth;
        const availableHeight = this.plannerSection.clientHeight;
        if (!availableWidth || !availableHeight) {
            return false;
        }
        const newScale = Math.max(20, Math.min(availableWidth / this.width, availableHeight / this.height));
        const changed = Math.abs(newScale - this.scale) > 0.001;
        this.scale = newScale;
        document.documentElement.style.setProperty('--scale', newScale.toString());
        if (this.containerElement) {
            this.containerElement.style.width = `${this.width * newScale}px`;
            this.containerElement.style.height = `${this.height * newScale}px`;
        }
        return changed;
    }

    render() {
        if (!this.svgElement) {
            return;
        }
        this.svgElement.setAttribute('viewBox', `0 0 ${this.metersToPixels(this.width)} ${this.metersToPixels(this.height)}`);
        this.svgElement.innerHTML = '';

        const hallPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        hallPath.setAttribute('points', hallPolygon.map(p => `${this.metersToPixels(p.x)},${this.toScreenY(p.y)}`).join(' '));
        hallPath.setAttribute('fill', '#e0f2fe');
        hallPath.setAttribute('stroke', '#1d4ed8');
        hallPath.setAttribute('stroke-width', '2');
        this.svgElement.appendChild(hallPath);

        pillars.forEach(pillar => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', this.metersToPixels(pillar.x - pillar.width / 2));
            rect.setAttribute('y', this.metersToPixels(this.height - pillar.y - pillar.height / 2));
            rect.setAttribute('width', this.metersToPixels(pillar.width));
            rect.setAttribute('height', this.metersToPixels(pillar.height));
            rect.setAttribute('rx', this.metersToPixels(0.05));
            rect.setAttribute('ry', this.metersToPixels(0.05));
            rect.classList.add('pillar');
            this.svgElement.appendChild(rect);
        });

        references.forEach(ref => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('reference');
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', this.metersToPixels(ref.from.x));
            line.setAttribute('y1', this.toScreenY(ref.from.y));
            line.setAttribute('x2', this.metersToPixels(ref.to.x));
            line.setAttribute('y2', this.toScreenY(ref.to.y));
            group.appendChild(line);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const textX = (ref.from.x + ref.to.x) / 2;
            const textY = (ref.from.y + ref.to.y) / 2;
            text.setAttribute('x', this.metersToPixels(textX));
            text.setAttribute('y', this.toScreenY(textY) - 6);
            text.setAttribute('text-anchor', 'middle');
            text.textContent = ref.label;
            group.appendChild(text);
            this.svgElement.appendChild(group);
        });
    }

    isPositionWithinHall(x, y, rotation = 0) {
        const rect = tableRectAt(x, y, rotation);
        const corners = [
            { x: rect.left, y: rect.top },
            { x: rect.right, y: rect.top },
            { x: rect.right, y: rect.bottom },
            { x: rect.left, y: rect.bottom }
        ];
        return corners.every(pt => pointInPolygon(pt, hallPolygon));
    }

    collidesWithColumns(x, y, rotation = 0) {
        const rect = tableRectAt(x, y, rotation);
        return pillars.some(pillar => {
            const pillarRect = {
                left: pillar.x - pillar.width / 2,
                right: pillar.x + pillar.width / 2,
                top: pillar.y - pillar.height / 2,
                bottom: pillar.y + pillar.height / 2
            };
            return !(rect.left >= pillarRect.right || rect.right <= pillarRect.left || rect.top >= pillarRect.bottom || rect.bottom <= pillarRect.top);
        });
    }

    isChairWithinHall(x, y) {
        const rect = chairRectAt(x, y);
        const corners = [
            { x: rect.left, y: rect.top },
            { x: rect.right, y: rect.top },
            { x: rect.right, y: rect.bottom },
            { x: rect.left, y: rect.bottom }
        ];
        return corners.every(pt => pointInPolygon(pt, hallPolygon));
    }

    chairCollidesWithColumns(x, y) {
        const rect = chairRectAt(x, y);
        return pillars.some(pillar => {
            const pillarRect = {
                left: pillar.x - pillar.width / 2,
                right: pillar.x + pillar.width / 2,
                top: pillar.y - pillar.height / 2,
                bottom: pillar.y + pillar.height / 2
            };
            return !(rect.left >= pillarRect.right || rect.right <= pillarRect.left || rect.top >= pillarRect.bottom || rect.bottom <= pillarRect.top);
        });
    }
}
