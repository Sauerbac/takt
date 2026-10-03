<script lang="ts">
  import type { Bar } from '../model/document';
  import type { Interval, GestureKind } from '../interaction/gesture';
  import { FIRST_WEEK, BAR_INSET } from '../viewport';
  let {
    bar,
    weekWidth,
    tracking,
    selected,
    editing,
    draft,
    onstart,
    onrename,
    ondraft,
    onfinish,
  }: {
    bar: Bar;
    weekWidth: number;
    tracking?: Interval;
    selected: boolean;
    editing: boolean;
    draft: string;
    onstart: (event: PointerEvent, kind: GestureKind, id: string) => void;
    onrename: (id: string) => void;
    ondraft: (value: string) => void;
    onfinish: (commit: boolean) => void;
  } = $props();
  const position = $derived(tracking ?? bar);
  let input = $state<HTMLInputElement>();
  $effect(() => {
    if (editing && input) {
      input.focus();
      input.select();
    }
  });
</script>

<!-- Positioning is deliberately pointer based for this milestone. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="bar"
  class:selected
  class:tracking={!!tracking}
  class:editing
  data-testid={`bar-${bar.id}`}
  data-start={bar.start}
  data-end={bar.end}
  style:left={`${(position.start - FIRST_WEEK) * weekWidth + BAR_INSET}px`}
  style:width={`${Math.max(1, (position.end - position.start) * weekWidth - BAR_INSET * 2)}px`}
  title={`${bar.name || 'Unnamed bar'} · Weeks ${bar.start}–${bar.end - 1}`}
  onpointerdown={(event) => {
    if (!editing) onstart(event, 'move', bar.id);
    else event.stopPropagation();
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
  {:else}<span>{bar.name}</span>{/if}
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
  .bar {
    position: absolute;
    top: 8px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: var(--bar-radius);
    background: var(--bar-fill);
    color: var(--bar-ink);
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    padding: 0 12px;
    transition:
      left var(--settlement) ease-out,
      width var(--settlement) ease-out;
    cursor: grab;
    z-index: 1;
    white-space: nowrap;
  }
  .bar.selected {
    border-color: var(--bar-ink);
    z-index: 2;
  }
  .bar.tracking {
    transition: none;
    cursor: grabbing;
    z-index: 3;
  }
  .bar span {
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
  }
  .bar.editing {
    z-index: 4;
  }
  input {
    width: 100%;
    min-width: 0;
    background: var(--bar-fill);
    color: inherit;
    border: 0;
    outline: 0;
    padding: 2px 0;
    font-weight: inherit;
  }
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 10px;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: ew-resize;
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
    opacity: 0;
    border-radius: 1px;
  }
  .bar:hover .handle::after,
  .selected .handle::after {
    opacity: 0.6;
  }
</style>
