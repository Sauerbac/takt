import type { Bar, ChartDocument } from './document';

export const snapWeek = (week: number): number => Math.floor(week + 0.5);
export type PushDirection = 'left' | 'right';

// Resolve endpoint collisions, or retain a movement push from its activated neighbor.
// The anchor keeps that neighbor and the reached chain ahead even after passing
// their committed intervals; all displacement is still derived from this document.
export function placeBar(
  document: ChartDocument,
  proposal: Bar,
  direction: PushDirection,
  pushFrom?: string,
): ChartDocument {
  const others = document.bars
    .filter((bar) => bar.id !== proposal.id)
    .map((bar) => ({ ...bar }));
  if (direction === 'right') {
    others.sort((a, b) => a.start - b.start);
    let boundary = proposal.end;
    let anchored = false;
    for (const bar of others) {
      anchored ||= bar.id === pushFrom;
      if ((!anchored && bar.end <= proposal.start) || bar.start >= boundary)
        continue;
      const duration = bar.end - bar.start;
      bar.start = boundary;
      bar.end = boundary + duration;
      boundary = bar.end;
    }
  } else {
    others.sort((a, b) => b.start - a.start);
    let boundary = proposal.start;
    let anchored = false;
    for (const bar of others) {
      anchored ||= bar.id === pushFrom;
      if ((!anchored && bar.start >= proposal.end) || bar.end <= boundary)
        continue;
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
