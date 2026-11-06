/**
 * vaultBoy.ts
 *
 * Defines the contract types for extracted Flash vector Vault Boy animations,
 * including 2D affine numeric transformation matrices, draw calls, and timeline frames.
 */

export type MatrixTuple = [number, number, number, number, number, number];

export interface DrawCall {
    /** Unique path ID corresponding to an entry in the SVG path dictionary (e.g. 's16_f1') */
    p: string;
    /** Solid fill color in hex format (e.g. '#ffffff') or 'none' */
    f: string;
    /** Normalized fill opacity (0.0 to 1.0) */
    o: number;
    /** Optional 2D affine transformation matrix tuple [a, b, c, d, tx, ty] */
    t?: MatrixTuple | null;
}

export interface FrameData {
    t: MatrixTuple;
    calls: DrawCall[];
}

export interface VaultBoyAnimationData {
    _meta?: {
        version?: number;
        sourceSwf?: string;
        sourceSize?: number;
    };
    width: number;
    height: number;
    paths: Record<string, string>;
    frames: FrameData[];
}
