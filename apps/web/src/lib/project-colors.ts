/**
 * A stable colour per project for the schedule (blocks, legend). Classes are literal strings so
 * Tailwind keeps them.
 */
export const PROJECT_COLORS = [
  'bg-sky-100 border-sky-400 text-sky-950',
  'bg-amber-100 border-amber-400 text-amber-950',
  'bg-emerald-100 border-emerald-400 text-emerald-950',
  'bg-violet-100 border-violet-400 text-violet-950',
  'bg-rose-100 border-rose-400 text-rose-950',
  'bg-lime-100 border-lime-500 text-lime-950',
  'bg-cyan-100 border-cyan-400 text-cyan-950',
  'bg-orange-100 border-orange-400 text-orange-950',
  'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-950',
  'bg-teal-100 border-teal-400 text-teal-950',
] as const;

/** Same id → same colour (FNV-1a hash of the id). */
export function projectColor(projectId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < projectId.length; i++) {
    h ^= projectId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return PROJECT_COLORS[(h >>> 0) % PROJECT_COLORS.length]!;
}
