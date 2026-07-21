import { mapState } from '../core/state.js';
import { GameBounds } from '../types/map.js';

const viewport = document.getElementById('map-viewport') as HTMLElement;
const container = document.getElementById('screen-container') as HTMLElement;

export const MapViewport = {
    /**
     * Normalizes game grid units into screen percentage numbers 
     * using active worldspace boundaries and precise gutter metrics.
     */
    gameToMapCoords(gameX: number, gameY: number, gameZ: number, bounds: GameBounds) {
        const config = mapState.activeMapConfig;
        if (!config) return { x: 0, y: 0, z: 0 };

        const totalWidth = bounds.maxX - bounds.minX;
        const totalHeight = bounds.maxY - bounds.minY;
        
        const rawPctX = (gameX - bounds.minX) / totalWidth;
        const rawPctY = (gameY - bounds.minY) / totalHeight;
        
        const usableWidthPct = 1.0 - config.gutters.left - config.gutters.right;
        const usableHeightPct = 1.0 - config.gutters.top - config.gutters.bottom;
        
        const pctX = (config.gutters.left + (rawPctX * usableWidthPct)) * 100;
        const pctY = (config.gutters.top + ((1.0 - rawPctY) * usableHeightPct)) * 100;
        
        return { x: pctX, y: pctY, z: gameZ };
    },

    /**
     * Calculates pan boundaries to ensure the map canvas completely spans the window bounds.
     */
    updateViewportTransform() {
        if (!viewport) return;

        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const viewportWidth = baseSize * mapState.zoom;
        const viewportHeight = baseSize * mapState.zoom;
        
        const minPanX = window.innerWidth - viewportWidth;
        const minPanY = window.innerHeight - viewportHeight;
        
        if (viewportWidth > window.innerWidth) {
            mapState.panX = Math.min(0, Math.max(minPanX, mapState.panX));
        } else {
            mapState.panX = (window.innerWidth - viewportWidth) / 2;
        }
        
        if (viewportHeight > window.innerHeight) {
            mapState.panY = Math.min(0, Math.max(minPanY, mapState.panY));
        } else {
            mapState.panY = (window.innerHeight - viewportHeight) / 2;
        }
        
        viewport.style.transform = `translate(${mapState.panX}px, ${mapState.panY}px) scale(${mapState.zoom})`;
        
        const markerScale = Math.sqrt(mapState.zoom) / mapState.zoom;
        
        document.querySelectorAll('.marker-container').forEach((el) => {
            const containerHtml = el as HTMLElement;
            const isHovered = containerHtml.classList.contains('is-hovered');
            const isMenuActive = containerHtml.classList.contains('menu-active');
            const sizeMultiplier = (isHovered || isMenuActive) ? 1.35 : 1.0;
            containerHtml.style.transform = `scale(${markerScale * sizeMultiplier})`;
        });
        
        const playerImg = document.getElementById('player-marker') as HTMLElement;
        if (playerImg && mapState.player.active) {
            playerImg.style.transform = `translate(-50%, -50%) scale(${markerScale}) rotate(${mapState.player.angle}deg)`;
        }

        if (window.repositionActivePopover) {
            window.repositionActivePopover();
        }
    },

    centerInitialViewport() {
        mapState.zoom = 1.0;
        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        mapState.panX = (window.innerWidth - baseSize) / 2;
        mapState.panY = (window.innerHeight - baseSize) / 2;
        this.updateViewportTransform();
    },

    initEvents() {
        if (!container || !viewport) return;

        window.addEventListener('resize', () => this.centerInitialViewport());

        container.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const zoomIntensity = 0.15;
            const mouseX = e.clientX;
            const mouseY = e.clientY;
            
            const mapTargetX = (mouseX - mapState.panX) / mapState.zoom;
            const mapTargetY = (mouseY - mapState.panY) / mapState.zoom;
            
            if (e.deltaY < 0) {
                mapState.zoom = Math.min(mapState.maxZoomIn, mapState.zoom + zoomIntensity);
            } else {
                mapState.zoom = Math.max(mapState.maxZoomOut, mapState.zoom - zoomIntensity);
            }
            
            mapState.panX = mouseX - (mapTargetX * mapState.zoom);
            mapState.panY = mouseY - (mapTargetY * mapState.zoom);
            this.updateViewportTransform();
        }, { passive: false });

        viewport.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button !== 0) return;
            e.preventDefault();
            mapState.isDragging = true;
            mapState.startX = e.clientX - mapState.panX;
            mapState.startY = e.clientY - mapState.panY;
            viewport.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e: MouseEvent) => {
            if (!mapState.isDragging) return;
            if (window.closeActivePopover) {
                window.closeActivePopover();
            }
            mapState.panX = e.clientX - mapState.startX;
            mapState.panY = e.clientY - mapState.startY;
            this.updateViewportTransform();
        });

        window.addEventListener('mouseup', () => {
            if (!mapState.isDragging) return;
            mapState.isDragging = false;
            viewport.style.cursor = 'grab';
        });

        window.addEventListener('dragstart', (e) => e.preventDefault());
    }
};
