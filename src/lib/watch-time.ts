export function watchDeltaSeconds(previousPosition: number, position: number, cap = 120): number {
  if (!Number.isFinite(previousPosition) || !Number.isFinite(position) || position <= previousPosition) return 0;
  return Math.min(cap, Math.floor(position - previousPosition));
}
