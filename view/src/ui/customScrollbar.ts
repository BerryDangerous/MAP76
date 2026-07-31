export interface CustomScrollbarOptions {
    container: HTMLElement;
    content: HTMLElement;
    track: HTMLElement;
    thumb: HTMLElement;
    onScroll?: (scrollTop: number) => void;
}

export class CustomScrollbar {
    private options: CustomScrollbarOptions;
    private isDragging: boolean = false;
    private startY: number = 0;
    private startScrollTop: number = 0;
    private boundOnMouseMove: (e: MouseEvent) => void;
    private boundOnMouseUp: () => void;

    constructor(options: CustomScrollbarOptions) {
        this.options = options;
        this.boundOnMouseMove = this.onMouseMove.bind(this);
        this.boundOnMouseUp = this.onMouseUp.bind(this);
        this.initEvents();
    }

    private initEvents(): void {
        const { content, track, thumb } = this.options;

        content.addEventListener('scroll', () => this.updateThumbPosition());

        thumb.addEventListener('mousedown', (e: MouseEvent) => {
            e.stopPropagation();
            this.isDragging = true;
            this.startY = e.clientY;
            this.startScrollTop = content.scrollTop;
            document.addEventListener('mousemove', this.boundOnMouseMove);
            document.addEventListener('mouseup', this.boundOnMouseUp);
        });

        track.addEventListener('click', (e: MouseEvent) => {
            if (e.target === thumb) return;
            const rect = track.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const percentage = clickY / rect.height;
            content.scrollTop = percentage * (content.scrollHeight - content.clientHeight);
        });
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;
        const { content, track } = this.options;
        const deltaY = e.clientY - this.startY;
        const scrollableHeight = content.scrollHeight - content.clientHeight;
        const trackHeight = track.clientHeight;
        if (trackHeight <= 0) return;

        const scrollDelta = (deltaY / trackHeight) * scrollableHeight;
        content.scrollTop = this.startScrollTop + scrollDelta;
    }

    private onMouseUp(): void {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);
    }

    public updateThumbPosition(): void {
        const { content, track, thumb, onScroll } = this.options;
        const scrollableHeight = content.scrollHeight - content.clientHeight;

        if (scrollableHeight <= 1) {
            track.style.display = 'none';
            return;
        }

        track.style.display = 'flex';
        const trackHeight = track.clientHeight || content.clientHeight;
        const ratio = trackHeight / content.scrollHeight;
        const thumbHeight = Math.max(30, trackHeight * ratio);
        const maxTop = trackHeight - thumbHeight;
        const topPos = (content.scrollTop / scrollableHeight) * maxTop;

        thumb.style.height = `${thumbHeight}px`;
        thumb.style.top = `${topPos}px`;
        thumb.style.transform = '';

        if (onScroll) {
            onScroll(content.scrollTop);
        }
    }

    public scrollTo(scrollTop: number): void {
        this.options.content.scrollTop = scrollTop;
        this.updateThumbPosition();
    }

    public destroy(): void {
        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);
    }
}
