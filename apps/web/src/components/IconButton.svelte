<script lang="ts">
  let {
    label,
    disabled = false,
    onclick,
    redo = false,
  }: {
    label: string;
    disabled?: boolean;
    onclick: () => void;
    redo?: boolean;
  } = $props();
</script>

<button
  type="button"
  aria-label={label}
  title={label}
  class:redo
  {disabled}
  {onclick}
>
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 6h7a3 3 0 0 1 0 6H6M3 6l3-3M3 6l3 3" />
  </svg>
  <span>{label}</span>
</button>

<style>
  button {
    height: 36px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-lg);
    background: transparent;
    font-size: 13px;
    cursor: pointer;
  }
  button:hover:enabled {
    background: var(--soft);
  }
  button:disabled {
    cursor: default;
  }
  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .redo {
    flex-direction: row-reverse;
  }
  .redo svg {
    transform: scaleX(-1);
  }
</style>
