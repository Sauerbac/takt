import type { Bar, ChartDocument, Milestone } from './document';

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
    .filter((bar) => bar.id !== proposal.id && bar.rowId === proposal.rowId)
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
    bar.id === proposal.id ? proposal : (byId.get(bar.id) ?? bar),
  );
  if (!document.bars.some((bar) => bar.id === proposal.id)) bars.push(proposal);
  return { ...document, bars };
}

// Open space between two anchored neighbors without sending either chain
// across the held bar. The committed row order fixes the two sides throughout
// this push; painted geometry and subsequent pointer motion do not repartition it.
export function placeBarBetween(
  document: ChartDocument,
  proposal: Bar,
  leftAnchor: string,
  rightAnchor: string,
): ChartDocument {
  const split = document.bars.find((bar) => bar.id === rightAnchor)!.start;
  const sides = (left: boolean) => ({
    ...document,
    bars: document.bars.filter(
      (bar) => bar.rowId === proposal.rowId && bar.start < split === left,
    ),
  });
  const left = placeBar(sides(true), proposal, 'left', leftAnchor);
  const right = placeBar(sides(false), proposal, 'right', rightAnchor);
  const resolved = new Map(
    [...left.bars, ...right.bars].map((bar) => [bar.id, bar]),
  );
  return {
    ...document,
    bars: document.bars.map((bar) => resolved.get(bar.id) ?? bar),
  };
}

export function placeMilestone(
  document: ChartDocument,
  proposal: Milestone,
): ChartDocument {
  if (
    document.milestones.some(
      (item) =>
        item.id !== proposal.id &&
        item.rowId === proposal.rowId &&
        item.boundary === proposal.boundary,
    )
  )
    return document;
  const exists = document.milestones.some((item) => item.id === proposal.id);
  return {
    ...document,
    milestones: exists
      ? document.milestones.map((item) =>
          item.id === proposal.id ? proposal : item,
        )
      : [...document.milestones, proposal],
  };
}
