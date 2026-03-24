import { useState, useCallback } from 'react';
import type { ModuleDefinition } from '../../types';
import type { Theme } from '../../theme';
import { darkPaletteCategoryColors } from '../../theme';

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  source:    { bg: '#FFE5DE', border: '#FFB5A7', text: '#B5736A', accent: '#FF9A8B' },
  effect:    { bg: '#FFF8D6', border: '#F5E6A3', text: '#A89A5A', accent: '#F0D86E' },
  modulator: { bg: '#EDE5F5', border: '#D4C4E8', text: '#7A6B8A', accent: '#C4A8E0' },
  utility:   { bg: '#D4F5E9', border: '#B5EAD7', text: '#5A8A72', accent: '#8DD4B8' },
};

export interface ModulePaletteProps {
  modules: ModuleDefinition[];
  onDragStart: (typeId: string) => void;
  theme: Theme;
}

export function ModulePalette({ modules, onDragStart, theme }: ModulePaletteProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? modules.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.description.toLowerCase().includes(search.toLowerCase()) ||
        m.category.toLowerCase().includes(search.toLowerCase())
      )
    : modules;

  const grouped = filtered.reduce<Record<string, ModuleDefinition[]>>((acc, mod) => {
    (acc[mod.category] ??= []).push(mod);
    return acc;
  }, {});

  const categoryOrder = ['source', 'modulator', 'effect', 'utility'];

  const handleDragStart = useCallback((e: React.DragEvent, typeId: string) => {
    e.dataTransfer.setData('application/synth-module', typeId);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(typeId);
  }, [onDragStart]);

  return (
    <div style={{
      width: 220,
      background: theme.bg,
      borderRight: `1px solid ${theme.border}`,
      padding: '12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.textHeading, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        Modules
      </div>
      {/* Search bar */}
      <input
        type="text"
        placeholder="Search modules…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: '7px 10px',
          borderRadius: 8,
          border: `1px solid ${theme.inputBorder}`,
          background: theme.inputBg,
          fontSize: 12,
          color: theme.text,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      {categoryOrder.map((cat) => {
        const defs = grouped[cat];
        if (!defs?.length) return null;
        const lightC = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.utility;
        const darkC = darkPaletteCategoryColors[cat] ?? darkPaletteCategoryColors.utility;
        const c = theme.isDark ? darkC : lightC;
        return (
          <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: c.text,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              padding: '0 4px',
            }}>
              {cat}s
            </div>
            {defs.map((mod) => (
              <div
                key={mod.typeId}
                draggable
                onDragStart={(e) => handleDragStart(e, mod.typeId)}
                style={{
                  background: c.bg,
                  border: `1.5px solid ${c.border}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  cursor: 'grab',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 3px 12px rgba(0,0,0,0.1)`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{mod.name}</div>
                <div style={{ fontSize: 11, color: c.text, opacity: 0.7, marginTop: 2 }}>{mod.description}</div>
              </div>
            ))}
          </div>
        );
      })}
      {filtered.length === 0 && search.trim() && (
        <div style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', padding: 16 }}>
          No modules match "{search}"
        </div>
      )}
    </div>
  );
}

export default ModulePalette;
