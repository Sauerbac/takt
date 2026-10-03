import { assertDocument, copyDocument } from './document';
import type { ChartDocument } from './document';

export interface Command {
  readonly kind:
    | 'draw'
    | 'move'
    | 'resize-left'
    | 'resize-right'
    | 'name'
    | 'delete'
    | 'milestone-move'
    | 'milestone'
    | 'add-row'
    | 'add-section'
    | 'move-row'
    | 'move-section';
  readonly before: ChartDocument;
  readonly after: ChartDocument;
  readonly revealId: string;
}

export class History {
  private past: Command[] = [];
  private future: Command[] = [];
  private current: ChartDocument;
  constructor(document: ChartDocument) {
    assertDocument(document);
    this.current = copyDocument(document);
  }
  get document(): ChartDocument {
    return copyDocument(this.current);
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  commit(
    kind: Command['kind'],
    after: ChartDocument,
    revealId: string,
  ): boolean {
    assertDocument(after);
    if (JSON.stringify(this.current) === JSON.stringify(after)) return false;
    this.past.push({
      kind,
      before: this.document,
      after: copyDocument(after),
      revealId,
    });
    this.current = copyDocument(after);
    this.future = [];
    return true;
  }
  undo(): Command | undefined {
    const command = this.past.pop();
    if (command) {
      this.future.push(command);
      this.current = copyDocument(command.before);
    }
    return command;
  }
  redo(): Command | undefined {
    const command = this.future.pop();
    if (command) {
      this.past.push(command);
      this.current = copyDocument(command.after);
    }
    return command;
  }
}
