import { VaultBoyAnimationData } from '@/types/vaultBoy.js';
import { viewportState } from '@/map/viewportState.js';
import { 
    getVaultBoyPath2D, 
    hasVaultBoyAnimation, 
    getVaultBoyAnimation, 
    loadVaultBoyAnimation 
} from '@/core/vaultBoy.js';

let activeRafId: number | null = null;
let cancelCurrentLoad: (() => void) | null = null;
let startDelayTimer: number | null = null;

const DEFAULT_START_DELAY_MS = 500;

function isCanvasActive(canvas: HTMLCanvasElement): boolean {
    return canvas.isConnected;
}

/**
 * Starts rendering a dynamic Flash vector Vault Boy animation on the specified canvas.
 * Renders Frame 1 immediately upon opening, holding it for a brief initial delay (default 500ms)
 * to prevent initiating animation loops during rapid UI card switching.
 * Once the initial delay elapses, the animation loops continuously and seamlessly without pause.
 */
export function startVaultBoyAnimation(
    canvas: HTMLCanvasElement,
    animationKey?: string,
    tintColor: string = '#ffffcb',
    startDelayMs: number = DEFAULT_START_DELAY_MS
): () => void {
    stopVaultBoyAnimation();

    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};

    // Clear previous frame in case of quest transitions
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!animationKey || animationKey.trim().length === 0) {
        return () => {};
    }

    const key = animationKey.trim();
    let isCancelled = false;
    cancelCurrentLoad = () => {
        isCancelled = true;
    };

    const setupAndRun = (data: VaultBoyAnimationData) => {
        if (isCancelled || !isCanvasActive(canvas)) return;
        if (!data || !data.frames || data.frames.length === 0) return;

        // Adapt canvas resolution and aspect ratio to match the SWF bounding box
        if (data.width && data.height) {
            canvas.width = Math.round(data.width);
            canvas.height = Math.round(data.height);
            canvas.style.aspectRatio = `${data.width} / ${data.height}`;
        }

        let currentFrame = 1;
        const targetFps = 30;
        const frameInterval = 1000 / targetFps;
        let lastTime = 0;
        let accumulatedTime = 0;

        function renderFrame(frameNum: number): void {
            if (!ctx) return;
            const frame = data.frames[frameNum - 1];
            if (!frame) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();

            // Apply root affine frame transform matrix
            const topM = frame.t;
            ctx.transform(topM[0], topM[1], topM[2], topM[3], topM[4], topM[5]);

            const calls = frame.calls;
            for (let i = 0; i < calls.length; i++) {
                const call = calls[i];
                const pathObj = getVaultBoyPath2D(key, call.p, data.paths[call.p]);
                if (!pathObj) continue;

                ctx.save();
                if (call.t) {
                    const m = call.t;
                    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                }
                ctx.globalAlpha = call.o;

                if (call.f === '#ffffff' || call.f === '#FFFFFF') {
                    ctx.fillStyle = tintColor;
                } else if (call.f === 'none') {
                    ctx.fillStyle = 'transparent';
                } else {
                    ctx.fillStyle = call.f;
                }

                ctx.fill(pathObj, 'evenodd');
                ctx.restore();
            }

            ctx.restore();
        }

        function loop(timestamp: number): void {
            if (isCancelled || !isCanvasActive(canvas)) {
                stopVaultBoyAnimation();
                return;
            }

            if (viewportState.isDragging) {
                lastTime = timestamp;
                activeRafId = requestAnimationFrame(loop);
                return;
            }

            if (!lastTime) lastTime = timestamp;
            const delta = timestamp - lastTime;
            lastTime = timestamp;
            accumulatedTime += delta;

            const totalFrames = data.frames.length;
            if (totalFrames > 0 && accumulatedTime >= frameInterval) {
                const advance = Math.floor(accumulatedTime / frameInterval);
                accumulatedTime %= frameInterval;
                currentFrame = ((currentFrame - 1 + advance) % totalFrames) + 1;
                renderFrame(currentFrame);
            }

            activeRafId = requestAnimationFrame(loop);
        }

        renderFrame(1);

        if (data.frames.length > 1) {
            if (startDelayMs > 0) {
                startDelayTimer = window.setTimeout(() => {
                    startDelayTimer = null;
                    if (isCancelled || !isCanvasActive(canvas)) {
                        stopVaultBoyAnimation();
                        return;
                    }
                    accumulatedTime = 0;
                    lastTime = 0;
                    activeRafId = requestAnimationFrame(loop);
                }, startDelayMs);
            } else {
                activeRafId = requestAnimationFrame(loop);
            }
        }
    };

    if (hasVaultBoyAnimation(key)) {
        setupAndRun(getVaultBoyAnimation(key)!);
    } else {
        loadVaultBoyAnimation(key)
            .then((loadedData) => {
                if (isCancelled || !isCanvasActive(canvas)) return;
                setupAndRun(loadedData);
            })
            .catch((err) => {
                console.warn(`[VaultBoyAnimation] Failed to load '${key}':`, err);
            });
    }

    return () => stopVaultBoyAnimation();
}

/**
 * Stops any active animation loop, cancels pending load promises, and clears pending timers.
 */
export function stopVaultBoyAnimation(): void {
    if (startDelayTimer !== null) {
        window.clearTimeout(startDelayTimer);
        startDelayTimer = null;
    }
    if (cancelCurrentLoad) {
        cancelCurrentLoad();
        cancelCurrentLoad = null;
    }
    if (activeRafId !== null) {
        cancelAnimationFrame(activeRafId);
        activeRafId = null;
    }
}
