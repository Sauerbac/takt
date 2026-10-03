<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { emptyDocument } from '../model/document';
  import type { ChartDocument } from '../model/document';
  import { History } from '../model/history';
  import { Gesture } from '../interaction/gesture';
  import type { GestureKind } from '../interaction/gesture';
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

  let { initial = emptyDocument() }: { initial?: ChartDocument } = $props();
  // The initial document seeds this editor instance once; remount to open another document.
  // svelte-ignore state_referenced_locally
  const history = new History(initial);
  let document = $state(history.document);
  let view = $state(initialViewport());
  let gesture = $state.raw<Gesture | null>(null);
  let motion = $state<{
    meaningful: boolean;
    tracking: { start: number; end: number };
    proposal: { start: number; end: number } | null;
    validDrop: boolean;
  } | null>(null);
  let draft = $state('');
  let canUndo = $state(false);
  let canRedo = $state(false);
  let viewport: HTMLDivElement;
  let lane: HTMLDivElement;
  let laneWidth = $state(900);
  let pointerId: number | null = null;
  let captureOwner: HTMLElement | null = null;
  let pointer: { x: number; y: number } | null = null;
  let scrollFrame: number | null = null;
  let scrollTime = 0;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  const weekWidth = $derived(laneWidth / WEEK_COUNT);
  const timelineShift = $derived((FIRST_WEEK - view.firstWeek) * weekWidth);
  const weeks = $derived(
    Array.from(
      { length: WEEK_COUNT + 1 },
      (_, i) => Math.floor(view.firstWeek) + i,
    ),
  );
  const shown = $derived(document);

  onDestroy(() => {
    stopScrolling();
    stopPushTimer();
  });

  function syncHistory() {
    document = history.document;
    canUndo = history.canUndo;
    canRedo = history.canRedo;
  }
  function weekAt(clientX: number) {
    return pointerWeek(
      clientX,
      lane.getBoundingClientRect().left,
      weekWidth,
      view.firstWeek,
    );
  }
  function start(
    event: PointerEvent,
    kind: GestureKind,
    id: string = crypto.randomUUID(),
  ) {
    if (event.button !== 0 || gesture || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    const pressedBar = (event.currentTarget as HTMLElement).closest('.bar');
    const displayed =
      kind !== 'draw' && pressedBar
        ? displayedInterval(
            pressedBar.getBoundingClientRect(),
            lane.getBoundingClientRect().left,
            weekWidth,
            view.firstWeek,
          )
        : undefined;
    finishName(true);
    view.selectedId = kind === 'draw' ? null : id;
    pointerId = event.pointerId;
    pointer = { x: event.clientX, y: event.clientY };
    gesture = new Gesture(
      history.document,
      kind,
      id,
      weekAt(event.clientX),
      weekWidth,
      displayed,
    );
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
    if (!gesture || event.pointerId !== pointerId) return;
    pointer = { x: event.clientX, y: event.clientY };
    updateProposal();
    updateScrolling();
  }
  function updateScrolling() {
    if (scrollVelocity() === 0) stopScrolling();
    else if (scrollFrame === null) {
      scrollTime = performance.now();
      scrollFrame = requestAnimationFrame(scroll);
    }
  }
  function updateProposal() {
    if (!gesture || !pointer) return;
    gesture.update(weekAt(pointer.x), performance.now(), pointer.x);
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
    if (!gesture) return;
    updateProposal();
    updateScrolling();
  }
  function visibleTimeline() {
    const chart = viewport.getBoundingClientRect();
    const row = lane.getBoundingClientRect();
    return {
      left: Math.max(row.left, chart.left + viewport.clientLeft + LABEL_WIDTH),
      right: Math.min(
        row.right,
        chart.left + viewport.clientLeft + viewport.clientWidth,
      ),
      top: chart.top + viewport.clientTop,
      bottom: chart.top + viewport.clientTop + viewport.clientHeight,
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
    if (velocity === 0) return;
    view.firstWeek += (velocity * (time - scrollTime)) / 1000 / weekWidth;
    scrollTime = time;
    // Re-project a stationary pointer after every view change. The transaction
    // still derives collisions and history from its committed pointer-down snapshot.
    updateProposal();
    scrollFrame = requestAnimationFrame(scroll);
  }
  function stopScrolling() {
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
  }
  function releaseCapture() {
    stopScrolling();
    stopPushTimer();
    pointer = null;
    const id = pointerId;
    pointerId = null;
    if (id !== null && captureOwner?.hasPointerCapture(id))
      captureOwner.releasePointerCapture(id);
    captureOwner = null;
  }
  function cancel() {
    if (!gesture) return;
    document = gesture.cancel();
    gesture = null;
    motion = null;
    releaseCapture();
  }
  async function end(event: PointerEvent) {
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
    if (gesture || view.editingId === id) return;
    const bar = history.document.bars.find((bar) => bar.id === id);
    if (!bar) return;
    view.selectedId = id;
    view.editingId = id;
    draft = bar.name;
  }
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
          bars: before.bars.map((bar) =>
            bar.id === id ? { ...bar, name: draft } : bar,
          ),
        },
        id,
      );
      syncHistory();
    }
    lane?.focus({ preventScroll: true });
  }
  async function travel(direction: 'undo' | 'redo') {
    if (gesture) return;
    finishName(true);
    const command = history[direction]();
    syncHistory();
    if (command) {
      view.selectedId = document.bars.some((bar) => bar.id === command.revealId)
        ? command.revealId
        : null;
      await tick();
      const bar = document.bars.find((bar) => bar.id === command.revealId);
      if (bar) {
        const bounds = visibleTimeline();
        const left = weekAt(bounds.left);
        const right = weekAt(bounds.right);
        if (bar.start < left) view.firstWeek += bar.start - left;
        else if (bar.end > right)
          view.firstWeek += Math.min(bar.end - right, bar.start - left);
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
      cancel();
      return;
    }
    if (gesture) return;
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
      history.commit(
        'delete',
        { ...document, bars: document.bars.filter((bar) => bar.id !== id) },
        id,
      );
      view.selectedId = null;
      syncHistory();
    }
  }
  function backgroundPress(event: PointerEvent) {
    if (
      event.button !== 0 ||
      gesture ||
      !(event.target instanceof Element) ||
      event.target.closest('.bar')
    )
      return;
    finishName(true);
    view.selectedId = null;
  }
</script>

<svelte:window onkeydown={keydown} onblur={cancel} />

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
          disabled={!canUndo || !!gesture}
          onclick={() => void travel('undo')}
        />
        <IconButton
          label="Redo"
          redo
          disabled={!canRedo || !!gesture}
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
    style:--labels={`${LABEL_WIDTH}px`}
  >
    <div class="chart">
      <div class="chart-header">
        <div class="lane-heading">Sections &amp; rows</div>
        <div class="weeks">
          {#each weeks as week}<div
              class="week"
              style:left={`${(week - view.firstWeek) * weekWidth}px`}
              style:width={`${weekWidth}px`}
            >
              Week {week < 0 ? `−${-week}` : week}
            </div>{/each}
        </div>
      </div>
      <div class="section">
        <div class="section-label">
          <span class="section-color"></span>{document.sectionName ||
            'Unnamed section'}<span class="count">01</span>
        </div>
        <div></div>
      </div>
      <div class="row">
        <div class="row-label">{document.rowName || 'Unnamed row'}</div>
        <div
          class="lane"
          bind:this={lane}
          bind:clientWidth={laneWidth}
          style:--week={`${weekWidth}px`}
          style:background-position-x={`${timelineShift}px`}
          role="region"
          aria-label="Timeline row"
          tabindex="-1"
          data-testid="lane"
          data-first-week={view.firstWeek}
          onpointerdown={(event) => start(event, 'draw')}
          onpointermove={move}
          onpointerup={end}
          onpointercancel={cancel}
          onlostpointercapture={() => {
            if (pointerId !== null) cancel();
          }}
        >
          {#if shown.bars.length === 0}<span class="hint"
              >Drag to create a bar · Double-click for a milestone.</span
            >{/if}
          <div
            class="timeline-content"
            style:transform={`translateX(${timelineShift}px)`}
          >
            {#if gesture && motion?.meaningful}
              {@const proposal = motion.proposal}
              {#if proposal}<div
                  class="snap-preview"
                  class:invalid={!motion.validDrop}
                  data-testid="snap-preview"
                  data-start={proposal.start}
                  data-end={proposal.end}
                  data-valid={motion.validDrop}
                  style:left={`${(proposal.start - FIRST_WEEK) * weekWidth + BAR_INSET}px`}
                  style:width={`${(proposal.end - proposal.start) * weekWidth - BAR_INSET * 2}px`}
                ></div>{/if}
            {/if}
            {#each shown.bars as bar (bar.id)}
              <Bar
                bar={gesture?.id === bar.id && motion?.proposal
                  ? { ...bar, ...motion.proposal }
                  : bar}
                {weekWidth}
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
          </div>
        </div>
      </div>
    </div>
  </div>
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
    overflow: auto;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    min-height: 470px;
  }
  .chart {
    min-width: 1120px;
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
