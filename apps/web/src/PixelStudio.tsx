import { useRef, useState } from 'react';
import { Avatar } from '../../../packages/avatar/src/Avatar.js';
import { colorNames, fillPixels, PIXEL_COLORS, presetPixels } from '../../../packages/avatar/src/pixels.js';
import { AVATARS, type AvatarDesign, type AvatarId } from '../../../packages/protocol/src/index.js';

export function PixelStudio({ value, preset, onChange }: { value: AvatarDesign | null; preset: AvatarId; onChange: (design: AvatarDesign | null) => void }) {
  const pixels = value?.pixels || presetPixels(preset).pixels;
  const current = useRef(pixels); current.current = pixels;
  const [color, setColor] = useState(11); const [tool, setTool] = useState<'pencil' | 'erase' | 'fill'>('pencil');
  const [undo, setUndo] = useState<number[][]>([]); const [redo, setRedo] = useState<number[][]>([]);
  const [cursor, setCursor] = useState(0); const [grid, setGrid] = useState(true);
  const painting = useRef(false); const origin = useRef<number[] | null>(null);
  const change = (next: number[]) => { current.current = next; onChange({ version: 1, pixels: next }); };
  function record(previous: number[]) { setUndo(s => [...s.slice(-29), [...previous]]); setRedo([]); }
  function paint(index: number) { const p = current.current; const selected = tool === 'erase' ? 0 : color; change(tool === 'fill' ? fillPixels(p, index, selected) : p.map((v, i) => i === index ? selected : v)); setCursor(index); }
  const finish = () => { if (painting.current && origin.current) record(origin.current); painting.current = false; origin.current = null; };
  function point(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(23, Math.floor((event.clientY - bounds.top) / bounds.height * 24))) * 24 + Math.max(0, Math.min(23, Math.floor((event.clientX - bounds.left) / bounds.width * 24)));
  }
  function history(direction: 'undo' | 'redo') {
    const source = direction === 'undo' ? undo : redo;
    if (!source.length) return;
    const next = source[source.length - 1];
    if (direction === 'undo') { setRedo(s => [...s, [...pixels]]); setUndo(s => s.slice(0, -1)); }
    else { setUndo(s => [...s, [...pixels]]); setRedo(s => s.slice(0, -1)); }
    change(next);
  }
  return <section className="pixel-studio" aria-labelledby="studio-title"><div className="studio-heading"><div><p className="eyebrow">A LITTLE WORK OF YOU</p><h3 id="studio-title">Your pixel studio</h3></div><span className="pill">24 × 24</span></div><p className="studio-intro">Start with a familiar face, then make every little pixel yours.</p>
    <div className="studio-workspace"><div><div className="pixel-canvas checkerboard" tabIndex={0} role="group" aria-label="Pixel canvas" aria-describedby="pixel-instructions" onKeyDown={event => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(event.key)) event.preventDefault();
      if (event.key === 'ArrowUp') setCursor(c => Math.max(0, c - 24)); if (event.key === 'ArrowDown') setCursor(c => Math.min(575, c + 24));
      if (event.key === 'ArrowLeft') setCursor(c => c % 24 === 0 ? c : c - 1); if (event.key === 'ArrowRight') setCursor(c => c % 24 === 23 ? c : c + 1);
      if (event.key === ' ' || event.key === 'Enter') { record(pixels); paint(cursor); }
    }}><svg viewBox="0 0 24 24" aria-hidden="true" onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.parentElement?.focus(); event.currentTarget.setPointerCapture(event.pointerId); painting.current = true; origin.current = [...pixels]; paint(point(event)); }} onPointerMove={event => { if (painting.current && tool !== 'fill') paint(point(event)); }} onPointerUp={finish} onPointerCancel={finish} shapeRendering="crispEdges">
      {pixels.map((p, i) => <rect key={i} x={i % 24} y={Math.floor(i / 24)} width="1" height="1" fill={PIXEL_COLORS[p]} />)}
      {grid && <path className="pixel-grid" d={Array.from({ length: 25 }, (_, i) => `M${i} 0v24M0 ${i}h24`).join('')} />}
      <rect className="pixel-cursor" x={cursor % 24} y={Math.floor(cursor / 24)} width="1" height="1" fill="none" />
    </svg></div><p className="pixel-position" aria-live="polite">Row {Math.floor(cursor / 24) + 1}, column {cursor % 24 + 1} · {colorNames[pixels[cursor]]}</p></div><aside className="studio-preview"><span className="small-label">LITTLE YOU, LIVE</span><Avatar id={preset} design={{ version: 1, pixels }} label="Live preview of your pixel avatar" /><p>In your room.<br />On your profile.<br />Entirely you.</p></aside></div>
    <div className="studio-tools" role="group" aria-label="Drawing tools">{(['pencil', 'erase', 'fill'] as const).map(t => <button type="button" key={t} className={tool === t ? 'selected' : ''} aria-pressed={tool === t} onClick={() => setTool(t)}>{t === 'pencil' ? '✎ Pencil' : t === 'erase' ? '⌫ Eraser' : '▨ Fill'}</button>)}<button type="button" disabled={!undo.length} onClick={() => history('undo')}>↶ Undo</button><button type="button" disabled={!redo.length} onClick={() => history('redo')}>↷ Redo</button></div>
    <div className="pixel-palette" role="group" aria-label="Pixel colors">{PIXEL_COLORS.map((shade, i) => <button type="button" key={shade} className={`color-swatch ${i === color ? 'selected' : ''} ${i === 0 ? 'checkerboard' : ''}`} aria-label={colorNames[i]} aria-pressed={color === i} onClick={() => { setColor(i); if (tool === 'erase') setTool('pencil'); }}><svg viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="5" fill={shade} /></svg>{color === i && <span aria-hidden="true">✓</span>}</button>)}</div>
    <div className="studio-bottom"><label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /> Show grid</label><button type="button" className="text-button" onClick={() => { record(pixels); onChange(null); }}>Reset to preset</button></div><p id="pixel-instructions" className="input-help">Draw with your finger or mouse. Keyboard: focus the canvas, move with arrow keys, paint with Space or Enter. Choose a color first.</p><div className="studio-presets" role="group" aria-label="Avatar starting points">{AVATARS.map(id => <button type="button" key={id} aria-label={`Start from ${id}`} onClick={() => { record(pixels); change(presetPixels(id).pixels); }}><Avatar id={id} /></button>)}</div><p className="input-help">Choose Done to save your avatar, or Cancel to keep your previous one.</p>
  </section>;
}
