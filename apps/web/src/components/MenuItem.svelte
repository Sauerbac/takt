<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    icon,
    destructive = false,
    disabled = false,
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
      | 'below'
      | 'calendar'
      | 'reset'
      | 'new'
      | 'open'
      | 'save'
      | 'download'
      | 'home';
    disabled?: boolean;
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
    calendar: 'M3 4h12v12H3zM6 2v4m6-4v4M3 8h12',
    reset: 'M3 8a6 6 0 1 1 1 6M3 3v5h5',
    new: 'M4 2h7l3 3v11H4zM11 2v4h3M9 8v5m-2-2.5h4',
    open: 'M2 5h5l2-2h6v4M2 5v11h13l2-8H5l-3 8',
    save: 'M3 2h10l3 3v11H3zM6 2v5h7V2M6 16v-6h7v6',
    download: 'M9 2v9m-3-3 3 3 3-3M3 12v4h12v-4',
    home: 'm2 8 7-6 7 6M4 7v9h10V7M7 16v-5h4v5',
  };
</script>

<button type="button" role="menuitem" class:destructive {disabled} {onclick}>
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
    border-radius: var(--radius-sm);
    color: var(--ink);
    background: transparent;
    font-size: 13px;
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
    font-size: 11px;
    font-weight: 400;
  }
  .destructive {
    color: var(--danger);
  }
  .destructive:focus {
    background: var(--danger-soft);
  }
  .destructive small {
    color: inherit;
    opacity: 0.65;
  }
</style>
