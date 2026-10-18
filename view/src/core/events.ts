/**
 * events.ts
 *
 * Provides a zero-dependency, strongly typed in-memory event emitter for cross-seam
 * messaging between MAP76 subsystems (e.g., MapSurface -> OverlayCoordinator).
 *
 * Implements the IEventEmitter contract defined in @/types/seams.js, per ADR-0001.
 */


import { IEventEmitter, EventListener, Unsubscribe } from '@/types/seams.js';

export class TypedEventEmitter<TMap extends Record<string, any>> implements IEventEmitter<TMap> {
    private readonly listeners: {
        [K in keyof TMap]?: Set<EventListener<TMap[K]>>;
    } = {};

    /**
     * Subscribes a listener callback to the specified event.
     *
     * @param event The event name from the event map.
     * @param listener Callback invoked when the event is emitted.
     * @returns An unsubscription function for clean lifecycle teardown.
     */
    public on<K extends keyof TMap>(event: K, listener: EventListener<TMap[K]>): Unsubscribe {
        let bucket = this.listeners[event];
        if (!bucket) {
            bucket = new Set<EventListener<TMap[K]>>();
            this.listeners[event] = bucket;
        }
        bucket.add(listener);

        return () => this.off(event, listener);
    }

    /**
     * Removes an active listener callback from the specified event.
     *
     * @param event The event name from the event map.
     * @param listener The callback reference to remove.
     */
    public off<K extends keyof TMap>(event: K, listener: EventListener<TMap[K]>): void {
        const bucket = this.listeners[event];
        if (!bucket) return;

        bucket.delete(listener);
        if (bucket.size === 0) {
            delete this.listeners[event];
        }
    }

    /**
     * Dispatches an event payload synchronously to all active listeners.
     * Listeners are snapshotted into an array before iteration so that listeners
     * unsubscribing during callback execution do not mutate the loop.
     *
     * @param event The event name to emit.
     * @param payload The strongly typed payload data.
     */
    public emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
        const bucket = this.listeners[event];
        if (!bucket || bucket.size === 0) return;

        const snapshot = Array.from(bucket);
        for (const listener of snapshot) {
            listener(payload);
        }
    }
}
