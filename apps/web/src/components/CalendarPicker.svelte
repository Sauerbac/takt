<script lang="ts">
  import { tick } from 'svelte';
  let {
    week,
    date,
    x,
    y,
    onchoose,
    onclose,
  }: {
    week: number;
    date: string;
    x: number;
    y: number;
    onchoose: (date: string) => void;
    onclose: () => void;
  } = $props();
  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  // Each opening mounts a new picker with its own uncommitted date draft.
  // svelte-ignore state_referenced_locally
  let value = $state(date);
  $effect(() => {
    dialog.showModal();
    void tick().then(() => input.focus());
  });
  function close() {
    dialog.close();
    onclose();
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="calendar-title"
  style:left={`${Math.max(8, Math.min(x, window.innerWidth - 300))}px`}
  style:top={`${Math.max(8, Math.min(y, window.innerHeight - 190))}px`}
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
  onclick={(event) => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        close();
    }
  }}
>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      if (input.checkValidity()) {
        dialog.close();
        onchoose(value);
      }
    }}
  >
    <label id="calendar-title" for="calendar-date">Week {week} starts on</label>
    <input
      id="calendar-date"
      bind:this={input}
      type="date"
      required
      min="0001-01-01"
      max="9999-12-31"
      bind:value
    />
    <div>
      <button type="button" onclick={close}>Cancel</button><button type="submit"
        >Set date</button
      >
    </div>
  </form>
</dialog>

<style>
  dialog {
    position: fixed;
    margin: 0;
    width: 284px;
    padding: 18px;
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 8px 24px #182e471a;
  }
  dialog::backdrop {
    background: transparent;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  input {
    width: 100%;
    padding: 7px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: inherit;
    background: var(--surface);
  }
  form div {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
  }
  button {
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    cursor: pointer;
  }
  button[type='submit'] {
    background: var(--bar-fill);
    border-color: var(--bar-fill);
  }
</style>
