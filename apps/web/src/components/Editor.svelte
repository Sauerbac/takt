<script lang="ts">
  import { onDestroy, onMount, tick, untrack, type Snippet } from 'svelte';
  import type { ProjectView } from '../project/format';
  import taktMark from '../assets/takt-mark.svg';
  import { emptyDocument } from '../model/document';
  import type { ChartDocument, Color } from '../model/document';
  import {
    dateAt,
    weekLabel,
    barTiming,
    milestoneTiming,
    relativeWeekLabel,
  } from '../model/calendar';
  import {
    colorAppearance,
    DEFAULT_COLOR,
    documentColors,
    colorLabelInk,
    itemColor,
    recolor,
  } from '../model/colors';
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
    barInset,
    edgeVelocity,
    LABEL_WIDTH,
    clampZoom,
    zoomFirstWeek,
    historyLocation,
    OVERVIEW_ZOOM_DURATION,
    BAR_LABEL_WIDTH,
  } from '../viewport';
  import IconButton from './IconButton.svelte';
  import Bar from './Bar.svelte';
  import Milestone from './Milestone.svelte';
  import CalendarPicker from './CalendarPicker.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import MenuItem from './MenuItem.svelte';
  import {
    calendarBands,
    relativeBands,
    headingStride,
    weekGridPath,
  } from '../timeline-headings';

  let {
    initial = emptyDocument(),
    initialView,
    onchange,
    fileControls,
    fileMenuControls,
    onhome,
  }: {
    initial?: ChartDocument;
    initialView?: ProjectView;
    onchange?: (document: ChartDocument, view: ProjectView) => void;
    fileControls?: Snippet;
    fileMenuControls?: Snippet;
    onhome?: () => void;
  } = $props();
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
  // svelte-ignore state_referenced_locally
  let view = $state({
    ...initialViewport(),
    ...(initialView
      ? { zoom: initialView.zoom, firstWeek: initialView.firstWeek }
      : {}),
  });
  let calendarPicker = $state<{
    week: number;
    date: string;
  } | null>(null);
  let colorPicker = $state<{ id: string; color: Color; name: string } | null>(
    null,
  );
  let calendarTrigger: HTMLElement | null = null;
  let spaceHeld = $state(false);
  let changingScale = $state(false);
  let scaleFrame: number | null = null;
  let zoomFrame: number | null = null;
  let zooming = $state(false);
  let pan = $state.raw<{
    x: number;
    y: number;
    firstWeek: number;
    scrollTop: number;
  } | null>(null);
  let gesture = $state.raw<Gesture | MilestoneGesture | null>(null);
  let motion = $state<{
    meaningful: boolean;
    tracking: { start: number; end: number };
    proposal: { start: number; end: number; rowId: string } | null;
    validDrop: boolean;
  } | null>(null);
  let draft = $state('');
  let structural = $state.raw<StructureGesture | null>(null);
  // svelte-ignore state_referenced_locally
  let collapsed = $state<readonly string[]>(
    initialView?.collapsedSectionIds ?? [],
  );
  let structuralTop = $state(0);
  let structuralMeaningful = $state(false);
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let rowClick: { id: string; time: number } | null = null;
  let structureFromGrip = false;
  let confirmation = $state<{
    id: string;
    kind: 'row' | 'section';
    name: string;
    rows: number;
    bars: number;
    milestones: number;
  } | null>(null);
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
  let visibleScrollLeft = $state(0);
  let menu = $state<{
    x: number;
    y: number;
    rowId: string;
    week: number;
    kind: 'lane' | 'row' | 'section' | 'bar' | 'milestone' | 'calendar';
    id: string;
  } | null>(null);
  let menuElement = $state<HTMLDivElement>(null!);
  let menuUsingKeyboard = false;
  let menuDraft = $state('');
  let menuNameEditing = false;
  const menuName = $derived(
    menu
      ? menu.kind === 'lane' || menu.kind === 'calendar'
        ? weekLabel(document, menu.week)
        : [
            ...document.sections,
            ...document.rows,
            ...document.bars,
            ...document.milestones,
          ].find((item) => item.id === menu!.id)?.name || `Unnamed ${menu.kind}`
      : '',
  );
  let notice = $state('');
  const weekWidth = $derived((Math.max(1, laneWidth) / WEEK_COUNT) * view.zoom);
  const inset = $derived(barInset(weekWidth));
  const compactDates = $derived(
    document.display === 'dates' && !!document.calendar && weekWidth < 60,
  );
  const compactWeeks = $derived(document.display !== 'dates' && weekWidth < 60);
  const monthHeadings = $derived(compactDates || compactWeeks);
  const stride = $derived(headingStride(weekWidth));
  const paletteColors = $derived(documentColors(document));
  const months = $derived(
    compactWeeks
      ? relativeBands(view.firstWeek, laneWidth / weekWidth, 'month')
      : document.calendar
        ? calendarBands(
            document.calendar,
            view.firstWeek,
            laneWidth / weekWidth,
            'month',
          )
        : [],
  );
  const years = $derived(
    document.display !== 'dates'
      ? relativeBands(view.firstWeek, laneWidth / weekWidth, 'year')
      : document.calendar
        ? calendarBands(
            document.calendar,
            view.firstWeek,
            laneWidth / weekWidth,
            'year',
          )
        : [],
  );
  const timelineShift = $derived((FIRST_WEEK - view.firstWeek) * weekWidth);
  const gridPath = $derived(weekGridPath(view.firstWeek, weekWidth, laneWidth));
  const weeks = $derived(
    Array.from(
      { length: Math.ceil(WEEK_COUNT / view.zoom) + 2 },
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
    layout.rows.find((row) => row.visible && row.top + 44 > visibleScrollTop)
      ?.id,
  );
  const busy = $derived(
    !!gesture ||
      !!structural ||
      !!confirmation ||
      !!pan ||
      !!calendarPicker ||
      !!colorPicker ||
      zooming,
  );
  const menuColor = $derived(
    menu
      ? menu.kind === 'section'
        ? (document.sections.find((section) => section.id === menu!.id)
            ?.color ?? DEFAULT_COLOR)
        : [...document.bars, ...document.milestones].find(
            (item) => item.id === menu!.id,
          )?.color
      : undefined,
  );
  const menuEffectiveColor = $derived.by(() => {
    const item = [...document.bars, ...document.milestones].find(
      (item) => item.id === menu?.id,
    );
    return item ? itemColor(document, item) : (menuColor ?? DEFAULT_COLOR);
  });
  const proposalColor = $derived.by(() => {
    const item = [...shown.bars, ...shown.milestones].find(
      (item) => item.id === gesture?.id,
    );
    return colorAppearance(
      itemColor(shown, {
        rowId: motion?.proposal?.rowId ?? item?.rowId ?? '',
        color: item?.color,
      }),
    );
  });
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
    stopZoomAnimation();
    stopScrolling();
    stopPushTimer();
    stopHoverTimer();
    if (scaleFrame !== null) cancelAnimationFrame(scaleFrame);
  });
  onMount(() => {
    if (initialView && viewport) viewport.scrollTop = initialView.scrollTop;
  });
  const projectView = (): ProjectView => ({
    zoom: view.zoom,
    firstWeek: view.firstWeek + (viewport?.scrollLeft ?? 0) / weekWidth,
    scrollTop: viewport?.scrollTop ?? 0,
    collapsedSectionIds: (structural?.originalCollapsed ?? collapsed).filter(
      (id) => history.document.sections.some((section) => section.id === id),
    ),
  });
  $effect(() => {
    const committed = history.document;
    // document is also a preview: observe it, but publish only committed history.
    void document;
    void visibleScrollTop;
    void visibleScrollLeft;
    void collapsed;
    void view.zoom;
    void view.firstWeek;
    const savedView = projectView();
    untrack(() => onchange?.(committed, savedView));
  });
  export function prepareFile() {
    finishMenuName(true);
    finishName(true);
    cancel();
    calendarPicker = null;
    colorPicker = null;
    confirmation = null;
    return { document: history.document, view: projectView() };
  }

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
    surface = event.currentTarget as HTMLElement,
  ) {
    if (spaceHeld) {
      startPan(event);
      return;
    }
    const pressedBar = surface.closest('.bar, .milestone');
    if (zooming && pressedBar?.classList.contains('editing'))
      stopZoomAnimation();
    if (event.button !== 0 || busy || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    menu = null;
    notice = '';
    if (
      kind === 'move' &&
      pressedBar?.classList.contains('compact') &&
      !pressedBar.classList.contains('editing')
    ) {
      finishName(true);
      view.selectedId = id;
      viewport.focus({ preventScroll: true });
      animateZoom(2, event.clientX);
      return;
    }
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
    viewport.focus({ preventScroll: true });
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
    captureOwner = surface;
    captureOwner.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (pan && event.pointerId === pointerId) {
      view.firstWeek = pan.firstWeek - (event.clientX - pan.x) / weekWidth;
      viewport.scrollTop = pan.scrollTop - (event.clientY - pan.y);
      return;
    }
    if ((!gesture && !structural) || event.pointerId !== pointerId) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (structural) updateStructure();
    else updateProposal();
    updateScrolling();
  }
  function startNameDrag(
    down: PointerEvent,
    movement: PointerEvent,
    surface: HTMLElement,
    id: string,
  ) {
    stopZoomAnimation();
    start(down, 'move', id, undefined, surface);
    move(movement);
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
    visibleScrollLeft = viewport.scrollLeft;
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
      top: bounds.top + viewport.clientTop + 54,
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
    stopZoomAnimation();
    menu = null;
    spaceHeld = false;
    if (pan) {
      pan = null;
      releaseCapture();
      return;
    }
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
    if (pan && event.pointerId === pointerId) {
      pan = null;
      releaseCapture();
      return;
    }
    if (structural && event.pointerId === pointerId) {
      const transaction = structural;
      history.commit(transaction.kind, transaction.commit(), transaction.id);
      collapsed = transaction.committedCollapsed();
      structural = null;
      structuralMeaningful = false;
      releaseCapture();
      syncHistory();
      // A simple section click still opens naming; a completed drag suppresses it.
      if (
        !structureFromGrip &&
        !transaction.meaningful &&
        transaction.kind === 'move-section'
      )
        rename(transaction.id);
      if (
        !structureFromGrip &&
        !transaction.meaningful &&
        transaction.kind === 'move-row'
      ) {
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
    if ((busy && !zooming) || view.editingId === id) return;
    stopZoomAnimation();
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
    const bar = history.document.bars.find((bar) => bar.id === id);
    if (
      bar &&
      (bar.end - bar.start) * weekWidth - inset * 2 < BAR_LABEL_WIDTH
    ) {
      const week = (bar.start + bar.end) / 2;
      const clientX =
        chart.getBoundingClientRect().left +
        LABEL_WIDTH +
        (week - view.firstWeek) * weekWidth;
      const bounds = visibleTimeline();
      const finalWidth =
        (bar.end - bar.start) * (laneWidth / WEEK_COUNT) * 2 - 10;
      const margin = Math.min(
        finalWidth / 2 + 8,
        (bounds.right - bounds.left) / 2,
      );
      const targetX = Math.max(
        bounds.left + margin,
        Math.min(bounds.right - margin, clientX),
      );
      animateZoom(2, targetX, { week, clientX });
    }
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
    if (bounds.top < visible.top + 54)
      viewport.scrollTop += bounds.top - visible.top - 54;
    else if (bounds.bottom > visible.top + viewport.clientHeight)
      viewport.scrollTop += bounds.bottom - visible.top - viewport.clientHeight;
  }
  function revealAt(top: number, height: number) {
    // Use the destination layout, even while expansion/reordering is animating.
    if (top < viewport.scrollTop + 54) viewport.scrollTop = top - 54;
    else if (top + height > viewport.scrollTop + viewport.clientHeight)
      viewport.scrollTop = top + height - viewport.clientHeight;
  }
  function structuralBounds() {
    const bounds = viewport.getBoundingClientRect();
    return {
      left: bounds.left + viewport.clientLeft,
      right: bounds.left + viewport.clientWidth,
      top: bounds.top + viewport.clientTop + 54,
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
    if (spaceHeld) {
      startPan(event);
      return;
    }
    if (event.button !== 0 || busy || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    finishName(true);
    menu = null;
    view.selectedId = id;
    structureFromGrip = (event.currentTarget as HTMLElement).classList.contains(
      'drag-grip',
    );
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
    if ((event.target as Element).closest('input')) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    finishName(true);
    view.selectedId = id;
    menu = {
      x: event.clientX,
      y: event.clientY,
      rowId: id,
      week: 0,
      kind,
      id,
    };
    await focusMenu();
  }
  async function focusMenu() {
    await tick();
    if (!menu) return;
    const bounds = menuElement.getBoundingClientRect();
    menu = {
      ...menu,
      x: Math.max(8, Math.min(menu.x, window.innerWidth - bounds.width - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - bounds.height - 8)),
    };
    await tick();
    menuUsingKeyboard = false;
    menuElement.focus({ preventScroll: true });
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
  }
  function closeConfirmation() {
    confirmation = null;
    void tick().then(() => viewport.focus({ preventScroll: true }));
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
      saveName(id, draft);
    }
    viewport?.focus({ preventScroll: true });
  }
  function saveName(id: string, name: string) {
    const before = history.document;
    history.commit(
      'name',
      {
        ...before,
        sections: before.sections.map((section) =>
          section.id === id ? { ...section, name } : section,
        ),
        bars: before.bars.map((bar) =>
          bar.id === id ? { ...bar, name } : bar,
        ),
        milestones: before.milestones.map((item) =>
          item.id === id ? { ...item, name } : item,
        ),
        rows: before.rows.map((row) =>
          row.id === id ? { ...row, name } : row,
        ),
      },
      id,
    );
    syncHistory();
  }
  async function travel(direction: 'undo' | 'redo') {
    if (busy) return;
    finishName(true);
    menu = null;
    const command = history[direction]();
    syncHistory();
    if (command) {
      const { selectedId, rowId, sectionId, interval } = historyLocation(
        document,
        command,
      );
      view.selectedId = selectedId;
      if (sectionId) collapsed = collapsed.filter((id) => id !== sectionId);
      await tick();
      if (interval) {
        const bounds = visibleTimeline();
        const left = weekAt(bounds.left);
        const right = weekAt(bounds.right);
        if (interval.start < left) view.firstWeek += interval.start - left;
        else if (interval.end > right)
          view.firstWeek += Math.min(
            interval.end - right,
            interval.start - left,
          );
      }
      if (rowId) revealRow(rowId);
      else if (sectionId) {
        const element = chart.querySelector<HTMLElement>(
          `[data-section-heading="${sectionId}"]`,
        );
        if (element) revealElement(element);
      } else if (document.sections.length === 0) {
        viewport.scrollTop = 0;
      }
    }
  }
  function finishMenuName(commit: boolean) {
    if (!menu || !menuNameEditing) return;
    menuNameEditing = false;
    if (commit) saveName(menu.id, menuDraft);
  }
  $effect(() => {
    function dismissOutsideMenu(event: PointerEvent) {
      if (menu && !menuElement.contains(event.target as Node)) {
        finishMenuName(true);
        menu = null;
      }
    }
    window.addEventListener('pointerdown', dismissOutsideMenu, true);
    return () =>
      window.removeEventListener('pointerdown', dismissOutsideMenu, true);
  });
  function keydown(event: KeyboardEvent) {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    )
      return;
    if (
      event.code === 'Space' &&
      (!busy || !!pan) &&
      !menu &&
      (!(event.target instanceof Element) ||
        !event.target.closest('button, select') ||
        !!event.target.closest('.bar, .milestone')) &&
      viewport.contains(event.target as Node)
    ) {
      event.preventDefault();
      spaceHeld = true;
      return;
    }
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
      deleteItem(id);
    }
  }
  function backgroundPress(event: PointerEvent) {
    if (spaceHeld && !(event.target as Element).closest('input, button')) {
      startPan(event);
      return;
    }
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
      x: event.clientX,
      y: event.clientY,
      rowId,
      kind: 'lane',
      id: rowId,
      week: Math.floor(weekAt(event.clientX)),
    };
    await focusMenu();
  }

  function startPan(event: PointerEvent) {
    if (event.button !== 0 || busy || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    finishName(true);
    menu = null;
    pan = {
      x: event.clientX,
      y: event.clientY,
      firstWeek: view.firstWeek,
      scrollTop: viewport.scrollTop,
    };
    pointerId = event.pointerId;
    captureOwner = viewport;
    viewport.setPointerCapture(event.pointerId);
  }
  function zoomTo(value: number, anchor?: number) {
    if (busy && !zooming) return;
    stopZoomAnimation();
    const bounds = visibleTimeline();
    const left = chart.getBoundingClientRect().left + LABEL_WIDTH;
    const x = (anchor ?? (bounds.left + bounds.right) / 2) - left;
    const zoom = clampZoom(value);
    if (zoom === view.zoom) return;
    changingScale = true;
    view.firstWeek = zoomFirstWeek(
      view.firstWeek,
      weekWidth,
      (laneWidth / WEEK_COUNT) * zoom,
      x,
    );
    view.zoom = zoom;
    finishScale();
  }
  function finishScale() {
    if (scaleFrame !== null) cancelAnimationFrame(scaleFrame);
    // A view scale changes every item together; disable document settlement until
    // the browser has painted the new scale, so the anchor remains attached.
    scaleFrame = requestAnimationFrame(() => {
      scaleFrame = requestAnimationFrame(() => {
        // Commit the final scale's layout before restoring transitions, even
        // when multiple animation frames are coalesced before a paint.
        chart?.getBoundingClientRect();
        changingScale = false;
        scaleFrame = null;
      });
    });
  }
  function stopZoomAnimation() {
    if (zoomFrame !== null) cancelAnimationFrame(zoomFrame);
    zoomFrame = null;
    if (zooming) {
      zooming = false;
      finishScale();
    }
  }
  function animateZoom(
    value: number,
    clientX: number,
    focus?: { week: number; clientX: number },
  ) {
    stopZoomAnimation();
    if (scaleFrame !== null) cancelAnimationFrame(scaleFrame);
    scaleFrame = null;
    const target = clampZoom(value);
    const from = view.zoom;
    if (target === from) return;
    const x = clientX - chart.getBoundingClientRect().left - LABEL_WIDTH;
    const fromX = focus
      ? focus.clientX - chart.getBoundingClientRect().left - LABEL_WIDTH
      : x;
    const anchorWeek = focus?.week ?? view.firstWeek + x / weekWidth;
    const started = performance.now();
    zooming = true;
    changingScale = true;
    const frame = (time: number) => {
      const progress = Math.min(
        1,
        Math.max(0, (time - started) / OVERVIEW_ZOOM_DURATION),
      );
      const eased = 1 - (1 - progress) ** 3;
      const zoom =
        progress === 1
          ? target
          : Math.exp(
              Math.log(from) + (Math.log(target) - Math.log(from)) * eased,
            );
      const frameX = fromX + (x - fromX) * eased;
      view.firstWeek = anchorWeek - frameX / ((laneWidth / WEEK_COUNT) * zoom);
      view.zoom = zoom;
      if (progress < 1) zoomFrame = requestAnimationFrame(frame);
      else {
        zoomFrame = null;
        zooming = false;
        finishScale();
      }
    };
    zoomFrame = requestAnimationFrame(frame);
  }
  // Non-passive native listener prevents browser zoom and preserves normal vertical scrolling.
  function navigation(node: HTMLElement) {
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (event.clientX >= visibleTimeline().left)
          zoomTo(
            view.zoom *
              Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.03 : 0.002)),
            event.clientX,
          );
      } else if ((event.deltaX || (event.shiftKey && event.deltaY)) && !busy) {
        event.preventDefault();
        const delta =
          (event.deltaX || event.deltaY) * (event.deltaMode === 1 ? 16 : 1);
        const before = viewport.scrollLeft;
        viewport.scrollLeft += delta;
        // Use native overflow first; continue beyond either edge through the
        // unbounded timeline coordinate without shifting the pinned labels.
        view.firstWeek += (delta - (viewport.scrollLeft - before)) / weekWidth;
        if (!event.shiftKey)
          viewport.scrollTop += event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      }
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return {
      destroy() {
        node.removeEventListener('wheel', wheel);
      },
    };
  }
  function openCalendar(event: MouseEvent, week: number) {
    if (busy) return;
    finishName(true);
    menu = null;
    calendarTrigger = event.currentTarget as HTMLElement;
    calendarPicker = {
      week,
      date: document.calendar ? dateAt(document.calendar, week) : '',
    };
  }
  async function calendarMenu(event: MouseEvent, week: number) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    finishName(true);
    calendarTrigger = event.currentTarget as HTMLElement;
    menu = {
      x: event.clientX,
      y: event.clientY,
      kind: 'calendar',
      id: '',
      rowId: '',
      week,
    };
    await focusMenu();
  }
  function editReference() {
    if (!menu || busy) return;
    const { week } = menu;
    menu = null;
    calendarPicker = {
      week,
      date: document.calendar ? dateAt(document.calendar, week) : '',
    };
  }
  function clearReference() {
    if (busy || !document.calendar) return;
    const { calendar: _reference, ...withoutReference } = history.document;
    history.commit(
      'calendar',
      { ...withoutReference, display: 'weeks' },
      'calendar',
    );
    menu = null;
    syncHistory();
    restoreCalendarFocus();
  }
  function restoreCalendarFocus() {
    // Overview reference changes can replace week headings with month bands.
    void tick().then(() =>
      (calendarTrigger?.isConnected ? calendarTrigger : viewport).focus({
        preventScroll: true,
      }),
    );
  }
  function closeCalendar() {
    calendarPicker = null;
    // The trigger is disabled while the picker is open. Restore focus only
    // after the overlay has unmounted and the controls are enabled again.
    restoreCalendarFocus();
  }
  function setCalendar(date: string) {
    if (!calendarPicker) return;
    const { week } = calendarPicker;
    history.commit(
      'calendar',
      {
        ...history.document,
        calendar: { week, date },
        display: 'dates',
      },
      'calendar',
    );
    closeCalendar();
    syncHistory();
  }
  function setDisplay(event: MouseEvent, display: 'weeks' | 'dates') {
    if (busy) return;
    if (display === 'dates' && !document.calendar) {
      openCalendar(event, 0);
      return;
    }
    if ((document.display ?? 'weeks') === display) return;
    finishName(true);
    menu = null;
    history.commit('display', { ...history.document, display }, 'calendar');
    syncHistory();
  }
  async function itemMenu(
    event: MouseEvent,
    kind: 'bar' | 'milestone',
    id: string,
  ) {
    if (kind !== 'bar' && (event.target as Element).closest('input')) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    finishName(true);
    view.selectedId = id;
    menuDraft = [...document.bars, ...document.milestones].find(
      (item) => item.id === id,
    )!.name;
    menuNameEditing = false;
    menu = {
      x: event.clientX,
      y: event.clientY,
      kind,
      id,
      rowId: '',
      week: 0,
    };
    await focusMenu();
  }
  function setColor(color?: Color) {
    if (!menu || busy) return;
    const id = menu.id;
    history.commit('color', recolor(history.document, id, color), id);
    menu = null;
    syncHistory();
    viewport.focus({ preventScroll: true });
  }
  function openColorPicker() {
    if (!menu || busy) return;
    colorPicker = { id: menu.id, color: menuEffectiveColor, name: menuName };
    menu = null;
  }
  function closeColorPicker() {
    colorPicker = null;
    void tick().then(() => viewport.focus({ preventScroll: true }));
  }
  function chooseColor(color: Color) {
    if (!colorPicker) return;
    const { id } = colorPicker;
    history.commit('color', recolor(history.document, id, color), id);
    closeColorPicker();
    syncHistory();
  }
  function deleteItem(id: string) {
    if (busy) return;
    menu = null;
    history.commit(
      'delete',
      {
        ...history.document,
        bars: history.document.bars.filter((bar) => bar.id !== id),
        milestones: history.document.milestones.filter(
          (item) => item.id !== id,
        ),
      },
      id,
    );
    view.selectedId = null;
    syncHistory();
    viewport.focus({ preventScroll: true });
  }
</script>

<svelte:window
  onkeydown={keydown}
  onkeyup={(event) => {
    if (event.code === 'Space') spaceHeld = false;
  }}
  onblur={cancel}
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

{#snippet colorPalette()}
  <div class="color-group" role="group" aria-label="Color palette">
    <div class="color-label">
      <span>Color</span>
    </div>
    <div class="palette">
      {#each paletteColors as preset}
        {@const appearance = colorAppearance(preset.color)}
        <button
          role="menuitemradio"
          aria-label={preset.name}
          aria-checked={menuColor === preset.color}
          type="button"
          title={preset.name}
          style:--swatch-fill={appearance.fill}
          style:--swatch-ink={appearance.ink}
          onclick={() => setColor(preset.color)}
          >{menuColor === preset.color ? '✓' : ''}</button
        >
      {/each}
      <button
        type="button"
        role="menuitem"
        class="more-colors"
        aria-label="More colors…"
        title="More colors"
        onclick={openColorPicker}
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path d="M8 3v10M3 8h10" /></svg
        ></button
      >
    </div>
  </div>
{/snippet}

{#snippet dragGrip(kind: 'row' | 'section', id: string, name: string)}
  <button
    type="button"
    class="drag-grip"
    aria-label={`Drag ${kind} ${name}`}
    title={`Drag to move ${kind}`}
    onpointerdown={(event) =>
      startStructure(event, kind === 'row' ? 'move-row' : 'move-section', id)}
  >
    <svg viewBox="0 0 10 16" aria-hidden="true"
      >{#each [3, 8, 13] as y}<circle cx="3" cy={y} r="1" /><circle
          cx="7"
          cy={y}
          r="1"
        />{/each}</svg
    >
  </button>
{/snippet}

<main class="shell" class:with-files={!!fileControls}>
  <header>
    {#if onhome}<button
        class="brand home-brand"
        aria-label="Home"
        onclick={onhome}
        ><img class="mark" src={taktMark} alt="" />Takt<span class="dot">.</span
        ></button
      >{:else}<div class="brand" aria-label="Takt">
        <img class="mark" src={taktMark} alt="" />Takt<span class="dot">.</span>
      </div>{/if}
    {#if fileControls}{@render fileControls()}{/if}
    <div class="toolbar" aria-label="Editor controls">
      {#if fileMenuControls}
        {@render fileMenuControls()}
        <span class="divider"></span>
      {/if}
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
      <span class="divider"></span>
      <Select
        label="Zoom"
        disabled={busy}
        value={view.zoom}
        options={[0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({
          value,
          label: `${value * 100}%`,
        }))}
        onchange={zoomTo}
      />
      <span class="divider"></span>
      <div class="mode-switch" aria-label="Timeline display">
        <button
          class:active={document.display !== 'dates'}
          aria-pressed={document.display !== 'dates'}
          disabled={busy}
          onclick={(event) => setDisplay(event, 'weeks')}>Weeks</button
        >
        <button
          class:active={document.display === 'dates'}
          aria-pressed={document.display === 'dates'}
          disabled={busy}
          oncontextmenu={(event) => void calendarMenu(event, 0)}
          onclick={(event) => setDisplay(event, 'dates')}>Dates</button
        >
      </div>
    </div>
  </header>
  <!-- The scroll region is focusable so keyboard users can scroll its overflow. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="viewport"
    class:pannable={spaceHeld}
    class:panning={!!pan}
    use:navigation
    bind:this={viewport}
    role="region"
    aria-label="Whole-week Gantt chart"
    aria-busy={zooming}
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
      class:structuralDragging={structuralMeaningful}
      bind:this={chart}
      style:height={`${54 + layout.height}px`}
    >
      <div class="chart-header">
        <div class="lane-heading">Sections &amp; rows</div>
        <div class="weeks" bind:clientWidth={laneWidth}>
          {#each years as band}
            <div
              class="year-band"
              style:left={`${Math.max(0, (band.start - view.firstWeek) * weekWidth)}px`}
              style:width={`${(Math.min(band.end, view.firstWeek + laneWidth / weekWidth) - Math.max(band.start, view.firstWeek)) * weekWidth}px`}
            >
              {band.label}
            </div>
          {/each}
          {#if monthHeadings}
            {#each months as band}
              <button
                class="month-band"
                data-month={band.label}
                title={band.label}
                aria-label={`${band.label} · Set reference at clicked week`}
                disabled={busy}
                style:left={`${Math.max(0, (band.start - view.firstWeek) * weekWidth)}px`}
                style:width={`${(Math.min(band.end, view.firstWeek + laneWidth / weekWidth) - Math.max(band.start, view.firstWeek)) * weekWidth}px`}
                oncontextmenu={(event) =>
                  void calendarMenu(event, Math.floor(weekAt(event.clientX)))}
                onclick={(event) =>
                  openCalendar(
                    event,
                    event.detail
                      ? Math.floor(weekAt(event.clientX))
                      : Math.ceil(Math.max(band.start, view.firstWeek)),
                  )}
                >{compactWeeks && (band.end - band.start) * weekWidth < 60
                  ? band.label.replace('Month ', 'M')
                  : band.label}</button
              >
            {/each}
          {:else}
            {#each weeks as week}<button
                class="week"
                class:date-week={document.display === 'dates'}
                aria-label={`${weekLabel(document, week)} · Set date for ${relativeWeekLabel(week)}`}
                title={weekLabel(document, week)}
                data-week={week}
                disabled={busy}
                oncontextmenu={(event) => void calendarMenu(event, week)}
                onclick={(event) => openCalendar(event, week)}
                style:left={`${(week - view.firstWeek) * weekWidth}px`}
                style:width={`${weekWidth}px`}
              >
                {#if document.display === 'dates'}
                  {@const label = weekLabel(document, week)}
                  <span>{label.slice(0, -5)}</span>
                {:else if week % stride === 0}
                  <span
                    class="week-label"
                    style:width={`${weekWidth * stride}px`}
                    style:left={`${(weekWidth * (1 - stride)) / 2}px`}
                    >{weekLabel(document, week)}</span
                  >
                {/if}
              </button>{/each}
          {/if}
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
            {@render dragGrip(
              'section',
              section.id,
              section.name || 'Unnamed section',
            )}
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
            <span
              class="section-color"
              style:background={colorLabelInk(
                document.sections.find((item) => item.id === section.id)
                  ?.color ?? DEFAULT_COLOR,
              )}
            ></span>
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
            {@render dragGrip('row', row.id, row.name || 'Unnamed row')}
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
            role="region"
            aria-label={`Timeline row ${layout.rows.findIndex((candidate) => candidate.id === row.id) + 1}`}
            tabindex="-1"
            data-testid="lane"
            data-row-lane={row.id}
            data-first-week={view.firstWeek}
            data-week-width={weekWidth}
            onpointerdown={(event) =>
              start(event, 'draw', crypto.randomUUID(), row.id)}
            ondblclick={(event) => {
              if (!(event.target as Element).closest('.bar, .milestone'))
                void createMilestone(row.id, Math.floor(weekAt(event.clientX)));
            }}
            oncontextmenu={(event) => void openMenu(event, row.id)}
          >
            <svg class="week-grid" aria-hidden="true"><path d={gridPath} /></svg
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
                  style:--bar-fill={proposalColor.fill}
                  style:--bar-ink={proposalColor.ink}
                  style:left={`${(proposal.start - FIRST_WEEK) * weekWidth + (gesture.kind === 'milestone-move' ? -7 : inset)}px`}
                  style:width={`${gesture.kind === 'milestone-move' ? 14 : (proposal.end - proposal.start) * weekWidth - inset * 2}px`}
                ></div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
      <div
        class="items"
        class:changingScale
        class:carrying={structuralMeaningful}
        style:width={`${laneWidth}px`}
        style:height={`${structural ? Math.max(layout.height, structuralTop + (structural.kind === 'move-section' ? layout.sections.find((section) => section.id === structural!.id)!.height : 44)) : layout.height}px`}
      >
        <div
          class="timeline-content"
          style:transform={`translateX(${timelineShift}px)`}
        >
          {#if structural && structuralMeaningful}
            {#if structural.kind === 'move-section'}
              {@const section = layout.sections.find(
                (section) => section.id === structural!.id,
              )!}
              <div
                class="carried-surface section-surface"
                style:left={`${-timelineShift}px`}
                style:width={`${laneWidth}px`}
                style:top={`${structuralTop}px`}
                style:height={`${section.height}px`}
              ></div>
            {/if}
            {#each renderedRows.filter( (row) => carriesRow(row.id) ) as row (row.id)}
              <div
                class="carried-surface"
                style:left={`${-timelineShift}px`}
                style:width={`${laneWidth}px`}
                style:top={`${structureTop(row.id, row.top)}px`}
              >
                <svg class="week-grid" aria-hidden="true"
                  ><path d={gridPath} /></svg
                >
              </div>
            {/each}
          {/if}
          {#each shown.bars as bar (bar.id)}
            <Bar
              bar={gesture?.id === bar.id && motion?.proposal
                ? { ...bar, ...motion.proposal }
                : bar}
              {weekWidth}
              color={colorAppearance(itemColor(shown, bar))}
              timing={barTiming(shown, bar.start, bar.end)}
              onmenu={itemMenu}
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
              onnamedrag={startNameDrag}
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
              color={colorAppearance(itemColor(shown, item))}
              timing={milestoneTiming(shown, item.boundary)}
              onmenu={itemMenu}
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
      onpointermove={(event) => {
        if (event.pointerType !== 'mouse') return;
        if (
          window.document.activeElement instanceof HTMLInputElement &&
          menuElement.contains(window.document.activeElement)
        )
          return;
        menuUsingKeyboard = false;
        const item = (event.target as Element).closest<HTMLButtonElement>(
          'button',
        );
        (item ?? menuElement).focus({ preventScroll: true });
      }}
      onpointerleave={(event) => {
        if (menuNameEditing) return;
        if (event.pointerType === 'mouse' && !menuUsingKeyboard)
          menuElement.focus({ preventScroll: true });
      }}
      onkeydown={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        menuUsingKeyboard = true;
        const buttons = [
          ...menuElement.querySelectorAll<HTMLElement>('input, button'),
        ];
        const index = buttons.indexOf(
          window.document.activeElement as HTMLElement,
        );
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const next =
            index === -1
              ? event.key === 'ArrowDown'
                ? 0
                : buttons.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
                buttons.length;
          buttons[next].focus();
        } else if (event.key === 'Tab') menu = null;
      }}
    >
      <div class="menu-heading">
        <small
          >{menu.kind === 'lane'
            ? 'Timeline'
            : menu.kind === 'calendar'
              ? 'Calendar reference'
              : menu.kind}</small
        >
        {#if menu.kind === 'bar'}
          <input
            class="menu-name"
            aria-label="Bar name"
            placeholder="Unnamed bar"
            value={menuDraft}
            onfocus={() => {
              menuNameEditing = true;
            }}
            oninput={(event) => (menuDraft = event.currentTarget.value)}
            onblur={() => finishMenuName(true)}
            onkeydown={(event) => {
              if (event.key !== 'Enter' && event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              finishMenuName(event.key === 'Enter');
              menu = null;
              viewport.focus({ preventScroll: true });
            }}
          />
        {:else}<strong title={menuName}>{menuName}</strong>{/if}
      </div>
      <hr />
      {#if menu.kind === 'calendar'}
        <MenuItem icon="calendar" onclick={editReference}
          >{document.calendar ? 'Reset reference' : 'Set reference'}</MenuItem
        >
        {#if document.calendar}
          <MenuItem icon="reset" onclick={clearReference}
            >Clear reference</MenuItem
          >
        {/if}
      {:else if menu.kind === 'lane'}
        <MenuItem icon="bar" onclick={() => void menuBar()}
          >Add bar here</MenuItem
        >
        <MenuItem
          icon="milestone"
          onclick={() => {
            if (menu) void createMilestone(menu.rowId, menu.week);
          }}>Add milestone here</MenuItem
        >
      {:else if menu.kind === 'section'}
        <MenuItem
          icon="row"
          onclick={() => {
            if (menu) void addRow(menu.id);
          }}>Add row</MenuItem
        >
        <MenuItem
          icon="section"
          onclick={() => {
            if (menu)
              void addSection(
                document.sections.findIndex(
                  (section) => section.id === menu!.id,
                ) + 1,
              );
          }}>Add section</MenuItem
        >
        <MenuItem
          icon="rename"
          onclick={() => {
            const id = menu!.id;
            menu = null;
            rename(id);
          }}>Rename</MenuItem
        >
        <hr />
        {@render colorPalette()}
        <hr />
        <MenuItem
          icon="trash"
          destructive
          onclick={() => {
            if (menu) void askDelete(menu.id);
          }}>Delete section…</MenuItem
        >
      {:else if menu.kind === 'bar' || menu.kind === 'milestone'}
        {#if menu.kind === 'milestone'}
          <MenuItem
            icon="rename"
            onclick={() => {
              const id = menu!.id;
              menu = null;
              rename(id);
            }}>Rename</MenuItem
          >
          <hr />
        {/if}
        {@render colorPalette()}
        <MenuItem icon="inherit" onclick={() => setColor()}
          >Use section color</MenuItem
        >
        <hr />
        <MenuItem
          icon="trash"
          destructive
          shortcut="Del"
          onclick={() => deleteItem(menu!.id)}>Delete {menu.kind}</MenuItem
        >
      {:else}
        <MenuItem
          icon="above"
          onclick={() => {
            const row = document.rows.find((row) => row.id === menu!.id)!;
            void addRow(
              row.sectionId,
              sectionRows(document, row.sectionId).findIndex(
                (item) => item.id === row.id,
              ),
            );
          }}>Insert row above</MenuItem
        >
        <MenuItem
          icon="below"
          onclick={() => {
            const row = document.rows.find((row) => row.id === menu!.id)!;
            void addRow(
              row.sectionId,
              sectionRows(document, row.sectionId).findIndex(
                (item) => item.id === row.id,
              ) + 1,
            );
          }}>Insert row below</MenuItem
        >
        <MenuItem
          icon="rename"
          onclick={() => {
            const id = menu!.id;
            menu = null;
            rename(id);
          }}>Rename</MenuItem
        >
        <hr />
        <MenuItem
          icon="trash"
          destructive
          onclick={() => {
            if (menu) void askDelete(menu.id);
          }}>Delete row…</MenuItem
        >
      {/if}
    </div>
  {/if}
  {#if calendarPicker}
    <CalendarPicker
      {...calendarPicker}
      onchoose={setCalendar}
      onclose={closeCalendar}
    />
  {/if}
  {#if colorPicker}
    <ColorPicker
      color={colorPicker.color}
      name={colorPicker.name}
      onchoose={chooseColor}
      onclose={closeColorPicker}
    />
  {/if}
  {#if confirmation}
    <Dialog
      titleId="delete-title"
      descriptionId="delete-description"
      onclose={closeConfirmation}
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
        <Button onclick={closeConfirmation}>Cancel</Button><Button
          variant="danger"
          onclick={confirmDelete}
          ><svg class="delete-icon" viewBox="0 0 18 18" aria-hidden="true"
            ><path d="M3 5h12M7 5V3h4v2M5 5l1 11h6l1-11M8 8v5m2-5v5" /></svg
          >Delete {confirmation.kind}</Button
        >
      </div>
    </Dialog>
  {/if}
  <span class="notice" role="status">{notice}</span>
  <footer>
    Click tiny bars to zoom · Drag bars to move · Drag ends to resize<span
      >Esc cancels · Ctrl / Cmd + Z undoes</span
    >
  </footer>
</main>

<style>
  .shell {
    padding: 0 34px 26px;
    height: 100dvh;
    display: grid;
    grid-template-rows: 88px minmax(0, 1fr) auto;
  }
  header {
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .with-files header {
    position: relative;
    display: grid;
    grid-template-columns: minmax(90px, 1fr) minmax(80px, 300px) auto;
    gap: 20px;
  }
  .with-files .toolbar {
    justify-self: end;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -1px;
  }
  .home-brand {
    justify-self: start;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .dot {
    color: var(--accent);
    margin-left: -10px;
  }
  .mark {
    display: block;
    width: 23px;
    height: 23px;
    flex-shrink: 0;
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
  @media (max-width: 900px) {
    .with-files header {
      gap: 14px;
    }
    .with-files .toolbar {
      gap: 8px;
    }
  }
  .divider {
    width: 1px;
    height: 20px;
    background: var(--line);
  }
  .mode-switch {
    font-size: 13px;
    font-weight: 600;
    padding: 7px 11px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .mode-switch {
    display: flex;
    padding: 3px;
    gap: 2px;
  }
  .mode-switch button {
    border: 0;
    padding: 5px 9px;
    border-radius: 3px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .mode-switch button.active {
    color: var(--ink);
    background: var(--soft);
  }
  .pannable,
  .panning {
    cursor: grab;
    user-select: none;
  }
  .panning {
    cursor: grabbing;
  }
  .pannable :global(.bar),
  .pannable :global(.handle),
  .pannable :global(.milestone),
  .pannable .row-name,
  .pannable .section-name {
    cursor: inherit;
  }
  .viewport {
    outline: none;
    overflow: auto;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    min-height: 0;
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
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--surface);
    height: 54px;
    border-bottom: 1px solid var(--line);
  }
  .lane-heading {
    top: 0;
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
    top: 20px;
    height: 33px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid var(--grid);
    border-top: 1px solid var(--grid);
    border-left: 0;
    border-bottom: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    font-size: 13px;
    color: var(--row-ink);
    font-weight: 500;
  }
  .date-week {
    font-size: 11px;
  }
  .week-label {
    position: absolute;
    top: 0;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    pointer-events: none;
  }
  .year-band,
  .month-band {
    position: absolute;
    overflow: hidden;
    white-space: nowrap;
    border-right: 1px solid var(--line);
    text-align: center;
    font-size: 11px;
  }
  .year-band {
    top: 0;
    height: 20px;
    line-height: 20px;
    background: var(--section-bg);
    color: var(--muted);
    pointer-events: none;
  }
  .month-band {
    top: 20px;
    height: 33px;
    border-top: 1px solid var(--grid);
    border-bottom: 0;
    border-left: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
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
    padding: 0 14px;
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
    padding: 0 14px;
    gap: 8px;
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
  }
  .week-grid {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    fill: none;
    stroke: var(--grid);
    stroke-width: 1;
    shape-rendering: crispEdges;
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
  .items.carrying {
    z-index: 7;
  }
  .carried-surface {
    position: absolute;
    height: 44px;
    background: var(--surface);
    border-bottom: 1px solid var(--grid);
    z-index: 6;
    pointer-events: auto;
  }
  .section-surface {
    background: linear-gradient(var(--section-bg) 36px, var(--surface) 36px);
  }
  .changingScale :global(.bar),
  .changingScale :global(.milestone) {
    transition: none;
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
  .drag-grip {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 12px;
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #9ca7b4;
    cursor: grab;
    touch-action: none;
  }
  .drag-grip:hover {
    color: var(--muted);
  }
  .drag-grip:active {
    cursor: grabbing;
  }
  .drag-grip svg {
    width: 10px;
    height: 16px;
    fill: currentColor;
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
  }
  .row.carried {
    /* Keep timeline items above the carried grid, with the label pinned
       above the clipped timeline overlay. */
    z-index: auto;
    background: var(--surface);
  }
  .row.carried .row-label {
    z-index: 9;
  }
  .structuralDragging .row-label,
  .structuralDragging .section-label {
    z-index: 8;
  }
  .section.carried,
  .add-row-line.carried {
    z-index: 9;
  }
  .add-row-line.carried {
    background: var(--surface);
    /* The final strip supplies one shadow below the complete carried group. */
    box-shadow: 0 4px 12px #182e471a;
    clip-path: inset(0 -12px -16px);
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
  #delete-title {
    font-size: 17px;
    margin: 0 0 12px;
  }
  #delete-description {
    font-size: 13px;
    line-height: 1.6;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }
  .delete-icon {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
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
    width: 232px;
    max-height: calc(100dvh - 16px);
    overflow-y: auto;
    padding: 6px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 9px;
    box-shadow:
      0 12px 32px #182e471a,
      0 2px 6px #182e470a;
  }
  .menu-heading {
    padding: 6px 9px 5px;
  }
  .menu-heading small {
    display: block;
    color: var(--muted);
    font-size: 10px;
    text-transform: capitalize;
    margin-bottom: 4px;
  }
  .menu-heading strong {
    display: block;
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .menu-name {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    padding: 0;
    background: transparent;
    color: var(--ink);
    font-size: 12px;
    font-weight: 600;
  }
  .menu-name:focus {
    box-shadow: 0 1px var(--line);
  }
  .context-menu hr {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 5px -6px;
  }
  .color-group {
    padding: 7px 9px 8px;
  }
  .color-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--muted);
    font-size: 10px;
    margin-bottom: 9px;
  }
  .color-label span:first-child {
    font-weight: 600;
  }
  .palette button:focus-visible {
    outline: 2px solid var(--swatch-ink);
    outline-offset: 2px;
  }
  .palette {
    display: grid;
    grid-template-columns: repeat(5, 32px);
    justify-content: space-between;
    gap: 8px;
  }
  .palette button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 30px;
    padding: 0;
    border: 1px solid #182e4710;
    border-radius: 5px;
    color: var(--swatch-ink);
    background: var(--swatch-fill);
    box-shadow: inset 0 1px 0 #ffffff30;
    cursor: pointer;
    text-align: center;
    font-size: 13px;
  }
  .palette button:focus {
    box-shadow: inset 0 0 0 1px var(--swatch-ink);
  }
  .palette button[aria-checked='true'] {
    border-color: var(--swatch-ink);
  }
  .palette .more-colors {
    color: var(--muted);
    background: conic-gradient(
      from 25deg,
      #f3b18433,
      #b5a2e044,
      #a0d4dd44,
      #abc4ad44,
      #f3b18433
    );
  }
  .more-colors svg {
    display: block;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  .palette .more-colors:focus-visible {
    outline-color: var(--accent);
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
    background: color-mix(in srgb, var(--bar-fill) 19%, transparent);
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
