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

<button type="button" aria-label={label} title={label} {disabled} {onclick}>
  <svg viewBox="0 0 24 24" aria-hidden="true" class:redo>
    <path d="M8 5 3 10l5 5M3 10h10a6 6 0 0 1 6 6v3" />
  </svg>
</button>

<style>
  button {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    cursor: pointer;
  }
  button:hover:enabled {
    background: var(--soft);
  }
  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .redo {
    transform: scaleX(-1);
  }
</style>
