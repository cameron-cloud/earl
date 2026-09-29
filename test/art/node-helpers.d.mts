// Types for test/art/node-helpers.mjs.
export declare const ROOT: string;
export declare function join(...parts: string[]): string;
export declare function readText(file: string): string;
export declare function readBytes(file: string): Uint8Array;
export declare function exists(file: string): boolean;
export declare function mkdirp(dir: string): void;
export declare function makeTempDir(prefix: string): string;
export declare function removeDir(dir: string): void;
export declare function envFlag(name: string): boolean;
export declare function writeBytes(file: string, bytes: Uint8Array): void;
export declare function copy(from: string, to: string): void;
export declare function listFiles(dir: string): string[];
