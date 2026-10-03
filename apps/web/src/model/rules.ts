import type { Bar, ChartDocument } from './document';

export const snapWeek = (week: number): number => Math.floor(week + 0.5);
export type PushDirection = 'left' | 'right';

// Resolve only endpoint collisions, preserving the original ordering and durations.
export function placeBar(
  document: ChartDocument,
  proposal: Bar,
  direction: PushDirection,
): ChartDocument {
  const others = document.bars
    .filter((bar) => bar.id !== proposal.id)
    .map((bar) => ({ ...bar }));
  if (direction === 'right') {
    others.sort((a, b) => a.start - b.start);
    let boundary = proposal.end;
    for (const bar of others) {
      if (bar.end <= proposal.start || bar.start >= boundary) continue;
      const duration = bar.end - bar.start;
      bar.start = boundary;
      bar.end = boundary + duration;
      boundary = bar.end;
    }
  } else {
    others.sort((a, b) => b.start - a.start);
    let boundary = proposal.start;
    for (const bar of others) {
      if (bar.start >= proposal.end || bar.end <= boundary) continue;
      const duration = bar.end - bar.start;
      bar.end = boundary;
      bar.start = boundary - duration;
      boundary = bar.start;
    }
  }
  const byId = new Map(others.map((bar) => [bar.id, bar]));
  const bars = document.bars.map((bar) =>
    bar.id === proposal.id ? proposal : byId.get(bar.id)!,
  );
  if (!document.bars.some((bar) => bar.id === proposal.id)) bars.push(proposal);
  return { ...document, bars };
}
