import { VaultBoyAnimationData } from '@/types/vaultBoy.js';

type ResolveCallback = (data: VaultBoyAnimationData) => void;
type RejectCallback = (err: Error) => void;

interface PendingResolver {
    resolve: ResolveCallback;
    reject: RejectCallback;
    timeoutId: number;
}

const dataCache = new Map<string, VaultBoyAnimationData>();
const pathCache = new Map<string, Path2D>();
const pendingResolvers = new Map<string, PendingResolver[]>();
const LOAD_TIMEOUT_MS = 5000;

function requestVaultBoyAnimationNative(key: string): void {
    if (typeof window.requestVaultBoyAnimation === 'function') {
        window.requestVaultBoyAnimation(JSON.stringify({ key }));
    } else {
        console.warn(`[VaultBoy] requestVaultBoyAnimation not bound by engine for key: ${key}`);
    }
}

/**
 * Registers animation data received from the engine or disk cache.
 * Resolves any promises awaiting this animation key.
 */
export function registerVaultBoyAnimation(key: string, data: VaultBoyAnimationData): void {
    dataCache.set(key, data);

    // Pre-cache Path2D objects for this animation
    if (data.paths) {
        for (const [pathId, d] of Object.entries(data.paths)) {
            const cacheKey = `${key}:${pathId}`;
            if (!pathCache.has(cacheKey)) {
                pathCache.set(cacheKey, new Path2D(d));
            }
        }
    }

    const pending = pendingResolvers.get(key);
    if (pending) {
        for (const p of pending) {
            window.clearTimeout(p.timeoutId);
            p.resolve(data);
        }
        pendingResolvers.delete(key);
    }
}

/**
 * Checks if the animation data is already loaded and ready in memory.
 */
export function hasVaultBoyAnimation(key: string): boolean {
    return dataCache.has(key);
}

/**
 * Synchronously returns the animation data if already loaded.
 */
export function getVaultBoyAnimation(key: string): VaultBoyAnimationData | undefined {
    return dataCache.get(key);
}

/**
 * Asynchronously loads the animation data, requesting it from the C++ plugin if not present.
 */
export function loadVaultBoyAnimation(key: string): Promise<VaultBoyAnimationData> {
    if (dataCache.has(key)) {
        return Promise.resolve(dataCache.get(key)!);
    }

    return new Promise<VaultBoyAnimationData>((resolve, reject) => {
        let resolvers = pendingResolvers.get(key);
        const isFirst = !resolvers;
        if (!resolvers) {
            resolvers = [];
            pendingResolvers.set(key, resolvers);
        }

        const timeoutId = window.setTimeout(() => {
            const list = pendingResolvers.get(key);
            if (list) {
                const idx = list.findIndex(r => r.resolve === resolve);
                if (idx !== -1) {
                    list.splice(idx, 1);
                    if (list.length === 0) {
                        pendingResolvers.delete(key);
                    }
                    reject(new Error(`Timeout loading Vault Boy animation '${key}'`));
                }
            }
        }, LOAD_TIMEOUT_MS);

        resolvers.push({ resolve, reject, timeoutId });

        if (isFirst) {
            requestVaultBoyAnimationNative(key);
        }
    });
}

/**
 * Preloads animation data in the background so it is available instantly when viewed.
 */
export function preloadVaultBoyAnimation(key: string): void {
    if (!key || dataCache.has(key) || pendingResolvers.has(key)) {
        return;
    }
    loadVaultBoyAnimation(key).catch((err) => {
        console.warn(`[VaultBoy] Failed to preload animation '${key}':`, err);
    });
}

/**
 * Retrieves or instantiates a Path2D geometry object for a specific draw call.
 */
export function getVaultBoyPath2D(key: string, pathId: string, dString?: string): Path2D | undefined {
    const cacheKey = `${key}:${pathId}`;
    let path = pathCache.get(cacheKey);
    if (!path && dString) {
        path = new Path2D(dString);
        pathCache.set(cacheKey, path);
    }
    return path;
}
