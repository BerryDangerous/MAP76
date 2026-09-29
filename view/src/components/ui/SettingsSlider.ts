import { SettingsControl } from '@/components/ui/SettingsRow.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { SoundService } from '@/services/soundService.js';

export class Slider implements SettingsControl {
    private container: HTMLElement;
    private track: HTMLElement;
    private fill: HTMLElement;
    private thumb: HTMLElement;
    
    private value: number;
    private min: number;
    private max: number;
    private step: number;
    private onChange: (val: number) => void;
    
    private isDragging: boolean = false;

    constructor(
        initialValue: number,
        min: number,
        max: number,
        step: number,
        onChange: (val: number) => void
    ) {
        this.value = initialValue;
        this.min = min;
        this.max = max;
        this.step = step;
        this.onChange = onChange;
        
        this.container = document.createElement('div');
        this.container.className = 'slider-container';
        
        this.track = document.createElement('div');
        this.track.className = 'slider-track';
        
        this.fill = document.createElement('div');
        this.fill.className = 'slider-fill';
        
        this.thumb = document.createElement('div');
        this.thumb.className = 'slider-thumb';
        
        this.track.appendChild(this.fill);
        this.track.appendChild(this.thumb);
        
        const trackRow = document.createElement('div');
        trackRow.className = 'slider-track-row';
        trackRow.appendChild(this.track);
        
        this.build(trackRow);
    }

    public setValue(val: number, triggerOnChange: boolean = false) {
        this.value = Math.max(this.min, Math.min(this.max, val));
        this.updateVisuals();
        if (triggerOnChange) {
            this.onChange(this.value);
        }
    }

    private build(trackRow: HTMLElement) {
        const leftArrow = document.createElement('div');
        leftArrow.className = 'stepper-arrow stepper-arrow-left';
        leftArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.decrease();
        });

        const rightArrow = document.createElement('div');
        rightArrow.className = 'stepper-arrow stepper-arrow-right';
        rightArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.increase();
        });

        trackRow.insertBefore(leftArrow, this.track);
        trackRow.appendChild(rightArrow);

        this.container.appendChild(trackRow);

        this.updateVisuals();
        this.setupDragEvents();
    }

    private setupDragEvents() {
        const calculateValueFromEvent = (e: MouseEvent): number => {
            const rect = this.track.getBoundingClientRect();
            let offsetX = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
            const exactValue = this.min + (percentage * (this.max - this.min));
            const steppedValue = Math.round((exactValue - this.min) / this.step) * this.step + this.min;
            return Math.max(this.min, Math.min(this.max, steppedValue));
        };

        this.track.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.isDragging = true;
            const newVal = calculateValueFromEvent(e);
            if (newVal !== this.value) {
                SoundService.playValueChange();
            }
            this.setValue(newVal, false);
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const newVal = calculateValueFromEvent(e);
            if (newVal !== this.value) {
                SoundService.playValueChange();
                this.setValue(newVal, false);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.onChange(this.value);
            }
        });
    }

    private decrease() {
        SoundService.playValueChange();
        this.setValue(this.value - this.step, true);
    }

    private increase() {
        SoundService.playValueChange();
        this.setValue(this.value + this.step, true);
    }

    private updateVisuals() {
        const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
        this.fill.style.width = `${percentage}%`;
        this.thumb.style.left = `${percentage}%`;
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public handleKey(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'NAV_LEFT')) {
            this.decrease();
            return true;
        } else if (KeybindsSystem.isAction(e, 'NAV_RIGHT')) {
            this.increase();
            return true;
        }
        return false;
    }
}
