<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  let {
    children,
    variant = 'secondary',
    ...attributes
  }: HTMLButtonAttributes & {
    children: Snippet;
    variant?: 'primary' | 'secondary' | 'danger';
  } = $props();
</script>

<button type="button" {...attributes} class={variant}
  >{@render children()}</button
>

<style>
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    box-shadow: var(--shadow-xs);
    cursor: pointer;
    transition:
      background 150ms,
      border-color 150ms;
  }
  button:hover:enabled {
    background: var(--soft);
    border-color: var(--line-strong);
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    box-shadow: var(--shadow-accent);
  }
  .primary:hover:enabled {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
    font-weight: 600;
  }
  .danger:hover:enabled {
    background: var(--danger-hover);
    border-color: var(--danger-hover);
  }
  button :global(kbd) {
    font-family: inherit;
    font-size: 11px;
    font-weight: 400;
    opacity: 0.9;
  }
</style>
