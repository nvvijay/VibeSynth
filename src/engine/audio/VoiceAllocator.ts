export interface Voice {
  id: number;
  noteNumber: number;
  velocity: number;
  startTime: number;
  isActive: boolean;
}

export class VoiceAllocator {
  private voices: Voice[] = [];
  private _maxVoices: number;
  private nextStartTime = 0;

  constructor(maxVoices = 2) {
    this._maxVoices = Math.max(1, maxVoices);
    this.initVoices();
  }

  get maxVoices(): number {
    return this._maxVoices;
  }

  setMaxVoices(count: number): void {
    if (count <= 0) {
      console.warn(
        `VoiceAllocator: maxVoices ${count} is invalid. Clamping to 1.`,
      );
      count = 1;
    }
    this._maxVoices = count;
    this.initVoices();
  }

  allocate(noteNumber: number, velocity: number): Voice {
    const startTime = this.nextStartTime++;

    // Try to find a free (inactive) voice
    const freeVoice = this.voices.find((v) => !v.isActive);
    if (freeVoice) {
      freeVoice.noteNumber = noteNumber;
      freeVoice.velocity = velocity;
      freeVoice.startTime = startTime;
      freeVoice.isActive = true;
      return freeVoice;
    }

    // All voices in use — steal the oldest (earliest startTime)
    const oldest = this.voices.reduce((prev, curr) =>
      curr.startTime < prev.startTime ? curr : prev,
    );
    oldest.noteNumber = noteNumber;
    oldest.velocity = velocity;
    oldest.startTime = startTime;
    oldest.isActive = true;
    return oldest;
  }

  release(noteNumber: number): void {
    const voice = this.voices.find(
      (v) => v.isActive && v.noteNumber === noteNumber,
    );
    if (voice) {
      voice.isActive = false;
    }
    // No-op if no active voice is playing that note
  }

  getActiveVoices(): Voice[] {
    return this.voices.filter((v) => v.isActive);
  }

  private initVoices(): void {
    this.voices = Array.from({ length: this._maxVoices }, (_, i) => ({
      id: i,
      noteNumber: 0,
      velocity: 0,
      startTime: 0,
      isActive: false,
    }));
  }
}
