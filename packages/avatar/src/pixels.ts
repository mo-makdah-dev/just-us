import { PIXEL_COLORS, type AvatarDesign, type AvatarId } from '../../protocol/src/index.js';
export function presetPixels(id: AvatarId): AvatarDesign {
  const p = new Array<number>(576).fill(0);
  const variants = { moss: [15, 13, 1, 4], peach: [19, 9, 7, 3], lilac: [16, 11, 1, 5], sky: [17, 12, 7, 3], sun: [18, 14, 1, 6], rose: [19, 10, 8, 4] };
  const [bg, shirt, hair, skin] = variants[id];
  const rect = (x: number, y: number, w: number, h: number, color: number) => { for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) if (row < 24 && col < 24) p[row * 24 + col] = color; };
  rect(0, 0, 24, 24, bg); rect(5, 20, 14, 4, shirt); rect(7, 18, 10, 3, shirt); rect(10, 15, 4, 4, skin);
  if (id === 'peach' || id === 'sun') rect(5, 8, 14, 11, hair);
  rect(7, 7, 10, 8, skin); rect(9, 15, 6, 2, skin); rect(6, 7, 2, 4, hair); rect(16, 7, 2, 4, hair); rect(8, 5, 8, 3, hair);
  if (id === 'lilac') { rect(8, 3, 7, 3, hair); rect(11, 6, 4, 3, hair); }
  else rect(8, 7, 4, 2, hair);
  rect(9, 11, 1, 2, 1); rect(14, 11, 1, 2, 1); rect(11, 14, 3, 1, 9); rect(10, 19, 4, 1, 2);
  return { version: 1, pixels: p };
}
export function fillPixels(source: number[], index: number, color: number) {
  const next = [...source], original = next[index];
  if (original === color) return next;
  const stack = [index];
  while (stack.length) {
    const cell = stack.pop()!;
    if (next[cell] !== original) continue;
    next[cell] = color;
    const x = cell % 24, y = Math.floor(cell / 24);
    if (x > 0) stack.push(cell - 1); if (x < 23) stack.push(cell + 1);
    if (y > 0) stack.push(cell - 24); if (y < 23) stack.push(cell + 24);
  }
  return next;
}
export const colorNames = ['Transparent', 'Ink', 'Cream', 'Peach', 'Tan', 'Caramel', 'Umber', 'Chestnut', 'Copper', 'Coral', 'Rose', 'Lilac', 'Sky', 'Moss', 'Honey', 'Sage background', 'Lilac background', 'Sky background', 'Honey background', 'Rose background'];
export { PIXEL_COLORS };
