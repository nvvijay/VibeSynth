import type { NoteEvent } from '../../types';

export interface MIDIDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
}

type NoteEventCallback = (event: NoteEvent) => void;
type DeviceChangeCallback = (devices: MIDIDeviceInfo[]) => void;

/**
 * Manages MIDI device detection, message parsing, and note event emission
 * via the Web MIDI API.
 */
export class MIDIManager {
  private devices: Map<string, MIDIDeviceInfo> = new Map();
  private noteEventCallbacks: NoteEventCallback[] = [];
  private deviceChangeCallbacks: DeviceChangeCallback[] = [];
  private midiAccess: MIDIAccess | null = null;

  /**
   * Returns true if the Web MIDI API is available in the current browser.
   */
  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.requestMIDIAccess === 'function'
    );
  }

  /**
   * Returns a snapshot of all known MIDI input devices.
   */
  getDevices(): MIDIDeviceInfo[] {
    return Array.from(this.devices.values());
  }

  /**
   * Register a callback that fires whenever a NoteEvent is parsed from MIDI input.
   */
  onNoteEvent(callback: NoteEventCallback): void {
    this.noteEventCallbacks.push(callback);
  }

  /**
   * Register a callback that fires whenever the set of connected MIDI devices changes.
   */
  onDeviceChange(callback: DeviceChangeCallback): void {
    this.deviceChangeCallbacks.push(callback);
  }

  /**
   * Request MIDI access and begin listening for devices and messages.
   * If the Web MIDI API is not available, logs a warning and returns gracefully.
   */
  async init(): Promise<void> {
    if (!this.isSupported()) {
      console.warn(
        'Web MIDI API is not available in this browser. MIDI controller support is disabled.',
      );
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.onstatechange = this.handleStateChange;
      this.refreshDevices();
      this.bindInputs();
    } catch (err) {
      console.warn('Failed to request MIDI access:', err);
    }
  }

  /**
   * Stop listening and clean up all MIDI bindings.
   */
  destroy(): void {
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
      for (const input of this.midiAccess.inputs.values()) {
        input.onmidimessage = null;
      }
    }
    this.midiAccess = null;
    this.devices.clear();
    this.noteEventCallbacks = [];
    this.deviceChangeCallbacks = [];
  }

  // ── Private helpers ──────────────────────────────────────────────

  private handleStateChange = (_event: Event): void => {
    this.refreshDevices();
    this.bindInputs();
    this.fireDeviceChange();
  };

  private refreshDevices(): void {
    if (!this.midiAccess) return;

    const currentIds = new Set<string>();

    for (const input of this.midiAccess.inputs.values()) {
      currentIds.add(input.id);
      this.devices.set(input.id, {
        id: input.id,
        name: input.name ?? 'Unknown MIDI Device',
        connected: input.state === 'connected',
      });
    }

    // Remove devices that are no longer present
    for (const id of this.devices.keys()) {
      if (!currentIds.has(id)) {
        this.devices.delete(id);
      }
    }
  }

  private bindInputs(): void {
    if (!this.midiAccess) return;

    for (const input of this.midiAccess.inputs.values()) {
      // Re-assign to ensure we always have the latest handler
      input.onmidimessage = this.handleMIDIMessage;
    }
  }

  private handleMIDIMessage = (event: MIDIMessageEvent): void => {
    const data = event.data;
    if (!data || data.length < 3) {
      console.warn('Ignoring invalid MIDI message: insufficient data bytes', data);
      return;
    }

    const statusByte = data[0] & 0xf0; // mask off channel nibble
    const noteNumber = data[1];
    const velocity = data[2];

    if (noteNumber < 0 || noteNumber > 127) {
      console.warn('Ignoring MIDI message with out-of-range note number:', noteNumber);
      return;
    }

    if (statusByte === 0x90 && velocity > 0) {
      // Note-on
      this.emitNoteEvent({
        type: 'note-on',
        noteNumber,
        velocity,
        source: 'midi',
      });
    } else if (statusByte === 0x80 || (statusByte === 0x90 && velocity === 0)) {
      // Note-off (explicit 0x80 or note-on with velocity 0)
      this.emitNoteEvent({
        type: 'note-off',
        noteNumber,
        velocity: 0,
        source: 'midi',
      });
    }
    // All other MIDI messages (CC, pitch bend, etc.) are silently ignored
  };

  private emitNoteEvent(event: NoteEvent): void {
    for (const cb of this.noteEventCallbacks) {
      cb(event);
    }
  }

  private fireDeviceChange(): void {
    const snapshot = this.getDevices();
    for (const cb of this.deviceChangeCallbacks) {
      cb(snapshot);
    }
  }
}
