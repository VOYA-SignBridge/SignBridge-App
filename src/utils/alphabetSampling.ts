/** Timestamp sampling for alphabet only. One frame per 30 FPS bin, no JS wall-clock throttle. */
export class AlphabetSampler {
  private origin: number | null = null;
  private lastTimestamp = -Infinity;
  private lastBin = -1;
  private frames: number[][] = [];

  constructor(readonly sequenceLength = 60, readonly featureDimension = 126, readonly fps = 30) {
    if (sequenceLength !== 60 || featureDimension !== 126 || fps !== 30) {
      throw new Error('Unsupported alphabet sampling contract');
    }
  }

  reset() {
    this.origin = null;
    this.lastTimestamp = -Infinity;
    this.lastBin = -1;
    this.frames = [];
  }

  append(frame: number[], timestampMs: number): { accepted: boolean; restarted: boolean } {
    if (frame.length !== this.featureDimension || frame.some((v) => !Number.isFinite(v)) || !Number.isFinite(timestampMs)) {
      return { accepted: false, restarted: false };
    }
    if (timestampMs <= this.lastTimestamp) return { accepted: false, restarted: false };
    const restarted = this.origin !== null && timestampMs - this.lastTimestamp > this.sequenceLength * 1000 / this.fps;
    if (restarted) this.reset();
    if (this.origin === null) this.origin = timestampMs;
    // Assign to the nearest sampling tick. Native integer timestamps are
    // 0,33,66,100,... at 30 FPS; flooring would collapse tick 2 into tick 1.
    const bin = Math.round((timestampMs - this.origin) * this.fps / 1000);
    this.lastTimestamp = timestampMs;
    if (bin === this.lastBin) {
      this.frames[this.frames.length - 1] = frame.slice();
      return { accepted: false, restarted };
    }
    for (let missing = this.lastBin + 1; missing < bin; missing++) {
      this.frames.push(Array(this.featureDimension).fill(0));
    }
    this.frames.push(frame.slice());
    this.frames = this.frames.slice(-this.sequenceLength);
    this.lastBin = bin;
    return { accepted: true, restarted };
  }

  snapshot(): number[][] | null {
    return this.frames.length === this.sequenceLength ? this.frames.map((f) => f.slice()) : null;
  }
}
