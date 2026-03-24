import { useState, useRef, useCallback, useEffect } from 'react';
import { ModuleRegistry } from '../engine/audio/ModuleRegistry';
import { AudioGraph } from '../engine/audio/AudioGraph';
import { registerBuiltInModules } from '../engine/audio/modules';
import type { ModuleDefinition } from '../types';

export function useAudioEngine() {
  const registryRef = useRef<ModuleRegistry | null>(null);
  const graphRef = useRef<AudioGraph | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [allModules, setAllModules] = useState<ModuleDefinition[]>([]);
  const [ready, setReady] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.5);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [audioStarted, setAudioStarted] = useState(false);

  // Initialize registry and graph (no AudioContext yet — needs user gesture)
  useEffect(() => {
    const reg = new ModuleRegistry();
    registerBuiltInModules(reg);
    registryRef.current = reg;
    graphRef.current = new AudioGraph(reg);
    setAllModules(reg.getAll());
    setReady(true);

    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  // Start AudioContext on first user interaction (required by browsers)
  const ensureAudioContext = useCallback(() => {
    if (audioStarted) return;
    if (!registryRef.current) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Recreate graph with real AudioContext, preserving existing modules/connections
    const oldGraph = graphRef.current;
    const newGraph = new AudioGraph(registryRef.current, ctx);

    if (oldGraph) {
      const oldModules = oldGraph.getModules();
      const oldConnections = oldGraph.getConnections();
      const idMap = new Map<string, string>();

      for (const mod of oldModules) {
        const newMod = newGraph.addModule(mod.typeId, mod.position);
        idMap.set(mod.id, newMod.id);
        for (const [key, val] of Object.entries(mod.parameters)) {
          newGraph.setParameter(newMod.id, key, val);
        }
      }

      for (const conn of oldConnections) {
        const srcId = idMap.get(conn.sourceModuleId);
        const tgtId = idMap.get(conn.targetModuleId);
        if (srcId && tgtId) {
          try {
            newGraph.connect(srcId, conn.sourcePortId, tgtId, conn.targetPortId);
          } catch { /* skip invalid connections */ }
        }
      }
    }

    newGraph.setMasterVolume(masterVolume);
    graphRef.current = newGraph;
    setAnalyserNode(newGraph.getAnalyser());
    setAudioStarted(true);
    setRefreshKey((k) => k + 1);
  }, [audioStarted, masterVolume]);

  // Sync master volume to audio graph
  useEffect(() => {
    graphRef.current?.setMasterVolume(masterVolume);
  }, [masterVolume]);

  const handlePatchLoaded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    registryRef,
    graphRef,
    allModules,
    ready,
    masterVolume,
    setMasterVolume,
    analyserNode,
    refreshKey,
    audioStarted,
    ensureAudioContext,
    handlePatchLoaded,
  };
}
