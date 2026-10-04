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
    gap: 7px;
    min-height: 36px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 1px 2px #182e4709;
    cursor: pointer;
    transition:
      background 150ms,
      box-shadow 150ms,
      transform 150ms;
  }
  button:hover:enabled {
    background: var(--soft);
    box-shadow: 0 2px 5px #182e4712;
  }
  button:active:enabled {
    transform: translateY(1px);
    box-shadow: none;
  }
  button:focus-visible {
    outline: 3px solid #f3b18480;
    outline-offset: 2px;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .primary {
    background: var(--bar-fill);
    border-color: #dc9a6d;
    color: var(--bar-ink);
    box-shadow:
      inset 0 1px 0 #ffffff40,
      0 1px 2px #182e4712;
  }
  .primary:hover:enabled {
    background: #eda575;
  }
  .danger {
    background: #a23e42;
    border-color: #92363a;
    color: white;
    box-shadow:
      inset 0 1px 0 #ffffff30,
      0 1px 2px #a23e4226;
  }
  .danger:hover:enabled {
    background: #92363a;
    box-shadow:
      inset 0 1px 0 #ffffff30,
      0 2px 5px #a23e4233;
  }
</style>
