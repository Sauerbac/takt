<script lang="ts">
  let {
    name,
  }: { name: 'new' | 'open' | 'file' | 'clock' | 'close' | 'arrow' | 'drop' } =
    $props();
  const paths = {
    new: 'M5 3h9l4 4v14H5zM14 3v5h4M11.5 11v6M8.5 14h6',
    open: 'M3 7h6l2-3h9v5M3 7v13h17l2-10H7L3 20',
    file: 'M5 3h9l4 4v14H5zM14 3v5h4M8 12h7M8 16h5',
    clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    close: 'm7 7 10 10M7 17 17 7',
    arrow: 'M4 12h15m-5-5 5 5-5 5',
    drop: 'M12 3v11m-4-4 4 4 4-4M4 16v5h16v-5',
  };
</script>

<svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>

<style>
  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
