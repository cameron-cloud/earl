// Types for scripts/check-dashes.mjs, so TypeScript tests can import it.

export declare const FORBIDDEN: ReadonlyMap<string, string>;

export declare function findDashes(text: string): { line: number; column: number; name: string }[];

export declare function isBinary(path: string, bytes: Uint8Array): boolean;

export declare function isEntryPoint(argv1?: string): boolean;
