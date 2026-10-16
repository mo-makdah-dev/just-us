import { PIXEL_COLORS, type AvatarDesign, type AvatarId } from '../../protocol/src/index.js';

const looks: Record<AvatarId, { bg: string; shirt: string; hair: string; skin: string; style: number }> = {
  moss: { bg: '#dce6cb', shirt: '#648573', hair: '#3e3531', skin: '#dca77e', style: 0 },
  peach: { bg: '#f5dacc', shirt: '#c77f70', hair: '#704532', skin: '#f2c7a6', style: 1 },
  lilac: { bg: '#e3d8ec', shirt: '#8e78aa', hair: '#332e40', skin: '#b97f60', style: 2 },
  sky: { bg: '#d6e5ed', shirt: '#668ca2', hair: '#795b40', skin: '#f3d0ac', style: 3 },
  sun: { bg: '#f3e8ba', shirt: '#b59043', hair: '#342b29', skin: '#895c47', style: 1 },
  rose: { bg: '#edd8df', shirt: '#ad7588', hair: '#b5784e', skin: '#ebbb9b', style: 0 },
};
export function Avatar({ id, design, label, className = '' }: { id: AvatarId; design?: AvatarDesign | null; label?: string; className?: string }) {
  const c = looks[id] ?? looks.moss;
  if (design?.pixels.length === 576) return <svg className={`avatar custom-avatar ${className}`} viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} shapeRendering="crispEdges">{PIXEL_COLORS.slice(1).map((color, index) => <path key={color} fill={color} d={design.pixels.flatMap((p, cell) => p === index + 1 ? [`M${cell % 24} ${Math.floor(cell / 24)}h1v1h-1z`] : []).join('')} />)}</svg>;
  return <svg className={`avatar ${className}`} viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} shapeRendering="crispEdges">
    <rect width="24" height="24" fill={c.bg} />
    <path d="M5 24V20H7V18H10V16H14V18H17V20H19V24Z" fill={c.shirt} />
    {c.style === 1 && <path d="M5 8H19V19H16V16H8V19H5Z" fill={c.hair} />}
    <path d="M7 7H17V15H15V17H9V15H7Z" fill={c.skin} />
    <path d={c.style === 2 ? 'M6 5H8V3H15V5H18V10H16V8H12V6H9V10H6Z' : c.style === 3 ? 'M6 7H8V5H16V7H18V11H16V8H8V11H6Z' : 'M6 7H8V5H16V7H18V11H16V9H12V7H10V9H8V11H6Z'} fill={c.hair} />
    <path d="M9 11H10V13H9ZM14 11H15V13H14Z" fill="#352f36" />
    <path d="M11 14H14V15H11Z" fill="#9b5b55" />
    <path d="M10 19H14V20H10Z" fill="#fff4dd" />
  </svg>;
}
