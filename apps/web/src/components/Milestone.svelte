<script lang="ts">
  import type { Milestone } from '../model/document';
  import { FIRST_WEEK } from '../viewport';
  let {
    item,
    weekWidth,
    top,
    tracking,
    visible = true,
    carried = false,
    selected,
    invalid,
    editing,
    draft,
    onstart,
    onrename,
    ondraft,
    onfinish,
    color,
    timing,
    onmenu,
  }: {
    item: Milestone;
    weekWidth: number;
    top: number;
    tracking?: number;
    visible?: boolean;
    carried?: boolean;
    selected: boolean;
    invalid: boolean;
    editing: boolean;
    draft: string;
    onstart: (event: PointerEvent, kind: 'milestone-move', id: string) => void;
    onrename: (id: string) => void;
    ondraft: (value: string) => void;
    onfinish: (commit: boolean) => void;
    color?: { fill: string; ink: string };
    timing?: string;
    onmenu?: (event: MouseEvent, kind: 'milestone', id: string) => void;
  } = $props();
  let input = $state<HTMLInputElement>();
  $effect(() => {
    if (editing && input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
</script>

<!-- Milestones use the same direct pointer manipulation as bars. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="milestone"
  class:selected
  class:carried
  class:hidden={!visible}
  class:invalid
  class:tracking={tracking !== undefined}
  class:editing
  data-testid={`milestone-${item.id}`}
  data-boundary={item.boundary}
  data-row={item.rowId}
  style:--bar-fill={color?.fill}
  style:--bar-ink={color?.ink}
  style:left={`${((tracking ?? item.boundary) - FIRST_WEEK) * weekWidth}px`}
  style:width={`${item.name || editing ? 150 : 14}px`}
  style:top={`${top}px`}
  title={`${invalid ? 'Cannot drop here · A milestone already marks this boundary · ' : ''}${item.name || 'Unnamed milestone'} · ${timing ?? `End of Week ${item.boundary - 1}`}`}
  oncontextmenu={(event) => onmenu?.(event, 'milestone', item.id)}
  onpointerdown={(event) => {
    if (!editing) onstart(event, 'milestone-move', item.id);
    else event.stopPropagation();
  }}
  ondblclick={() => onrename(item.id)}
>
  <i aria-hidden="true"></i>
  {#if editing}
    <input
      bind:this={input}
      aria-label="Milestone name"
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
  {:else}<span>{item.name}</span>{/if}
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
  .milestone {
    position: absolute;
    height: 28px;
    display: flex;
    align-items: center;
    width: 150px;
    padding-left: 14px;
    cursor: grab;
    z-index: 2;
    font-size: 12px;
    font-weight: 600;
    color: var(--bar-ink);
    transition:
      left var(--settlement) ease-out,
      top var(--settlement) ease-out;
  }
  i {
    position: absolute;
    left: -6px;
    width: 12px;
    height: 12px;
    transform: rotate(45deg);
    border: 1px solid var(--bar-ink);
    background: var(--bar-fill);
  }
  .invalid i {
    background: #fff;
    border: 2px dashed #a23e42;
  }
  .invalid {
    cursor: not-allowed;
  }
  .tracking {
    transition: none;
    cursor: grabbing;
    z-index: 4;
  }
  .editing {
    z-index: 5;
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }
  input {
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
</style>
