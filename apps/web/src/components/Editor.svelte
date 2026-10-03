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
  let view = $state(initialViewport());
  let gesture = $state.raw<Gesture | MilestoneGesture | null>(null);
  let motion = $state<{
    meaningful: boolean;
    tracking: { start: number; end: number };
    proposal: { start: number; end: number; rowId: string } | null;
    validDrop: boolean;
  } | null>(null);
  let draft = $state('');
  const SECTION_NAME_ID = 'section-name';
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
  const hintRowIndex = $derived(
    Math.max(
      0,
      Math.min(shown.rows.length - 1, Math.floor((visibleScrollTop - 90) / 44)),
    ),
  );
  const rowTop = (id: string) =>
    document.rows.findIndex((row) => row.id === id) * 44 + 8;

  onDestroy(() => {
    stopScrolling();
    stopPushTimer();
  });

  function syncHistory() {
    document = history.document;
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
    rowId = document.rows[0].id,
  ) {
    if (event.button !== 0 || gesture || !event.isPrimary) return;
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
        (chart.getBoundingClientRect().top + 90)
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
    if (!gesture || event.pointerId !== pointerId) return;
    pointer = { x: event.clientX, y: event.clientY };
    updateProposal();
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
    if (!gesture) return;
    updateProposal();
    updateScrolling();
  }
  function visibleTimeline() {
    const chart = viewport.getBoundingClientRect();
    const row = thisLane().getBoundingClientRect();
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
  function thisLane(): HTMLElement {
    return chart.querySelector<HTMLElement>('[data-row-lane]')!;
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
    scrollTime = time;
    // Re-project a stationary pointer after every view change. The transaction
    // still derives collisions and history from its committed pointer-down snapshot.
    updateProposal();
    scrollFrame = requestAnimationFrame(scroll);
  }
  function verticalVelocity() {
    if (!movingBetweenRows || !gesture?.meaningful || !pointer) return 0;
    const bounds = visibleTimeline();
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
        viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight)
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
    pointer = null;
    const id = pointerId;
    pointerId = null;
    if (id !== null && captureOwner?.hasPointerCapture(id))
      captureOwner.releasePointerCapture(id);
    captureOwner = null;
  }
  function cancel() {
    menu = null;
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
    const item =
      id === SECTION_NAME_ID
        ? { name: history.document.sectionName }
        : [
            ...history.document.bars,
            ...history.document.milestones,
            ...history.document.rows,
          ].find((item) => item.id === id);
    if (!item) return;
    finishName(true);
    view.selectedId = id === SECTION_NAME_ID ? null : id;
    view.editingId = id;
    draft = item.name;
  }
  function revealRow(id: string) {
    const lane = [
      ...chart.querySelectorAll<HTMLElement>('[data-row-lane]'),
    ].find((element) => element.dataset.rowLane === id);
    if (!lane) return;
    const bounds = lane.getBoundingClientRect();
    const visible = viewport.getBoundingClientRect();
    if (bounds.top < visible.top)
      viewport.scrollTop += bounds.top - visible.top;
    else if (bounds.bottom > visible.top + viewport.clientHeight)
      viewport.scrollTop += bounds.bottom - visible.top - viewport.clientHeight;
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
          sectionName: id === SECTION_NAME_ID ? draft : before.sectionName,
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
    if (gesture) return;
    finishName(true);
    const command = history[direction]();
    syncHistory();
    if (command) {
      const items = [...document.bars, ...document.milestones];
      view.selectedId = items.some((item) => item.id === command.revealId)
        ? command.revealId
        : null;
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
        if (command.revealId === SECTION_NAME_ID)
          viewport.scrollTop = Math.min(viewport.scrollTop, 54);
        revealRow(command.revealId);
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
      gesture ||
      !(event.target instanceof Element) ||
      event.target.closest('.bar, .milestone, .context-menu, input, button')
    )
      return;
    finishName(true);
    menu = null;
    view.selectedId = null;
  }

  async function addRow() {
    if (gesture) return;
    finishName(true);
    const row = { id: crypto.randomUUID(), name: '' };
    history.commit(
      'add-row',
      { ...history.document, rows: [...history.document.rows, row] },
      row.id,
    );
    syncHistory();
    await tick();
    revealRow(row.id);
    rename(row.id);
  }
  async function createMilestone(rowId: string, week: number) {
    if (gesture) return;
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
    if (gesture || (event.target as Element).closest('.bar, .milestone'))
      return;
    finishName(true);
    view.selectedId = null;
    menu = {
      x: Math.max(0, Math.min(event.clientX, window.innerWidth - 210)),
      y: Math.max(0, Math.min(event.clientY, window.innerHeight - 105)),
      rowId,
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
    onpointermove={move}
    onpointerup={end}
    onpointercancel={cancel}
    onlostpointercapture={() => {
      if (pointerId !== null) cancel();
    }}
    style:--labels={`${LABEL_WIDTH}px`}
  >
    <div class="chart" bind:this={chart}>
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
      <div class="section">
        <div class="section-label">
          <span class="section-color"></span>
          {#if view.editingId === SECTION_NAME_ID}
            <input
              aria-label="Section name"
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
          {:else}
            <button class="section-name" onclick={() => rename(SECTION_NAME_ID)}
              >{document.sectionName || 'Unnamed section'}</button
            >
          {/if}
          <span class="count">{String(shown.rows.length).padStart(2, '0')}</span
          >
        </div>
        <div></div>
      </div>
      {#each shown.rows as row, index (row.id)}
        <div class="row">
          <div class="row-label">
            {#if view.editingId === row.id}
              <input
                aria-label="Row name"
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
            {:else}
              <button class="row-name" ondblclick={() => rename(row.id)}
                >{row.name || 'Unnamed row'}</button
              >
            {/if}
          </div>
          <div
            class="lane"
            style:--week={`${weekWidth}px`}
            style:background-position-x={`${timelineShift}px`}
            role="region"
            aria-label={`Timeline row ${index + 1}`}
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
            {#if empty && index === hintRowIndex}<span class="hint"
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
        style:height={`${shown.rows.length * 44}px`}
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
      <div class="add-row-line">
        <button class="add-row" onclick={() => void addRow()}>+ Add row</button>
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
    </div>
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
    top: 90px;
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
  .add-row-line {
    height: 36px;
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
