// Types for scripts/art/lib/index.mjs, so the TypeScript tests can import the art pipeline.

export interface Img {
  width: number;
  height: number;
  data: Uint8Array;
}
export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}
export interface Eye {
  x: number;
  y: number;
  r: number;
  across?: number;
}
export interface Issue {
  level: "ERR" | "WARN";
  code: string;
  msg: string;
}
export interface Shot {
  id: string;
  kind: string;
  facing: string;
  frames: number;
  tiers: string[];
  anchors: string[];
  bases: (string | null)[];
  canvas: [number, number];
  masterScale: number;
  pose: string | null;
  placeholders: Record<string, string>;
  lint: { skip?: string[]; headWidthTolerance?: number } | null;
  attachRequired: string[];
  attach: Record<string, unknown>;
  target: { w: number } | null;
  approved: (number | string)[];
  row: string[];
  [key: string]: unknown;
}
export interface ShotsDoc {
  profile: string | null;
  templates: { key: string; heading: string; intro: string; body: string }[];
  sections: { id: string; title: string; columns: string[]; rows?: string[][] }[];
  shots: Shot[];
  [key: string]: unknown;
}
export interface Frame {
  id: string;
  n: number;
  shot: Shot;
  tier: string;
  anchor: string;
  base: string | null;
  placeholder: string | null;
  fallback: string[];
  approved: boolean;
  page: string | null;
}
export interface FrameMeta {
  anchorType: string;
  anchor: [number, number];
  bbox: BBox | null;
  eyes: Eye[];
  [key: string]: unknown;
}
export interface FrameResult {
  frame: Frame;
  source: "master" | "placeholder" | "missing";
  l1: Img | null;
  l2: Img | null;
  meta: FrameMeta | null;
  issues: Issue[];
  status: string;
  final: boolean;
}
export interface All {
  doc: ShotsDoc;
  frames: Frame[];
  byId: Map<string, Frame>;
  results: Map<string, FrameResult>;
}
export interface Coverage {
  total: number;
  final: number;
  master: number;
  placeholder: number;
  missing: number;
  tiers: Record<
    string,
    { total: number; final: number; master: number; placeholder: number; missing: number }
  >;
}

export declare const KEY: readonly [number, number, number];
export declare const PATHS: Record<string, string>;
export declare function createImage(width: number, height: number, rgba?: readonly number[]): Img;
export declare function decodePng(buf: Uint8Array): Img;
export declare function encodePng(img: Img): Uint8Array;
export declare function readPng(file: string): Img;
export declare function writePng(file: string, img: Img): void;
export declare function drawOver(dst: Img, src: Img, dx: number, dy: number): void;
export declare function blit(dst: Img, src: Img, dx: number, dy: number): void;
export declare function keyDistance(r: number, g: number, b: number): number;
export declare function magentaRatio(r: number, g: number, b: number): number;
export declare function softKey(raw: Img, options?: { profile?: string; fringy?: boolean }): Img;
export declare function inspectBackground(img: Img): {
  ok: boolean;
  checkerboard: boolean;
  magentaShare: number;
  message: string | null;
};
export declare function alphaBBox(img: Img, thr?: number): BBox | null;
export declare function alphaIoU(a: Img, b: Img, thr?: number): number;
export declare function findHoles(img: Img, thr?: number): { area: number; x: number; y: number }[];
export declare function rimStats(img: Img): { rim: number; darkShare: number; hardShare: number };
export declare function magentaPixels(img: Img, thr?: number): number;
export declare function detectEyes(img: Img, scale?: number): Eye[];
export declare function alignFrame(
  img: Img,
  spec: { anchorType: string; facing: string; canvas: [number, number] },
  s: number,
): { image: Img; dx: number; dy: number };
export declare function alignOverlay(
  img: Img,
  base: Img,
  range?: number,
): { image: Img; scale: number; tx: number; ty: number; iou: number };
export declare function splitStrip(keyed: Img, count: number): Img[];
export declare function parseShotlist(md: string): {
  templates: ShotsDoc["templates"];
  intro: string;
  sections: {
    id: string;
    title: string;
    columns: string[];
    rows: string[][];
    intro: string;
    outro: string;
  }[];
};
export declare function renderShotlist(doc: ShotsDoc): string;
export declare function shotPrompt(doc: ShotsDoc, shot: Shot, key: string): string;
export declare function listFrames(doc: ShotsDoc): Frame[];
export declare function loadDoc(root: string): ShotsDoc;
export declare function regenerateDoc(root: string, prev: ShotsDoc | null): ShotsDoc;
export declare function stringifyDoc(doc: ShotsDoc): string;
export declare function analyzeFrame(l1: Img, frame: Frame, byId: Map<string, Frame>): FrameMeta;
export declare function checkFrame(
  l1: Img,
  frame: Frame,
  meta: FrameMeta,
  ctx: {
    profile?: string | null;
    baseL1?: Img | null;
    refHeadWidth?: number | null;
    refHeadId?: string | null;
  },
): Issue[];
export declare function computeAll(root: string, doc?: ShotsDoc): All;
export declare function coverage(all: All): Coverage;
export declare function coverageLine(c: Coverage): string;
export declare function build(root: string, all?: All): { all: All };
export declare function importInbox(
  root: string,
  opts: {
    inbox: string;
    profile?: string | null;
    keep?: boolean;
    log?: (...args: unknown[]) => void;
  },
): Promise<{
  outcomes: { id: string; file: string; ok: boolean; error?: string; warn?: string[] }[];
  /** Where each imported raw was moved (under <inbox>/imported/); empty with `keep`. */
  archived: string[];
}>;
export declare const OVL_MIN_IOU: number;
export declare function pack(
  items: { id: string; w: number; h: number }[],
  pad?: number,
): { width: number; height: number; rects: Map<string, [number, number, number, number]> };
export declare function wrapWords(words: string[], max: number): string[];
export declare function renderContactSheet(
  all: All,
  opts?: { cell?: number; cols?: number; title?: string },
): Img;
