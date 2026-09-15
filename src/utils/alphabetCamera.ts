import { assignHandSlots, wristOf, type HandAnchors, type MediaPipeLandmark } from './alphabetHandIdentity';

export type AlphabetDetection = { label: string; score: number; landmarks: MediaPipeLandmark[] };
export type AlphabetFrame = {
  timestampMs: number;
  handCount: number;
  frame: number[];
  detections: AlphabetDetection[];
  imageWidth: number;
  imageHeight: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function isAlphabetDetections(value: unknown): value is AlphabetDetection[] {
  return Array.isArray(value) && value.length <= 2 && value.every((d: unknown) =>
    isRecord(d) && typeof d.label === 'string' && isFiniteNumber(d.score) &&
    Array.isArray(d.landmarks) && d.landmarks.length === 21 &&
    d.landmarks.every((p: unknown) => isRecord(p) &&
      isFiniteNumber(p.x) && isFiniteNumber(p.y) && isFiniteNumber(p.z)));
}

/** Native events are runtime data; a TS annotation cannot validate an older APK. */
export function readAlphabetFrame(value: unknown):
  { frame: AlphabetFrame; error?: never } | { frame?: never; error: string } {
  if (isRecord(value) && value.detections === undefined) {
    return { error: 'Bản Android đang chạy chưa hỗ trợ camera alphabet mới. Hãy cài APK mới hoặc build lại Android; Reload/Fast Refresh không cập nhật phần native.' };
  }
  if (!isRecord(value) || !isAlphabetDetections(value.detections) ||
      !isFiniteNumber(value.timestampMs) || value.handCount !== value.detections.length ||
      !Array.isArray(value.frame) || value.frame.length !== 126 || !value.frame.every(isFiniteNumber) ||
      !isFiniteNumber(value.imageWidth) || value.imageWidth <= 0 ||
      !isFiniteNumber(value.imageHeight) || value.imageHeight <= 0) {
    return { error: 'Dữ liệu camera alphabet không hợp lệ. Hãy đóng rồi mở lại màn hình camera.' };
  }
  return { frame: value as AlphabetFrame };
}

/** Resolve identity in anatomical space, then return MP slots for the native swap. */
export class AlphabetHandTracker {
  private anchors: HandAnchors = {};
  reset() { this.anchors = {}; }
  encode(detections: unknown, now: number): number[] | null {
    // Missing/malformed payload is not the same as a real empty detection.
    if (!isAlphabetDetections(detections) || !Number.isFinite(now)) return null;
    const assignment = assignHandSlots(detections.map((d) => ({
      ...d, label: d.label === 'Left' ? 'Right' : d.label === 'Right' ? 'Left' : undefined,
    })), this.anchors, now);
    const out = Array(126).fill(0);
    for (const slot of ['left', 'right'] as const) {
      const landmarks = assignment[slot];
      if (!landmarks?.length) continue;
      this.anchors[slot] = { ...wristOf(landmarks), t: now };
      // Native AlphabetPreprocessing swaps once, so serialize back to MP slots.
      const offset = slot === 'left' ? 63 : 0;
      landmarks.slice(0, 21).forEach((p, i) => {
        out[offset + i * 3] = p.x;
        out[offset + i * 3 + 1] = p.y;
        out[offset + i * 3 + 2] = p.z;
      });
    }
    return out;
  }
}

export type AlphabetCapture = {
  schemaVersion: 1;
  pipelineVersion: 'alphabet-camera-v2';
  capturedAt: string;
  frames: number[][];
  events: AlphabetFrame[];
  prediction: { modelId: string; modelSha256: string; classIndex: number; label: string; confidence: number; logits: number[] };
};
