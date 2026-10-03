<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { emptyDocument } from '../model/document';
  import type { ChartDocument } from '../model/document';
  import { History } from '../model/history';
  import { Gesture } from '../interaction/gesture';
  import type { GestureKind } from '../interaction/gesture';
  import { MilestoneGesture } from '../interaction/milestone';
  import { placeBar, placeMilestone } from '../model/rules';
  import {
    sectionRows,
    insertRow,
    insertSection,
    deleteContainer,
  } from '../model/structure';
  import { StructureGesture, structureLayout } from '../interaction/structure';
  import type { StructureKind } from '../interaction/structure';
  import {
    FIRST_WEEK,
    WEEK_COUNT,
    initialViewport,
    pointerWeek,
    displayedInterval,
    BAR_INSET,
    edgeVelocity,
    LABEL_WIDTH,
  } from '../viewport';
  import IconButton from './IconButton.svelte';
  import Bar from './Bar.svelte';
  import Milestone from './Milestone.svelte';

  let { initial = emptyDocument() }: { initial?: ChartDocument } = $props();
  // The initial document seeds this editor instance once; remount to open another document.
  // svelte-ignore state_referenced_locally
  const history = new History(initial);
  let document = $state(history.document);
  // Absolute structural positions animate independently of DOM order. Moving
  // keyed DOM nodes would interrupt their in-flight CSS transitions.
  let rowIds = $state(history.document.rows.map((row) => row.id));
  let sectionIds = $state(
    history.document.sections.map((section) => section.id),
  );
  let view = $state(initialViewport());
  let gesture = $state.raw<Gesture | MilestoneGesture | null>(null);
  let motion = $state<{
    meaningful: boolean;
    tracking: { start: number; end: number };
    proposal: { start: number; end: number; rowId: string } | null;
    validDrop: boolean;
  } | null>(null);
  let draft = $state('');
  let structural = $state.raw<StructureGesture | null>(null);
  let collapsed = $state<readonly string[]>([]);
  let structuralTop = $state(0);
  let structuralMeaningful = $state(false);
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let rowClick: { id: string; time: number } | null = null;
  let confirmation = $state<{
    id: string;
    kind: 'row' | 'section';
    name: string;
    rows: number;
    bars: number;
    milestones: number;
  } | null>(null);
  let dialog = $state<HTMLDialogElement>(null!);
  let canUndo = $state(false);
  let canRedo = $state(false);
  let viewport: HTMLDivElement;
  let chart: HTMLDivElement;
  let laneWidth = $state(900);
  let pointerId: number | null = null;
  let captureOwner: HTMLElement | null = null;
  let pointer: { x: number; y: number } | null = null;
  let scrollFrame: number | null = null;
  let scrollTime = 0;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let pickupY = 0;
  let pickupTop = 0;
  let trackingTop = $state(8);
  let destinationRow = '';
  let lastScrollTop = 0;
  let visibleScrollTop = $state(0);
  let menu = $state<{
    x: number;
    y: number;
    rowId: string;
    week: number;
    kind: 'lane' | 'row' | 'section';
    id: string;
  } | null>(null);
  let menuElement = $state<HTMLDivElement>(null!);
  let notice = $state('');
  const weekWidth = $derived(laneWidth / WEEK_COUNT);
  const timelineShift = $derived((FIRST_WEEK - view.firstWeek) * weekWidth);
  const weeks = $derived(
    Array.from(
      { length: WEEK_COUNT + 1 },
      (_, i) => Math.floor(view.firstWeek) + i,
    ),
  );
  const shown = $derived(document);
  const movingBetweenRows = $derived(
    gesture?.kind === 'move' || gesture?.kind === 'milestone-move',
  );
  const empty = $derived(
    shown.bars.length === 0 && shown.milestones.length === 0,
  );
  const layout = $derived(structureLayout(shown, collapsed));
  const renderedRows = $derived(
    rowIds.flatMap((id) => layout.rows.filter((row) => row.id === id)),
  );
  const renderedSections = $derived(
    sectionIds.flatMap((id) =>
      layout.sections.filter((section) => section.id === id),
    ),
  );
  const hintRow = $derived(
    layout.rows.find(
      (row) => row.visible && row.top + 54 + 44 > visibleScrollTop,
    )?.id,
  );
  const busy = $derived(!!gesture || !!structural || !!confirmation);
  const carriesRow = (id: string) =>
    !!structural &&
    structuralMeaningful &&
    (structural.kind === 'move-row'
      ? structural.id === id
      : layout.rows.some(
          (row) =>
            row.id === id && row.visible && row.sectionId === structural!.id,
        ));
  const rowVisible = (id: string) =>
    carriesRow(id) || !!layout.rows.find((row) => row.id === id)?.visible;
  function structureTop(id: string, top: number) {
    if (!structural || !structuralMeaningful) return top;
    if (structural.kind === 'move-row')
      return structural.id === id ? structuralTop : top;
    const section = layout.sections.find(
      (section) => section.id === structural!.id,
    );
    if (
      section &&
      (id === section.id || section.rows.some((row) => row.id === id))
    )
      return top + structuralTop - section.top;
    return top;
  }
  const rowTop = (id: string) =>
    structureTop(id, layout.rows.find((row) => row.id === id)?.top ?? 0) + 8;

  onDestroy(() => {
    stopScrolling();
    stopPushTimer();
    stopHoverTimer();
  });

  function syncHistory() {
    document = history.document;
    rowIds = [
      ...rowIds.filter((id) => document.rows.some((row) => row.id === id)),
      ...document.rows
        .filter((row) => !rowIds.includes(row.id))
        .map((row) => row.id),
    ];
    sectionIds = [
      ...sectionIds.filter((id) =>
        document.sections.some((section) => section.id === id),
      ),
      ...document.sections
        .filter((section) => !sectionIds.includes(section.id))
        .map((section) => section.id),
    ];
    canUndo = history.canUndo;
    canRedo = history.canRedo;
  }
  function focusName(input: HTMLInputElement) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  function weekAt(clientX: number) {
    return pointerWeek(
      clientX,
      chart.getBoundingClientRect().left + LABEL_WIDTH,
      weekWidth,
      view.firstWeek,
    );
  }
  function start(
    event: PointerEvent,
    kind: GestureKind | 'milestone-move',
    id: string = crypto.randomUUID(),
    rowId = document.rows[0]?.id,
  ) {
    if (event.button !== 0 || busy || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    menu = null;
    notice = '';
    const pressedBar = (event.currentTarget as HTMLElement).closest(
      '.bar, .milestone',
    );
    const displayed =
      kind !== 'draw' && kind !== 'milestone-move' && pressedBar
        ? displayedInterval(
            pressedBar.getBoundingClientRect(),
            chart.getBoundingClientRect().left + LABEL_WIDTH,
            weekWidth,
            view.firstWeek,
          )
        : undefined;
    finishName(true);
    view.selectedId = kind === 'draw' ? null : id;
    pointerId = event.pointerId;
    pointer = { x: event.clientX, y: event.clientY };
    gesture =
      kind === 'milestone-move'
        ? new MilestoneGesture(
            history.document,
            id,
            weekAt(event.clientX),
            weekWidth,
            pressedBar
              ? weekAt(pressedBar.getBoundingClientRect().left)
              : undefined,
          )
        : new Gesture(
            history.document,
            kind,
            id,
            weekAt(event.clientX),
            weekWidth,
            displayed,
            rowId,
          );
    destinationRow = gesture.original.rowId;
    pickupY = event.clientY;
    lastScrollTop = viewport.scrollTop;
    pickupTop = pressedBar
      ? pressedBar.getBoundingClientRect().top -
        (chart.getBoundingClientRect().top + 54)
      : rowTop(destinationRow);
    trackingTop = pickupTop;
    motion = {
      meaningful: false,
      tracking: gesture.tracking,
      proposal: null,
      validDrop: true,
    };
    // Capture on the pressed surface so clicks and double-clicks keep their bar target.
    captureOwner = event.currentTarget as HTMLElement;
    captureOwner.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if ((!gesture && !structural) || event.pointerId !== pointerId) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (structural) updateStructure();
    else updateProposal();
    updateScrolling();
  }
  function updateScrolling() {
    if (scrollVelocity() === 0 && verticalVelocity() === 0) stopScrolling();
    else if (scrollFrame === null) {
      scrollTime = performance.now();
      scrollFrame = requestAnimationFrame(scroll);
    }
  }
  function updateProposal() {
    if (!gesture || !pointer) return;
    pickupTop += viewport.scrollTop - lastScrollTop;
    lastScrollTop = viewport.scrollTop;
    if (movingBetweenRows) {
      const visible = visibleTimeline();
      for (const element of chart.querySelectorAll<HTMLElement>(
        '[data-row-lane]',
      )) {
        const bounds = element.getBoundingClientRect();
        if (
          pointer.y >= visible.top &&
          pointer.y <= visible.bottom &&
          pointer.y >= bounds.top &&
          pointer.y < bounds.bottom
        )
          destinationRow = element.dataset.rowLane!;
      }
      trackingTop = pickupTop + pointer.y - pickupY;
    }
    gesture.update(
      weekAt(pointer.x),
      performance.now(),
      pointer.x,
      destinationRow,
      pointer.y - pickupY,
    );
    document = gesture.preview;
    motion = {
      meaningful: gesture.meaningful,
      tracking: gesture.tracking,
      proposal: gesture.proposal,
      validDrop: gesture.validDrop,
    };
    stopPushTimer();
    if (gesture.pushAt !== null) {
      pushTimer = setTimeout(
        () => {
          pushTimer = null;
          updateProposal();
        },
        Math.max(0, Math.ceil(gesture.pushAt - performance.now())),
      );
    }
  }
  function stopPushTimer() {
    if (pushTimer !== null) clearTimeout(pushTimer);
    pushTimer = null;
  }
  function viewportScrolled() {
    visibleScrollTop = viewport.scrollTop;
    if (!gesture && !structural) return;
    if (structural) updateStructure();
    else updateProposal();
    updateScrolling();
  }
  function visibleTimeline() {
    const bounds = viewport.getBoundingClientRect();
    const row = chart
      .querySelector<HTMLElement>('.weeks')!
      .getBoundingClientRect();
    return {
      left: Math.max(row.left, bounds.left + viewport.clientLeft + LABEL_WIDTH),
      right: Math.min(
        row.right,
        bounds.left + viewport.clientLeft + viewport.clientWidth,
      ),
      top: bounds.top + viewport.clientTop,
      bottom: bounds.top + viewport.clientTop + viewport.clientHeight,
    };
  }
  function scrollVelocity() {
    return gesture?.meaningful && pointer
      ? edgeVelocity(pointer, visibleTimeline())
      : 0;
  }
  function scroll(time: number) {
    scrollFrame = null;
    const velocity = scrollVelocity();
    const vertical = verticalVelocity();
    if (velocity === 0 && vertical === 0) return;
    view.firstWeek += (velocity * (time - scrollTime)) / 1000 / weekWidth;
    viewport.scrollTop += (vertical * (time - scrollTime)) / 1000;
    if (structural)
      viewport.scrollTop = Math.min(
        viewport.scrollTop,
        Math.max(0, 54 + layout.height - viewport.clientHeight),
      );
    scrollTime = time;
    // Re-project a stationary pointer after every view change. The transaction
    // still derives collisions and history from its committed pointer-down snapshot.
    if (structural) updateStructure();
    else updateProposal();
    scrollFrame = requestAnimationFrame(scroll);
  }
  function verticalVelocity() {
    if (
      (!structuralMeaningful && (!movingBetweenRows || !gesture?.meaningful)) ||
      !pointer
    )
      return 0;
    const bounds = structural ? structuralBounds() : visibleTimeline();
    const speed = edgeVelocity(
      { x: pointer.y, y: pointer.x },
      {
        left: bounds.top,
        right: bounds.bottom,
        top: bounds.left,
        bottom: bounds.right,
      },
    );
    if (
      (speed < 0 && viewport.scrollTop <= 0) ||
      (speed > 0 &&
        viewport.scrollTop >=
          (structural
            ? Math.max(0, 54 + layout.height - viewport.clientHeight)
            : viewport.scrollHeight - viewport.clientHeight))
    )
      return 0;
    return speed;
  }
  function stopScrolling() {
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
  }
  function releaseCapture() {
    stopScrolling();
    stopPushTimer();
    stopHoverTimer();
    pointer = null;
    const id = pointerId;
    pointerId = null;
    if (id !== null && captureOwner?.hasPointerCapture(id))
      captureOwner.releasePointerCapture(id);
    captureOwner = null;
  }
  function cancel() {
    menu = null;
    if (structural) {
      document = structural.cancel();
      collapsed = structural.originalCollapsed;
      structural = null;
      structuralMeaningful = false;
      releaseCapture();
      return;
    }
    if (!gesture) return;
    document = gesture.cancel();
    gesture = null;
    motion = null;
    releaseCapture();
  }
  async function end(event: PointerEvent) {
    if (structural && event.pointerId === pointerId) {
      const transaction = structural;
      history.commit(transaction.kind, transaction.commit(), transaction.id);
      collapsed = transaction.committedCollapsed();
      structural = null;
      structuralMeaningful = false;
      releaseCapture();
      syncHistory();
      // A simple section click still opens naming; a completed drag suppresses it.
      if (!transaction.meaningful && transaction.kind === 'move-section')
        rename(transaction.id);
      if (!transaction.meaningful && transaction.kind === 'move-row') {
        const time = performance.now();
        if (rowClick?.id === transaction.id && time - rowClick.time < 500) {
          rowClick = null;
          rename(transaction.id);
        } else rowClick = { id: transaction.id, time };
      } else rowClick = null;
      return;
    }
    if (!gesture || event.pointerId !== pointerId) return;
    // Commit the last displayed proposal; pointer-up never computes a different result.
    const transaction = gesture;
    const changed = history.commit(
      transaction.kind,
      transaction.commit(),
      transaction.id,
    );
    gesture = null;
    motion = null;
    releaseCapture();
    syncHistory();
    if (changed) {
      view.selectedId = transaction.id;
      if (transaction.kind === 'draw') {
        await tick();
        rename(transaction.id);
      }
    }
  }
  function rename(id: string) {
    if (busy || view.editingId === id) return;
    const item = [
      ...history.document.sections,
      ...history.document.rows,
      ...history.document.bars,
      ...history.document.milestones,
    ].find((item) => item.id === id);
    if (!item) return;
    finishName(true);
    view.selectedId = id;
    view.editingId = id;
    draft = item.name;
  }
  function revealRow(id: string) {
    const row = layout.rows.find((row) => row.id === id && row.visible);
    if (row) revealAt(row.top + 54, 44);
  }
  function revealElement(element: HTMLElement) {
    const section = layout.sections.find(
      (section) => section.id === element.dataset.sectionHeading,
    );
    if (section) {
      revealAt(section.top + 54, 36);
      return;
    }
    const bounds = element.getBoundingClientRect();
    const visible = viewport.getBoundingClientRect();
    if (bounds.top < visible.top)
      viewport.scrollTop += bounds.top - visible.top;
    else if (bounds.bottom > visible.top + viewport.clientHeight)
      viewport.scrollTop += bounds.bottom - visible.top - viewport.clientHeight;
  }
  function revealAt(top: number, height: number) {
    // Use the destination layout, even while expansion/reordering is animating.
    if (top < viewport.scrollTop) viewport.scrollTop = top;
    else if (top + height > viewport.scrollTop + viewport.clientHeight)
      viewport.scrollTop = top + height - viewport.clientHeight;
  }
  function structuralBounds() {
    const bounds = viewport.getBoundingClientRect();
    return {
      left: bounds.left + viewport.clientLeft,
      right: bounds.left + viewport.clientWidth,
      top: bounds.top + viewport.clientTop,
      bottom: bounds.top + viewport.clientHeight,
    };
  }
  function stopHoverTimer() {
    if (hoverTimer !== null) clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  function startStructure(
    event: PointerEvent,
    kind: StructureKind,
    id: string,
  ) {
    if (event.button !== 0 || busy || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    finishName(true);
    menu = null;
    view.selectedId = id;
    const element = (event.currentTarget as HTMLElement).closest(
      '.row, .section',
    )!;
    const top = chart.getBoundingClientRect().top + 54;
    pointer = { x: event.clientX, y: event.clientY };
    pointerId = event.pointerId;
    structural = new StructureGesture(
      history.document,
      kind,
      id,
      collapsed,
      event.clientY - top,
      element.getBoundingClientRect().top - top,
    );
    structuralTop = structural.trackingTop;
    structuralMeaningful = false;
    // Keyed rows/headings change DOM order during a structural preview. Capture
    // on the stable viewport so that reordering cannot interrupt the transaction.
    captureOwner = viewport;
    captureOwner.setPointerCapture(event.pointerId);
  }
  function updateStructure() {
    if (!structural || !pointer) return;
    structural.update(
      pointer.y - chart.getBoundingClientRect().top - 54,
      performance.now(),
    );
    document = structural.preview;
    collapsed = structural.collapsed;
    structuralTop = structural.trackingTop;
    structuralMeaningful = structural.meaningful;
    stopHoverTimer();
    if (structural.hoverAt !== null)
      hoverTimer = setTimeout(
        () => {
          hoverTimer = null;
          updateStructure();
        },
        Math.max(0, Math.ceil(structural.hoverAt - performance.now())),
      );
  }
  function toggleSection(id: string) {
    if (busy) return;
    finishName(true);
    if (collapsed.includes(id))
      collapsed = collapsed.filter((section) => section !== id);
    else {
      collapsed = [...collapsed, id];
      const selected = [
        ...document.rows,
        ...document.bars,
        ...document.milestones,
      ].find((item) => item.id === view.selectedId);
      const row =
        selected &&
        ('rowId' in selected
          ? document.rows.find((row) => row.id === selected.rowId)
          : selected);
      if (row?.sectionId === id) view.selectedId = null;
    }
  }
  async function addSection(index = document.sections.length) {
    if (busy) return;
    finishName(true);
    menu = null;
    const section = { id: crypto.randomUUID(), name: '' };
    history.commit(
      'add-section',
      insertSection(history.document, section, index),
      section.id,
    );
    syncHistory();
    await tick();
    const element = chart.querySelector<HTMLElement>(
      `[data-section-heading="${section.id}"]`,
    );
    if (element) revealElement(element);
    rename(section.id);
  }
  async function structureMenu(
    event: MouseEvent,
    kind: 'row' | 'section',
    id: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    finishName(true);
    view.selectedId = id;
    menu = {
      x: Math.max(0, Math.min(event.clientX, window.innerWidth - 210)),
      y: Math.max(0, Math.min(event.clientY, window.innerHeight - 195)),
      rowId: id,
      week: 0,
      kind,
      id,
    };
    await tick();
    menuElement.querySelector<HTMLButtonElement>('button')?.focus();
  }
  async function askDelete(id: string) {
    if (busy) return;
    finishName(true);
    menu = null;
    const section = document.sections.find((section) => section.id === id);
    const row = document.rows.find((row) => row.id === id);
    if (!section && !row) return;
    const rows = section ? sectionRows(document, id) : [row!];
    const ids = new Set(rows.map((row) => row.id));
    confirmation = {
      id,
      kind: section ? 'section' : 'row',
      name:
        (section ?? row)!.name || (section ? 'Unnamed section' : 'Unnamed row'),
      rows: rows.length,
      bars: document.bars.filter((bar) => ids.has(bar.rowId)).length,
      milestones: document.milestones.filter((item) => ids.has(item.rowId))
        .length,
    };
    await tick();
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
  }
  function closeConfirmation() {
    dialog.close();
    confirmation = null;
    viewport.focus({ preventScroll: true });
  }
  function confirmDelete() {
    if (!confirmation) return;
    const { id } = confirmation;
    history.commit('delete', deleteContainer(history.document, id), id);
    view.selectedId = null;
    closeConfirmation();
    syncHistory();
  }
  const countLabel = (count: number, noun: string) =>
    `${count} ${noun}${count === 1 ? '' : 's'}`;
  function finishName(commit: boolean) {
    const id = view.editingId;
    if (!id) return;
    view.editingId = null;
    if (commit) {
      const before = history.document;
      history.commit(
        'name',
        {
          ...before,
          sections: before.sections.map((section) =>
            section.id === id ? { ...section, name: draft } : section,
          ),
          bars: before.bars.map((bar) =>
            bar.id === id ? { ...bar, name: draft } : bar,
          ),
          milestones: before.milestones.map((item) =>
            item.id === id ? { ...item, name: draft } : item,
          ),
          rows: before.rows.map((row) =>
            row.id === id ? { ...row, name: draft } : row,
          ),
        },
        id,
      );
      syncHistory();
    }
    viewport?.focus({ preventScroll: true });
  }
  async function travel(direction: 'undo' | 'redo') {
    if (busy) return;
    finishName(true);
    menu = null;
    const command = history[direction]();
    syncHistory();
    if (command) {
      const items = [...document.bars, ...document.milestones];
      view.selectedId = items.some((item) => item.id === command.revealId)
        ? command.revealId
        : null;
      const affectedRow = document.rows.find(
        (row) =>
          row.id === command.revealId ||
          items.some(
            (item) => item.id === command.revealId && item.rowId === row.id,
          ),
      );
      const sectionId =
        affectedRow?.sectionId ??
        document.sections.find((section) => section.id === command.revealId)
          ?.id;
      if (sectionId) collapsed = collapsed.filter((id) => id !== sectionId);
      await tick();
      const item = items.find((item) => item.id === command.revealId);
      if (item) {
        const bar =
          'boundary' in item
            ? { start: item.boundary - 1, end: item.boundary }
            : item;
        const bounds = visibleTimeline();
        const left = weekAt(bounds.left);
        const right = weekAt(bounds.right);
        if (bar.start < left) view.firstWeek += bar.start - left;
        else if (bar.end > right)
          view.firstWeek += Math.min(bar.end - right, bar.start - left);
        revealRow(item.rowId);
      } else {
        if (
          document.sections.some((section) => section.id === command.revealId)
        ) {
          const element = chart.querySelector<HTMLElement>(
            `[data-section-heading="${command.revealId}"]`,
          );
          if (element) revealElement(element);
        } else revealRow(command.revealId);
      }
    }
  }
  function keydown(event: KeyboardEvent) {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    )
      return;
    if (event.key === 'Escape') {
      if (menu) {
        menu = null;
        viewport.focus({ preventScroll: true });
      }
      cancel();
      return;
    }
    if (busy) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      void travel(event.shiftKey ? 'redo' : 'undo');
    } else if (event.ctrlKey && key === 'y') {
      event.preventDefault();
      void travel('redo');
    } else if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      view.selectedId
    ) {
      event.preventDefault();
      const id = view.selectedId;
      if (
        document.rows.some((row) => row.id === id) ||
        document.sections.some((section) => section.id === id)
      ) {
        void askDelete(id);
        return;
      }
      history.commit(
        'delete',
        {
          ...document,
          bars: document.bars.filter((bar) => bar.id !== id),
          milestones: document.milestones.filter((item) => item.id !== id),
        },
        id,
      );
      view.selectedId = null;
      syncHistory();
    }
  }
  function backgroundPress(event: PointerEvent) {
    if (
      event.button !== 0 ||
      busy ||
      !(event.target instanceof Element) ||
      event.target.closest('.bar, .milestone, .context-menu, input, button')
    )
      return;
    finishName(true);
    menu = null;
    view.selectedId = null;
  }

  async function addRow(
    sectionId = document.sections[0]?.id,
    index = sectionRows(document, sectionId).length,
  ) {
    if (busy || !sectionId) return;
    finishName(true);
    menu = null;
    collapsed = collapsed.filter((id) => id !== sectionId);
    const row = { id: crypto.randomUUID(), sectionId, name: '' };
    history.commit('add-row', insertRow(history.document, row, index), row.id);
    syncHistory();
    await tick();
    revealRow(row.id);
    rename(row.id);
  }
  async function createMilestone(rowId: string, week: number) {
    if (busy) return;
    finishName(true);
    menu = null;
    const item = {
      id: crypto.randomUUID(),
      rowId,
      boundary: week + 1,
      name: '',
    };
    const changed = history.commit(
      'milestone',
      placeMilestone(history.document, item),
      item.id,
    );
    syncHistory();
    if (changed) {
      notice = '';
      await tick();
      rename(item.id);
    } else
      notice = 'A milestone already marks the end of this week in this row.';
  }
  async function menuBar() {
    if (!menu) return;
    const { rowId, week } = menu;
    menu = null;
    const bar = {
      id: crypto.randomUUID(),
      rowId,
      start: week,
      end: week + 1,
      name: '',
    };
    history.commit('draw', placeBar(history.document, bar, 'right'), bar.id);
    syncHistory();
    await tick();
    rename(bar.id);
  }
  async function openMenu(event: MouseEvent, rowId: string) {
    event.preventDefault();
    if (busy || (event.target as Element).closest('.bar, .milestone')) return;
    finishName(true);
    view.selectedId = null;
    menu = {
      x: Math.max(0, Math.min(event.clientX, window.innerWidth - 210)),
      y: Math.max(0, Math.min(event.clientY, window.innerHeight - 105)),
      rowId,
      kind: 'lane',
      id: rowId,
      week: Math.floor(weekAt(event.clientX)),
    };
    await tick();
    menuElement.querySelector<HTMLButtonElement>('button')?.focus();
  }
</script>

<svelte:window
  onkeydown={keydown}
  onblur={cancel}
  onpointerdown={(event) => {
    if (menu && !menuElement.contains(event.target as Node)) menu = null;
  }}
/>

{#snippet nameInput(kind: 'Row' | 'Section')}
  <input
    aria-label={`${kind} name`}
    value={draft}
    use:focusName
    oninput={(event) => (draft = event.currentTarget.value)}
    onblur={() => finishName(true)}
    onkeydown={(event) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finishName(event.key === 'Enter');
      }
    }}
  />
{/snippet}

<main class="shell">
  <header>
    <div class="brand" aria-label="Takt">
      <span class="mark" aria-hidden="true"><i></i><i></i><i></i></span
      >Takt<span class="dot">.</span>
    </div>
    <div class="toolbar" aria-label="Editor controls">
      <div class="history">
        <IconButton
          label="Undo"
          disabled={!canUndo || busy}
          onclick={() => void travel('undo')}
        />
        <IconButton
          label="Redo"
          redo
          disabled={!canRedo || busy}
          onclick={() => void travel('redo')}
        />
      </div>
      <span class="divider"></span><span class="mode">Weeks</span>
    </div>
  </header>
  <!-- The scroll region is focusable so keyboard users can scroll its overflow. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="viewport"
    bind:this={viewport}
    role="region"
    aria-label="Whole-week Gantt chart"
    tabindex="0"
    onpointerdown={backgroundPress}
    onscroll={viewportScrolled}
    onpointermove={move}
    onpointerup={end}
    onpointercancel={cancel}
    onlostpointercapture={() => {
      if (pointerId !== null) cancel();
    }}
    style:--labels={`${LABEL_WIDTH}px`}
  >
    <div
      class="chart"
      bind:this={chart}
      style:height={`${54 + layout.height}px`}
    >
      <div class="chart-header">
        <div class="lane-heading">Sections &amp; rows</div>
        <div class="weeks" bind:clientWidth={laneWidth}>
          {#each weeks as week}<div
              class="week"
              style:left={`${(week - view.firstWeek) * weekWidth}px`}
              style:width={`${weekWidth}px`}
            >
              Week {week < 0 ? `−${-week}` : week}
            </div>{/each}
        </div>
      </div>
      {#each renderedSections as section (section.id)}
        <div
          class="section"
          class:carried={structural?.id === section.id && structuralMeaningful}
          data-section-heading={section.id}
          data-testid={`section-${section.id}`}
          style:top={`${54 + structureTop(section.id, section.top)}px`}
          oncontextmenu={(event) =>
            void structureMenu(event, 'section', section.id)}
          role="group"
          aria-label={section.name || 'Unnamed section'}
        >
          <div class="section-label">
            <button
              class="collapse"
              aria-label={`${collapsed.includes(section.id) ? 'Expand' : 'Collapse'} ${section.name || 'Unnamed section'}`}
              aria-expanded={!collapsed.includes(section.id)}
              onclick={() => toggleSection(section.id)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="m6 4 4 4-4 4" />
              </svg>
            </button>
            <span class="section-color"></span>
            {#if view.editingId === section.id}
              {@render nameInput('Section')}
            {:else}
              <button
                class="section-name"
                onpointerdown={(event) =>
                  startStructure(event, 'move-section', section.id)}
                onclick={(event) => {
                  if (event.detail === 0) rename(section.id);
                }}>{section.name || 'Unnamed section'}</button
              >
            {/if}
            <span class="count"
              >{String(section.rows.length).padStart(2, '0')}</span
            >
          </div>
          <div></div>
        </div>
        <div
          class="add-row-line"
          style:top={`${54 + structureTop(section.id, section.addTop)}px`}
          class:carried={structural?.id === section.id && structuralMeaningful}
        >
          <button
            class="add-row"
            aria-label={`Add row to ${section.name || 'Unnamed section'}`}
            onclick={() => void addRow(section.id)}>+ Add row</button
          >
        </div>
      {/each}
      {#each renderedRows as row (row.id)}
        <div
          class="row"
          class:carried={carriesRow(row.id)}
          class:hidden={!rowVisible(row.id)}
          style:top={`${54 + structureTop(row.id, row.top)}px`}
          data-testid={`row-${row.id}`}
          data-section={row.sectionId}
        >
          <div
            class="row-label"
            oncontextmenu={(event) => void structureMenu(event, 'row', row.id)}
            role="group"
            aria-label={row.name || 'Unnamed row'}
          >
            {#if view.editingId === row.id}
              {@render nameInput('Row')}
            {:else}
              <button
                class="row-name"
                onpointerdown={(event) =>
                  startStructure(event, 'move-row', row.id)}
                ondblclick={() => rename(row.id)}
                >{row.name || 'Unnamed row'}</button
              >
            {/if}
          </div>
          <div
            class="lane"
            style:--week={`${weekWidth}px`}
            style:background-position-x={`${timelineShift}px`}
            role="region"
            aria-label={`Timeline row ${layout.rows.findIndex((candidate) => candidate.id === row.id) + 1}`}
            tabindex="-1"
            data-testid="lane"
            data-row-lane={row.id}
            data-first-week={view.firstWeek}
            onpointerdown={(event) =>
              start(event, 'draw', crypto.randomUUID(), row.id)}
            ondblclick={(event) => {
              if (!(event.target as Element).closest('.bar, .milestone'))
                void createMilestone(row.id, Math.floor(weekAt(event.clientX)));
            }}
            oncontextmenu={(event) => void openMenu(event, row.id)}
          >
            {#if empty && row.id === hintRow}<span class="hint"
                >Drag to create a bar · Double-click for a milestone.</span
              >{/if}
            <div
              class="timeline-content"
              style:transform={`translateX(${timelineShift}px)`}
            >
              {#if gesture && motion?.meaningful && motion.proposal?.rowId === row.id}
                {@const proposal = motion.proposal}
                <div
                  class="snap-preview"
                  class:invalid={!motion.validDrop}
                  class:milestone-preview={gesture.kind === 'milestone-move'}
                  data-testid="snap-preview"
                  data-start={proposal.start}
                  data-end={proposal.end}
                  data-row={proposal.rowId}
                  data-valid={motion.validDrop}
                  style:left={`${(proposal.start - FIRST_WEEK) * weekWidth + (gesture.kind === 'milestone-move' ? -7 : BAR_INSET)}px`}
                  style:width={`${gesture.kind === 'milestone-move' ? 14 : (proposal.end - proposal.start) * weekWidth - BAR_INSET * 2}px`}
                ></div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
      <div
        class="items"
        style:width={`${laneWidth}px`}
        style:height={`${structural ? Math.max(layout.height, structuralTop + 200) : layout.height}px`}
      >
        <div
          class="timeline-content"
          style:transform={`translateX(${timelineShift}px)`}
        >
          {#each shown.bars as bar (bar.id)}
            <Bar
              bar={gesture?.id === bar.id && motion?.proposal
                ? { ...bar, ...motion.proposal }
                : bar}
              {weekWidth}
              visible={rowVisible(bar.rowId)}
              carried={carriesRow(bar.rowId)}
              top={gesture?.id === bar.id && movingBetweenRows
                ? trackingTop
                : rowTop(bar.rowId)}
              selected={view.selectedId === bar.id || gesture?.id === bar.id}
              invalid={gesture?.id === bar.id && motion?.validDrop === false}
              editing={view.editingId === bar.id}
              {draft}
              tracking={motion &&
              gesture?.id === bar.id &&
              (gesture.kind !== 'draw' || motion.meaningful)
                ? motion.tracking
                : undefined}
              onstart={start}
              onrename={rename}
              ondraft={(value) => (draft = value)}
              onfinish={finishName}
            />
          {/each}
          {#each shown.milestones as item (item.id)}
            <Milestone
              item={gesture?.id === item.id && motion?.proposal
                ? {
                    ...item,
                    boundary: motion.proposal.start,
                    rowId: motion.proposal.rowId,
                  }
                : item}
              {weekWidth}
              visible={rowVisible(item.rowId)}
              carried={carriesRow(item.rowId)}
              top={gesture?.id === item.id ? trackingTop : rowTop(item.rowId)}
              tracking={gesture?.id === item.id
                ? motion?.tracking.start
                : undefined}
              selected={view.selectedId === item.id || gesture?.id === item.id}
              invalid={gesture?.id === item.id && motion?.validDrop === false}
              editing={view.editingId === item.id}
              {draft}
              onstart={start}
              onrename={rename}
              ondraft={(value) => (draft = value)}
              onfinish={finishName}
            />
          {/each}
        </div>
      </div>
      <div class="add-section-line" style:top={`${54 + layout.height - 36}px`}>
        <button
          class="add-row"
          aria-label="Add section"
          onclick={() => void addSection()}>+ Add section</button
        >
      </div>
    </div>
  </div>
  {#if menu}
    <div
      class="context-menu"
      bind:this={menuElement}
      role="menu"
      tabindex="-1"
      style:left={`${menu.x}px`}
      style:top={`${menu.y}px`}
      onkeydown={(event) => {
        const buttons = [
          ...menuElement.querySelectorAll<HTMLButtonElement>('button'),
        ];
        const index = buttons.indexOf(
          window.document.activeElement as HTMLButtonElement,
        );
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          buttons[
            (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
              buttons.length
          ].focus();
        } else if (event.key === 'Tab') menu = null;
      }}
    >
      {#if menu.kind === 'lane'}
        <small>Week {menu.week}</small>
        <button role="menuitem" onclick={() => void menuBar()}
          >Add bar here</button
        >
        <button
          role="menuitem"
          onclick={() => {
            if (menu) void createMilestone(menu.rowId, menu.week);
          }}>Add milestone here</button
        >
      {:else if menu.kind === 'section'}
        <button
          role="menuitem"
          onclick={() => {
            if (menu) void addRow(menu.id);
          }}>Add row</button
        >
        <button
          role="menuitem"
          onclick={() => {
            if (menu)
              void addSection(
                document.sections.findIndex(
                  (section) => section.id === menu!.id,
                ) + 1,
              );
          }}>Add section</button
        >
        <button
          role="menuitem"
          onclick={() => {
            const id = menu!.id;
            menu = null;
            rename(id);
          }}>Rename</button
        >
        <button
          role="menuitem"
          onclick={() => {
            if (menu) void askDelete(menu.id);
          }}>Delete section…</button
        >
      {:else}
        <button
          role="menuitem"
          onclick={() => {
            const row = document.rows.find((row) => row.id === menu!.id)!;
            void addRow(
              row.sectionId,
              sectionRows(document, row.sectionId).findIndex(
                (item) => item.id === row.id,
              ),
            );
          }}>Insert row above</button
        >
        <button
          role="menuitem"
          onclick={() => {
            const row = document.rows.find((row) => row.id === menu!.id)!;
            void addRow(
              row.sectionId,
              sectionRows(document, row.sectionId).findIndex(
                (item) => item.id === row.id,
              ) + 1,
            );
          }}>Insert row below</button
        >
        <button
          role="menuitem"
          onclick={() => {
            const id = menu!.id;
            menu = null;
            rename(id);
          }}>Rename</button
        >
        <button
          role="menuitem"
          onclick={() => {
            if (menu) void askDelete(menu.id);
          }}>Delete row…</button
        >
      {/if}
    </div>
  {/if}
  {#if confirmation}
    <dialog
      bind:this={dialog}
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      oncancel={(event) => {
        event.preventDefault();
        closeConfirmation();
      }}
    >
      <h2 id="delete-title">Delete “{confirmation.name}”?</h2>
      <p id="delete-description">
        This removes {confirmation.kind === 'section'
          ? `${countLabel(confirmation.rows, 'row')}, `
          : ''}{countLabel(confirmation.bars, 'bar')} and {countLabel(
          confirmation.milestones,
          'milestone',
        )}{confirmation.kind === 'section'
          ? ' in this section'
          : ' in this row'}. You can undo this action.
      </p>
      <div class="dialog-actions">
        <button onclick={closeConfirmation}>Cancel</button><button
          class="danger"
          onclick={confirmDelete}>Delete {confirmation.kind}</button
        >
      </div>
    </dialog>
  {/if}
  <span class="notice" role="status">{notice}</span>
  <footer>
    Drag bars to move · Drag ends to resize · Double-click to rename<span
      >Esc cancels · Ctrl / Cmd + Z undoes</span
    >
  </footer>
</main>

<style>
  .shell {
    padding: 0 34px 26px;
  }
  header {
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -1px;
  }
  .dot {
    color: var(--accent);
    margin-left: -10px;
  }
  .mark {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    width: 23px;
    height: 23px;
  }
  .mark i {
    width: 5px;
    background: var(--accent);
    border-radius: 1px;
    height: 13px;
  }
  .mark i:nth-child(2) {
    height: 22px;
  }
  .mark i:nth-child(3) {
    height: 17px;
  }
  .toolbar,
  .history {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .toolbar {
    gap: 13px;
  }
  .divider {
    width: 1px;
    height: 20px;
    background: var(--line);
  }
  .mode {
    font-size: 13px;
    font-weight: 600;
    padding: 7px 11px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .viewport {
    outline: none;
    overflow: auto;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    min-height: 470px;
    height: 470px;
  }
  .chart {
    position: relative;
    min-width: 1120px;
    transition: height var(--settlement) ease-out;
  }
  .chart-header,
  .section,
  .row {
    display: grid;
    grid-template-columns: var(--labels) minmax(0, 1fr);
  }
  .lane-heading,
  .section-label,
  .row-label {
    position: sticky;
    left: 0;
    z-index: 5;
    background: var(--surface);
  }
  .chart-header {
    height: 54px;
    border-bottom: 1px solid var(--line);
  }
  .lane-heading {
    display: flex;
    align-items: center;
    padding: 0 22px;
    border-right: 1px solid var(--line);
    font-size: 11px;
    letter-spacing: 1.1px;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--muted);
  }
  .weeks {
    position: relative;
    overflow: clip;
  }
  .week {
    position: absolute;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid var(--grid);
    font-size: 13px;
    color: var(--row-ink);
    font-weight: 500;
  }
  .section {
    position: absolute;
    width: 100%;
    transition: top var(--settlement) ease-out;
    height: 36px;
    background: var(--section-bg);
    border-bottom: 1px solid var(--line);
  }
  .section-label {
    background: var(--section-bg);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 22px;
    font-size: 13px;
    font-weight: 650;
  }
  .section-color {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--bar-ink);
  }
  .count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 400;
    color: var(--muted);
  }
  .row {
    position: absolute;
    width: 100%;
    transition:
      top var(--settlement) ease-out,
      height var(--settlement) ease-out,
      opacity var(--settlement) ease-out;
    height: 44px;
    border-bottom: 1px solid var(--grid);
  }
  .row-label {
    display: flex;
    align-items: center;
    padding: 0 22px;
    border-right: 1px solid var(--line);
    font-size: 14px;
    font-weight: 500;
    color: var(--row-ink);
  }
  .lane {
    outline: none;
    position: relative;
    overflow: clip;
    touch-action: none;
    user-select: none;
    background: repeating-linear-gradient(
      to right,
      transparent 0 calc(var(--week) - 1px),
      var(--grid) calc(var(--week) - 1px) var(--week)
    );
  }
  .hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    font-size: 14px;
    color: var(--muted);
  }
  .timeline-content {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .timeline-content :global(.bar) {
    pointer-events: auto;
  }
  .timeline-content :global(.milestone) {
    pointer-events: auto;
  }
  .items {
    position: absolute;
    left: var(--labels);
    top: 54px;
    overflow: clip;
    pointer-events: none;
  }
  .row-name,
  .section-name {
    outline: none;
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .section-name {
    flex: 1;
    align-self: stretch;
    min-width: 0;
    text-align: left;
  }
  .section-label input {
    flex: 1;
    min-width: 0;
  }
  .row-label input,
  .section-label input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .row-name:focus-visible,
  .section-name:focus-visible {
    outline: none;
  }
  .add-row-line,
  .add-section-line {
    position: absolute;
    width: 100%;
    height: 36px;
    transition: top var(--settlement) ease-out;
  }
  .add-section-line {
    border-top: 1px solid var(--line);
  }
  .row.hidden {
    height: 0;
    opacity: 0;
    overflow: clip;
    pointer-events: none;
    visibility: hidden;
  }
  .row.carried,
  .section.carried,
  .add-row-line.carried {
    transition: none;
    z-index: 6;
    box-shadow: 0 4px 12px #182e471a;
  }
  .row.carried {
    /* Keep timeline items above the carried grid, with the label pinned
       above the clipped timeline overlay. */
    z-index: auto;
    background: var(--surface);
  }
  .row.carried .row-label {
    z-index: 6;
  }
  .add-row-line.carried {
    background: var(--surface);
  }
  .row-name,
  .section-name {
    touch-action: none;
    user-select: none;
  }
  .collapse {
    border: 0;
    background: none;
    border-radius: 4px;
    color: var(--muted);
    padding: 0;
    width: 20px;
    height: 24px;
    margin-inline: -4px;
    flex: none;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .collapse:hover {
    color: var(--row-ink);
  }
  .collapse:focus-visible {
    outline: 1px solid var(--muted);
    outline-offset: 1px;
  }
  .collapse svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform var(--settlement) ease-out;
  }
  .collapse[aria-expanded='true'] svg {
    transform: rotate(90deg);
  }
  .section-label {
    padding-left: 8px;
    gap: 6px;
  }
  dialog {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 24px;
    max-width: 400px;
    color: var(--row-ink);
    background: var(--surface);
    box-shadow: 0 12px 40px #182e4725;
  }
  dialog::backdrop {
    background: #182e4730;
  }
  dialog h2 {
    font-size: 17px;
    margin: 0 0 12px;
  }
  dialog p {
    font-size: 13px;
    line-height: 1.6;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
  .dialog-actions button {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: var(--radius);
    padding: 7px 12px;
    cursor: pointer;
  }
  .dialog-actions .danger {
    background: #a23e42;
    color: white;
    border-color: #a23e42;
  }
  .add-row {
    position: sticky;
    left: 22px;
    margin: 7px 22px;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
  }
  .snap-preview.milestone-preview {
    height: 14px;
    top: 15px;
    transform: rotate(45deg);
    border-radius: 0;
  }
  .context-menu {
    position: fixed;
    z-index: 20;
    width: 210px;
    padding: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px #182e471a;
  }
  .context-menu small {
    display: block;
    color: var(--muted);
    padding: 4px 8px;
  }
  .context-menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 7px 8px;
    border: 0;
    border-radius: 3px;
    background: none;
    cursor: pointer;
  }
  .context-menu button:hover,
  .context-menu button:focus {
    background: var(--soft);
  }
  .notice {
    position: fixed;
    bottom: 8px;
    left: 34px;
    font-size: 12px;
    color: #a23e42;
  }
  .snap-preview {
    position: absolute;
    height: 34px;
    top: 5px;
    border: 1px dashed var(--bar-ink);
    background: #f3b18430;
    border-radius: var(--bar-radius);
    pointer-events: none;
  }
  .snap-preview.invalid {
    border-color: #a23e42;
    background: #a23e4220;
  }
  footer {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.5;
    padding-top: 13px;
  }
</style>
