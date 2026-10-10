<script lang="ts">
  import type { Bar } from '../model/document';
  import type { Interval, GestureKind } from '../interaction/gesture';
  import { nameDrag } from './name-drag';
  import {
    FIRST_WEEK,
    barInset,
    BAR_LABEL_WIDTH,
    COMPACT_BAR_WIDTH,
  } from '../viewport';
  let {
    bar,
    weekWidth,
    tracking,
    visible = true,
    carried = false,
    selected,
    invalid = false,
    editing,
    draft,
    onstart,
    onnamedrag,
    onrename,
    ondraft,
    onfinish,
    top = 8,
    color,
    timing,
    onmenu,
  }: {
    bar: Bar;
    weekWidth: number;
    tracking?: Interval;
    visible?: boolean;
    carried?: boolean;
    selected: boolean;
    invalid?: boolean;
    editing: boolean;
    draft: string;
    onstart: (event: PointerEvent, kind: GestureKind, id: string) => void;
    onnamedrag: (
      down: PointerEvent,
      move: PointerEvent,
      surface: HTMLElement,
      id: string,
    ) => void;
    onrename: (id: string) => void;
    ondraft: (value: string) => void;
    onfinish: (commit: boolean) => void;
    top?: number;
    color?: { fill: string; ink: string };
    timing?: string;
    onmenu?: (event: MouseEvent, kind: 'bar', id: string) => void;
  } = $props();
  const position = $derived(tracking ?? bar);
  const inset = $derived(barInset(weekWidth));
  const paintedWidth = $derived(
    Math.max(1, (position.end - position.start) * weekWidth - inset * 2),
  );
  let input = $state<HTMLInputElement>();
  $effect(() => {
    if (editing && input) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
</script>

<!-- Positioning is deliberately pointer based for this milestone. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="bar"
  class:selected
  class:carried
  class:hidden={!visible}
  class:invalid
  class:tracking={!!tracking}
  class:editing
  class:compact={paintedWidth < COMPACT_BAR_WIDTH}
  data-testid={`bar-${bar.id}`}
  data-start={bar.start}
  data-end={bar.end}
  data-row={bar.rowId}
  style:--bar-fill={color?.fill}
  style:--bar-ink={color?.ink}
  style:top={`${top}px`}
  style:left={`${(position.start - FIRST_WEEK) * weekWidth + inset}px`}
  style:width={`${paintedWidth}px`}
  style:--handle-width={`${Math.min(10, Math.max(0.5, ((position.end - position.start) * weekWidth - inset * 2 - 2) / 3))}px`}
  title={`${invalid ? 'Cannot drop here · Move clear or hold to push · ' : ''}${bar.name || 'Unnamed bar'} · ${timing ?? `Weeks ${bar.start + 1}–${bar.end}`}`}
  oncontextmenu={(event) => onmenu?.(event, 'bar', bar.id)}
  onpointerdown={(event) => {
    onstart(event, 'move', bar.id);
  }}
  ondblclick={() => onrename(bar.id)}
>
  <button
    class="handle left"
    type="button"
    aria-label={`Resize start of ${bar.name || 'bar'}`}
    onpointerdown={(event) => {
      event.stopPropagation();
      onstart(event, 'resize-left', bar.id);
    }}
  ></button>
  {#if editing}
    <input
      bind:this={input}
      use:nameDrag={(down, move, surface) =>
        onnamedrag(down, move, surface, bar.id)}
      aria-label="Bar name"
      value={draft}
      oninput={(event) => ondraft(event.currentTarget.value)}
      onblur={() => onfinish(true)}
      onpointerdown={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onfinish(event.key === 'Enter');
        }
      }}
    />
  {:else if paintedWidth >= BAR_LABEL_WIDTH}<span>{bar.name}</span>{/if}
  <button
    class="handle right"
    type="button"
    aria-label={`Resize end of ${bar.name || 'bar'}`}
    onpointerdown={(event) => {
      event.stopPropagation();
      onstart(event, 'resize-right', bar.id);
    }}
  ></button>
</div>

<style>
  .hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .carried {
    transition: none !important;
    z-index: 7;
  }
  .bar {
    position: absolute;
    top: 8px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: var(--bar-radius);
    background: var(--bar-fill);
    color: var(--bar-ink);
    font-size: 13px;
    line-height: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    padding: 0 min(12px, var(--handle-width));
    transition:
      left var(--settlement) ease-out,
      width var(--settlement) ease-out,
      top var(--settlement) ease-out;
    cursor: grab;
    z-index: 1;
    white-space: nowrap;
  }
  .bar.selected {
    z-index: 2;
  }
  .bar.tracking {
    transition: none;
    cursor: grabbing;
    z-index: 3;
  }
  .bar.invalid {
    border: 1px dashed #a23e42;
    cursor: not-allowed;
  }
  .bar span {
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
    transform: translateY(-1px);
  }
  .bar.editing {
    z-index: 4;
  }
  .bar.carried {
    z-index: 7;
  }
  input {
    cursor: grab;
    width: 100%;
    min-width: 0;
    background: var(--bar-fill);
    color: inherit;
    border: 0;
    outline: 0;
    padding: 2px 0;
    font-weight: inherit;
    transform: translateY(-1px);
  }
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--handle-width);
    border: 0;
    padding: 0;
    background: transparent;
    cursor: ew-resize;
  }
  .compact {
    cursor: zoom-in;
  }
  .compact .handle {
    visibility: hidden;
    pointer-events: none;
  }
  .handle:focus-visible {
    outline: none;
  }
  .left {
    left: 0;
  }
  .right {
    right: 0;
  }
  .handle::after {
    content: '';
    display: block;
    height: 10px;
    width: 2px;
    margin: auto;
    background: currentColor;
    opacity: 0.6;
    border-radius: 1px;
  }
</style>
