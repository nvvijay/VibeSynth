import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MIDIManager } from '../../src/engine/midi/MIDIManager';
import type { NoteEvent } from '../../src/types';
import type { MIDIDeviceInfo } from '../../src/engine/midi/MIDIManager';

// Helper to create a mock MIDIInput
function createMockInput(
  id: string,
  name: string,
  state: 'connected' | 'disconnected' = 'connected',
): {
  id: string;
  name: string;
  state: string;
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
} {
  return { id, name, state, onmidimessage: null };
}

// Helper to build a mock MIDIAccess object
function createMockMIDIAccess(
  inputs: ReturnType<typeof createMockInput>[],
): MIDIAccess {
  const inputMap = new Map<string, MIDIInput>();
  for (const inp of inputs) {
    inputMap.set(inp.id, inp as unknown as MIDIInput);
  }
  return {
    inputs: inputMap,
    outputs: new Map(),
    onstatechange: null,
    sysexEnabled: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MIDIAccess;
}

describe('MIDIManager', () => {
  let manager: MIDIManager;

  beforeEach(() => {
    manager = new MIDIManager();
    // Reset navigator.requestMIDIAccess between tests
    vi.restoreAllMocks();
  });

  // ── isSupported ──────────────────────────────────────────────

  it('isSupported() returns false when Web MIDI API is unavailable', () => {
    // In a Node/Vitest environment, navigator.requestMIDIAccess does not exist
    const original = (navigator as any).requestMIDIAccess;
    delete (navigator as any).requestMIDIAccess;

    expect(manager.isSupported()).toBe(false);

    // Restore if it existed
    if (original) {
      (navigator as any).requestMIDIAccess = original;
    }
  });

  it('isSupported() returns true when navigator.requestMIDIAccess exists', () => {
    (navigator as any).requestMIDIAccess = vi.fn();
    expect(manager.isSupported()).toBe(true);
    delete (navigator as any).requestMIDIAccess;
  });

  // ── init graceful fallback ───────────────────────────────────

  it('init() logs a warning and returns when MIDI is not supported', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Ensure unsupported
    delete (navigator as any).requestMIDIAccess;

    await manager.init();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Web MIDI API is not available'),
    );
    expect(manager.getDevices()).toEqual([]);
  });

  // ── Device detection ─────────────────────────────────────────

  it('detects connected MIDI input devices after init', async () => {
    const mockInput = createMockInput('dev-1', 'My Keyboard');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    await manager.init();

    const devices = manager.getDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0]).toEqual({
      id: 'dev-1',
      name: 'My Keyboard',
      connected: true,
    });
  });

  // ── Device connect/disconnect callback ───────────────────────

  it('fires onDeviceChange when a device state changes', async () => {
    const mockInput = createMockInput('dev-1', 'Pad', 'connected');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    const deviceChanges: MIDIDeviceInfo[][] = [];
    manager.onDeviceChange((devices) => deviceChanges.push(devices));

    await manager.init();

    // Simulate a state change (device disconnect)
    mockInput.state = 'disconnected';
    const stateHandler = mockAccess.onstatechange;
    expect(stateHandler).not.toBeNull();
    (stateHandler as Function)(new Event('statechange'));

    expect(deviceChanges).toHaveLength(1);
    expect(deviceChanges[0][0].connected).toBe(false);
  });

  // ── MIDI message parsing ─────────────────────────────────────

  it('parses note-on (0x90) messages and emits NoteEvent', async () => {
    const mockInput = createMockInput('dev-1', 'Keys');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    const events: NoteEvent[] = [];
    manager.onNoteEvent((e) => events.push(e));

    await manager.init();

    // Simulate a note-on: status 0x90, note 60, velocity 100
    const handler = mockInput.onmidimessage!;
    handler({ data: new Uint8Array([0x90, 60, 100]) } as unknown as MIDIMessageEvent);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'note-on',
      noteNumber: 60,
      velocity: 100,
      source: 'midi',
    });
  });

  it('parses note-off (0x80) messages and emits NoteEvent', async () => {
    const mockInput = createMockInput('dev-1', 'Keys');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    const events: NoteEvent[] = [];
    manager.onNoteEvent((e) => events.push(e));

    await manager.init();

    const handler = mockInput.onmidimessage!;
    handler({ data: new Uint8Array([0x80, 60, 64]) } as unknown as MIDIMessageEvent);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'note-off',
      noteNumber: 60,
      velocity: 0,
      source: 'midi',
    });
  });

  it('treats note-on with velocity 0 as note-off', async () => {
    const mockInput = createMockInput('dev-1', 'Keys');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    const events: NoteEvent[] = [];
    manager.onNoteEvent((e) => events.push(e));

    await manager.init();

    const handler = mockInput.onmidimessage!;
    handler({ data: new Uint8Array([0x90, 72, 0]) } as unknown as MIDIMessageEvent);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('note-off');
    expect(events[0].noteNumber).toBe(72);
  });

  // ── Invalid MIDI messages ────────────────────────────────────

  it('ignores MIDI messages with fewer than 3 data bytes', async () => {
    const mockInput = createMockInput('dev-1', 'Keys');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    const events: NoteEvent[] = [];
    manager.onNoteEvent((e) => events.push(e));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await manager.init();

    const handler = mockInput.onmidimessage!;
    handler({ data: new Uint8Array([0x90, 60]) } as unknown as MIDIMessageEvent);

    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('insufficient data bytes'),
      expect.anything(),
    );
  });

  it('ignores non-note MIDI messages (e.g. CC)', async () => {
    const mockInput = createMockInput('dev-1', 'Keys');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    const events: NoteEvent[] = [];
    manager.onNoteEvent((e) => events.push(e));

    await manager.init();

    const handler = mockInput.onmidimessage!;
    // CC message: 0xB0 = control change
    handler({ data: new Uint8Array([0xb0, 1, 64]) } as unknown as MIDIMessageEvent);

    expect(events).toHaveLength(0);
  });

  // ── destroy ──────────────────────────────────────────────────

  it('destroy() clears devices and callbacks', async () => {
    const mockInput = createMockInput('dev-1', 'Keys');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    manager.onNoteEvent(() => {});
    manager.onDeviceChange(() => {});

    await manager.init();
    expect(manager.getDevices()).toHaveLength(1);

    manager.destroy();

    expect(manager.getDevices()).toHaveLength(0);
    expect(mockInput.onmidimessage).toBeNull();
  });

  // ── MIDI channel handling ────────────────────────────────────

  it('correctly handles note-on messages on different MIDI channels', async () => {
    const mockInput = createMockInput('dev-1', 'Keys');
    const mockAccess = createMockMIDIAccess([mockInput]);

    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(mockAccess);

    const events: NoteEvent[] = [];
    manager.onNoteEvent((e) => events.push(e));

    await manager.init();

    const handler = mockInput.onmidimessage!;
    // Note-on on channel 5: 0x94 (0x90 | 0x04)
    handler({ data: new Uint8Array([0x94, 48, 80]) } as unknown as MIDIMessageEvent);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'note-on',
      noteNumber: 48,
      velocity: 80,
      source: 'midi',
    });
  });
});
