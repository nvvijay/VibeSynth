import { describe, it, expect, vi } from 'vitest';
import { VoiceAllocator } from '../../src/engine/audio/VoiceAllocator';

describe('VoiceAllocator', () => {
  it('defaults maxVoices to 2', () => {
    const allocator = new VoiceAllocator();
    expect(allocator.maxVoices).toBe(2);
  });

  it('allocates a voice for a note-on event', () => {
    const allocator = new VoiceAllocator();
    const voice = allocator.allocate(60, 100);
    expect(voice.noteNumber).toBe(60);
    expect(voice.velocity).toBe(100);
    expect(voice.isActive).toBe(true);
  });

  it('returns the allocated voice in getActiveVoices', () => {
    const allocator = new VoiceAllocator();
    allocator.allocate(60, 100);
    expect(allocator.getActiveVoices()).toHaveLength(1);
  });

  it('steals the oldest voice when all voices are in use', () => {
    const allocator = new VoiceAllocator(2);
    const v1 = allocator.allocate(60, 100);
    allocator.allocate(62, 100);
    const v3 = allocator.allocate(64, 100);

    // v1 was the oldest, so it should have been stolen and reassigned
    expect(v3).toBe(v1);
    expect(v3.noteNumber).toBe(64);
    expect(v3.isActive).toBe(true);
    expect(allocator.getActiveVoices()).toHaveLength(2);
  });

  it('releases a voice by noteNumber', () => {
    const allocator = new VoiceAllocator();
    allocator.allocate(60, 100);
    allocator.release(60);
    expect(allocator.getActiveVoices()).toHaveLength(0);
  });

  it('release is a no-op for a note with no active voice', () => {
    const allocator = new VoiceAllocator();
    allocator.allocate(60, 100);
    allocator.release(62); // not playing
    expect(allocator.getActiveVoices()).toHaveLength(1);
  });

  it('setMaxVoices clamps 0 to 1 and logs a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const allocator = new VoiceAllocator();
    allocator.setMaxVoices(0);
    expect(allocator.maxVoices).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('setMaxVoices clamps negative values to 1', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const allocator = new VoiceAllocator();
    allocator.setMaxVoices(-5);
    expect(allocator.maxVoices).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('setMaxVoices accepts valid positive values', () => {
    const allocator = new VoiceAllocator();
    allocator.setMaxVoices(8);
    expect(allocator.maxVoices).toBe(8);
  });

  it('reuses a released voice before stealing', () => {
    const allocator = new VoiceAllocator(2);
    allocator.allocate(60, 100);
    allocator.allocate(62, 100);
    allocator.release(60);

    const v3 = allocator.allocate(64, 100);
    expect(v3.noteNumber).toBe(64);
    // Should have reused the released voice, not stolen the active one
    expect(allocator.getActiveVoices()).toHaveLength(2);
    const activeNotes = allocator.getActiveVoices().map((v) => v.noteNumber);
    expect(activeNotes).toContain(62);
    expect(activeNotes).toContain(64);
  });
});
