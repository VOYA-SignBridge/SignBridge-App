export type MediaPipeLandmark = { x: number; y: number; z: number };

export type AlphabetHandsEvent = {
  hands: { landmarks: MediaPipeLandmark[]; label?: string; score: number }[];
  timestamp: number;
};
