<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    icon,
    destructive = false,
    shortcut,
    onclick,
    children,
  }: {
    icon:
      | 'bar'
      | 'milestone'
      | 'row'
      | 'section'
      | 'rename'
      | 'inherit'
      | 'trash'
      | 'above'
      | 'below';
    destructive?: boolean;
    shortcut?: string;
    onclick: () => void;
    children: Snippet;
  } = $props();
  const paths = {
    bar: 'M3 6h12v6H3zM7 4v10',
    milestone: 'm9 2 7 7-7 7-7-7z',
    row: 'M3 4h12M3 9h7M3 14h7m4-4v6m-3-3h6',
    section: 'M3 3h12v4H3zM3 11h5M3 15h5m5-5v6m-3-3h6',
    rename: 'm11 3 4 4M3 15l1-4 9-9 4 4-9 9-5 1z',
    inherit: 'M8 5H6a4 4 0 0 0 0 8h2m2-8h2a4 4 0 0 1 0 8h-2M6 9h6',
    trash: 'M3 5h12M7 5V3h4v2M5 5l1 11h6l1-11M8 8v5m2-5v5',
    above: 'M3 13h12v3H3zM9 10V2m-3 3 3-3 3 3',
    below: 'M3 2h12v3H3zM9 8v8m-3-3 3 3 3-3',
  };
</script>

<button type="button" role="menuitem" class:destructive {onclick}>
  <svg viewBox="0 0 18 18" aria-hidden="true"><path d={paths[icon]} /></svg>
  <span>{@render children()}</span>
  {#if shortcut}<small aria-hidden="true">{shortcut}</small>{/if}
</button>

<style>
  button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 34px;
    padding: 7px 9px;
    border: 0;
    border-radius: 5px;
    color: var(--ink);
    background: transparent;
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
  }
  button:focus {
    background: var(--soft);
    outline: none;
  }
  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.7;
  }
  span {
    flex: 1;
  }
  small {
    color: var(--muted);
    font-size: 10px;
    font-weight: 400;
  }
  .destructive {
    color: #a23e42;
  }
  .destructive:focus {
    background: #a23e420d;
  }
  .destructive small {
    color: inherit;
    opacity: 0.65;
  }
</style>
