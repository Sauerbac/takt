import type { ChartDocument, Row, Section } from './document';

export const sectionRows = (document: ChartDocument, sectionId: string) =>
  document.rows.filter((row) => row.sectionId === sectionId);

// Indices address the destination after removing the carried object.
export function moveRow(
  document: ChartDocument,
  id: string,
  sectionId: string,
  index: number,
): ChartDocument {
  const row = document.rows.find((row) => row.id === id);
  if (!row || !document.sections.some((section) => section.id === sectionId))
    return document;
  if (
    row.sectionId === sectionId &&
    sectionRows(document, sectionId).findIndex((row) => row.id === id) === index
  )
    return document;
  const remaining = document.rows.filter((row) => row.id !== id);
  const destination = remaining.filter((row) => row.sectionId === sectionId);
  destination.splice(Math.max(0, Math.min(index, destination.length)), 0, {
    ...row,
    sectionId,
  });
  return {
    ...document,
    rows: document.sections.flatMap((section) =>
      section.id === sectionId
        ? destination
        : remaining.filter((row) => row.sectionId === section.id),
    ),
  };
}

export function insertRow(
  document: ChartDocument,
  row: Row,
  index: number,
): ChartDocument {
  return moveRow(
    { ...document, rows: [...document.rows, row] },
    row.id,
    row.sectionId,
    index,
  );
}

export function insertSection(
  document: ChartDocument,
  section: Section,
  index: number,
): ChartDocument {
  const sections = [...document.sections];
  sections.splice(index, 0, section);
  return { ...document, sections };
}

export function moveSection(
  document: ChartDocument,
  id: string,
  index: number,
): ChartDocument {
  const section = document.sections.find((section) => section.id === id);
  if (!section) return document;
  const sections = document.sections.filter((section) => section.id !== id);
  sections.splice(Math.max(0, Math.min(index, sections.length)), 0, section);
  return { ...document, sections };
}

export function deleteContainer(
  document: ChartDocument,
  id: string,
): ChartDocument {
  const rowIds = new Set(
    document.rows
      .filter((row) => row.id === id || row.sectionId === id)
      .map((row) => row.id),
  );
  return {
    ...document,
    sections: document.sections.filter((section) => section.id !== id),
    rows: document.rows.filter((row) => !rowIds.has(row.id)),
    bars: document.bars.filter((bar) => !rowIds.has(bar.rowId)),
    milestones: document.milestones.filter((item) => !rowIds.has(item.rowId)),
  };
}
