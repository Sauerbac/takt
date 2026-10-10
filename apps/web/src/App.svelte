<script lang="ts">
  import { onMount } from 'svelte';
  import Editor from './components/Editor.svelte';
  import Dialog from './components/Dialog.svelte';
  import Button from './components/Button.svelte';
  import taktMark from './assets/takt-mark.svg';
  import { browserAdapter } from './project/browser';
  import { newProject, contentKey } from './project/format';
  import type { ProjectSnapshot } from './project/format';
  import type {
    OpenedProject,
    PlatformAdapter,
    RecentFile,
    RecoveryRecord,
  } from './project/platform';
  import { ProjectSession } from './project/session';
  let { adapter = browserAdapter }: { adapter?: PlatformAdapter } = $props();
  let revision = $state(0);
  // svelte-ignore state_referenced_locally
  const session = new ProjectSession(adapter, () => revision++);
  const current = $derived.by(() => {
    void revision;
    return {
      snapshot: session.snapshot,
      home: session.home,
      modified: session.modified,
      generation: session.generation,
      error: session.error,
      warning: session.recoveryWarning,
      drafts: session.drafts,
    };
  });
  let editor = $state<Editor | undefined>();
  let title = $state('Untitled');
  let fileMenu = $state(false);
  let fileButton = $state<HTMLButtonElement>();
  let guard = $state(false);
  let acknowledge = $state(false);
  let retainedDownload: {
    snapshot: ProjectSnapshot;
    generation: number;
  } | null = null;
  let conflict = $state(false);
  let reloadConfirm = $state(false);
  let reloadRequest = 0;
  let commandRequest = 0;
  let operation = $state(false);
  let recents = $state<RecentFile[]>([]);
  let showAll = $state(false);
  let pending: (() => void) | undefined;
  let recoveryClaim: {
    claimed: RecoveryRecord;
    source: RecoveryRecord;
  } | null = null;
  let closeResolve: ((allowed: boolean) => void) | undefined;
  let missing = $state<RecentFile | null>(null);
  const saveLabel = $derived(
    adapter.kind === 'web' ? 'Download .takt' : 'Save',
  );
  onMount(() => {
    void session.initialize();
    void adapter.listRecents?.().then((value) => (recents = value));
    return adapter.onCloseRequested?.(
      () =>
        new Promise((resolve) => {
          prepare();
          if (!session.modified) {
            void session.discard().then(resolve);
            return;
          }
          closeResolve = resolve;
          guard = true;
          pending = () => void session.discard().then(resolve);
        }),
    );
  });
  function prepare() {
    fileMenu = false;
    if (!session.snapshot) return;
    const prepared = editor?.prepareFile();
    title = title.trim() || 'Untitled';
    session.update({ ...session.snapshot, title, ...(prepared ?? {}) });
  }
  function replace(opened: OpenedProject) {
    session.replace(opened);
    title = opened.snapshot.title;
  }
  function guarded(action: () => void) {
    prepare();
    const generation = session.generation,
      request = commandRequest,
      key = session.snapshot ? contentKey(session.snapshot) : '';
    if (session.modified) {
      pending = action;
      guard = true;
    } else if (session.snapshot) {
      void session.discard().then((removed) => {
        if (
          removed &&
          generation === session.generation &&
          request === commandRequest &&
          (!session.snapshot || contentKey(session.snapshot) === key)
        )
          action();
        else {
          void session.persist();
          void abandonClaim();
        }
      });
    } else action();
  }
  function cancelGuard() {
    void abandonClaim();
    guard = false;
    acknowledge = false;
    retainedDownload = null;
    pending = undefined;
    closeResolve?.(false);
    closeResolve = undefined;
  }
  async function continueGuard(discard: boolean) {
    const action = pending;
    const generation = session.generation;
    if (!(await session.discard())) return;
    if (action !== pending || generation !== session.generation) {
      void session.persist();
      return;
    }
    pending = undefined;
    guard = false;
    acknowledge = false;
    closeResolve = undefined;
    action?.();
  }
  function create() {
    void abandonClaim();
    commandRequest++;
    session.cancelReplacement();
    guarded(() => replace({ snapshot: newProject() }));
  }
  async function resume(record: RecoveryRecord) {
    void abandonClaim();
    const request = ++commandRequest,
      generation = session.generation;
    prepare();
    operation = true;
    try {
      const claimed = (await adapter.claimRecovery?.(record)) ?? record;
      if (request !== commandRequest || generation !== session.generation) {
        if (claimed.id !== session.recoveryId)
          await adapter.abandonRecoveryClaim?.(claimed, record);
        return;
      }
      recoveryClaim = { claimed, source: record };
      guarded(() => {
        recoveryClaim = null;
        session.replace(claimed, true, claimed.id);
        title = claimed.snapshot.title;
      });
    } catch (error) {
      session.error =
        error instanceof Error
          ? error.message
          : 'Could not recover this draft.';
      revision++;
    } finally {
      operation = false;
    }
  }
  async function abandonClaim() {
    const reservation = recoveryClaim;
    recoveryClaim = null;
    if (!reservation || reservation.claimed.id === session.recoveryId) return;
    try {
      await adapter.abandonRecoveryClaim?.(
        reservation.claimed,
        reservation.source,
      );
    } catch {
      session.recoveryWarning =
        'Could not release recovery ownership. Your current project is still available.';
      revision++;
    }
  }
  async function open(path?: string, locatePath?: string) {
    void abandonClaim();
    prepare();
    const generation = session.generation;
    const request = ++commandRequest;
    session.cancelReplacement();
    operation = true;
    try {
      const result = await adapter.open(path);
      if (session.generation !== generation || request !== commandRequest)
        return;
      if (result.status === 'success')
        guarded(async () => {
          replace(result.value);
          if (locatePath) {
            await adapter.removeRecent?.(locatePath);
            recents = (await adapter.listRecents?.()) ?? [];
          }
        });
      else if (result.status === 'failure') {
        session.error = result.message;
        revision++;
        if (path) missing = recents.find((item) => item.path === path) ?? null;
      }
    } catch (error) {
      session.error =
        error instanceof Error ? error.message : 'Could not open file.';
      revision++;
    } finally {
      operation = false;
    }
  }
  async function save(
    saveAs = false,
    overwrite = false,
    acknowledgeSaved = true,
  ) {
    prepare();
    operation = true;
    try {
      const result = await session.save({
        saveAs,
        overwrite,
        acknowledge: acknowledgeSaved,
      });
      if (result.status === 'conflict') conflict = true;
      if (
        result.status === 'success' &&
        pending &&
        guard &&
        adapter.kind === 'desktop' &&
        !session.modified
      )
        await continueGuard(false);
      return result;
    } finally {
      operation = false;
    }
  }
  async function reloadExternal() {
    const path = session.file?.path;
    if (!path) return;
    const generation = session.generation,
      request = ++reloadRequest,
      key = session.snapshot ? contentKey(session.snapshot) : '';
    operation = true;
    try {
      const result = await adapter.open(path);
      if (
        generation !== session.generation ||
        request !== reloadRequest ||
        !reloadConfirm ||
        (session.snapshot && contentKey(session.snapshot) !== key)
      )
        return;
      if (result.status === 'success' && (await session.discard())) {
        if (
          generation !== session.generation ||
          request !== reloadRequest ||
          !reloadConfirm ||
          (session.snapshot && contentKey(session.snapshot) !== key)
        ) {
          void session.persist();
          return;
        }
        cancelGuard();
        reloadConfirm = false;
        replace(result.value);
      } else if (result.status === 'failure') {
        session.error = result.message;
        revision++;
      }
    } catch (error) {
      session.error =
        error instanceof Error ? error.message : 'Could not reload file.';
      revision++;
    } finally {
      operation = false;
    }
  }
  async function saveContinue() {
    prepare();
    if (!session.snapshot) return;
    const requested = {
      snapshot: session.snapshot,
      generation: session.generation,
    };
    const action = pending;
    const result = await save(false, false, adapter.kind !== 'web');
    if (result?.status !== 'success') return;
    if (adapter.kind === 'web' && (!guard || pending !== action)) return;
    if (
      requested.generation !== session.generation ||
      !session.snapshot ||
      contentKey(requested.snapshot) !== contentKey(session.snapshot)
    )
      return;
    if (adapter.kind === 'web') {
      retainedDownload = requested;
      acknowledge = true;
    } else await continueGuard(false);
  }
  async function confirmDownload() {
    if (
      !retainedDownload ||
      !session.snapshot ||
      contentKey(retainedDownload.snapshot) !== contentKey(session.snapshot)
    ) {
      acknowledge = false;
      return;
    }
    if (
      !session.acknowledge(
        retainedDownload.snapshot,
        retainedDownload.generation,
      )
    )
      return;
    retainedDownload = null;
    await continueGuard(false);
  }
  function home() {
    void abandonClaim();
    commandRequest++;
    session.cancelReplacement();
    if (adapter.kind === 'desktop')
      guarded(async () => {
        if (!(await session.discard())) return;
        session.home = true;
        session.snapshot = null;
        session.generation++;
        revision++;
        void session.refreshDrafts();
        void adapter.listRecents?.().then((value) => (recents = value));
      });
    else {
      prepare();
      session.home = true;
      revision++;
      void session.refreshDrafts();
    }
  }
  function keyboard(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (!['s', 'o', 'n'].includes(key)) return;
    event.preventDefault();
    if (operation || guard || conflict || reloadConfirm) return;
    if (key === 's' && session.snapshot) void save(event.shiftKey);
    if (key === 'o') void open();
    if (key === 'n') create();
  }
  function focusFileMenu(node: HTMLElement) {
    node.querySelector<HTMLButtonElement>('button')?.focus();
  }
</script>

<svelte:window
  onkeydown={keyboard}
  onclick={(event) => {
    if (!(event.target as HTMLElement)?.closest('.file-menu-wrap'))
      fileMenu = false;
  }}
  onbeforeunload={(event) => {
    prepare();
    if (session.modified) {
      event.preventDefault();
      event.returnValue = '';
    }
  }}
/>
{#if current.home}
  <main class="home">
    <div class="home-brand">
      <img src={taktMark} alt="" />Takt<span>.</span>
    </div>
    <section class="welcome">
      <p class="eyebrow">MAKE ROOM FOR YOUR PLANS</p>
      <h1>A clear view of what’s ahead.</h1>
      <p>
        Build a chart, shape your timeline, and keep your plans in a .takt file.
      </p>
      <div class="actions">
        <Button variant="primary" onclick={create} disabled={operation}
          >New project</Button
        ><Button onclick={() => void open()} disabled={operation}
          >Open .takt file</Button
        >
      </div>
    </section>
    {#if current.snapshot}<section class="drafts">
        <h2>Current project</h2>
        <button
          class="draft"
          onclick={() => {
            session.home = false;
            revision++;
          }}>{current.snapshot.title}<span>Resume project</span></button
        >
      </section>{/if}
    {#if current.drafts.length}<section class="drafts">
        <h2>
          {adapter.kind === 'web' ? 'Resume draft' : 'Recover unsaved work'}
        </h2>
        {#each current.drafts.filter((record) => !current.snapshot || record.id !== session.recoveryId) as record}<button
            class="draft"
            disabled={operation}
            onclick={() => resume(record)}
            >{record.snapshot.title}<span
              >{new Date(record.updatedAt).toLocaleString()}</span
            ></button
          >{/each}
      </section>{/if}
    {#if adapter.kind === 'desktop' && recents.length}<section class="drafts">
        <h2>Recent files</h2>
        {#each showAll ? recents : recents.slice(0, 10) as recent}<div
            class="recent-entry"
          >
            <button class="draft" onclick={() => void open(recent.path)}
              >{recent.name}<span>{recent.folder}</span></button
            ><button
              class="remove-recent"
              aria-label={`Remove ${recent.name} from recents`}
              onclick={() =>
                void adapter
                  .removeRecent?.(recent.path)
                  .then(() => adapter.listRecents?.())
                  .then((value) => (recents = value ?? []))}>×</button
            >
          </div>{/each}{#if recents.length > 10}<Button
            onclick={() => (showAll = !showAll)}
            >{showAll ? 'Show latest ten' : 'Show all recent files'}</Button
          >{/if}
      </section>{/if}
  </main>
{/if}
{#if current.snapshot}
  <div
    class:inactive={current.home}
    aria-hidden={current.home}
    inert={current.home}
  >
    {#key current.generation}
      <Editor
        bind:this={editor}
        initial={current.snapshot.document}
        initialView={current.snapshot.view}
        onhome={home}
        onchange={(document, view) => {
          if (session.snapshot)
            session.update({ ...session.snapshot, document, view });
        }}
      >
        {#snippet fileControls()}
          <div class="file-controls">
            <div class="title-wrap">
              <input
                aria-label="Project title"
                bind:value={title}
                onblur={() => {
                  title = title.trim() || 'Untitled';
                  if (session.snapshot)
                    session.update({ ...session.snapshot, title });
                }}
                onkeydown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Escape') {
                    title = session.snapshot?.title ?? 'Untitled';
                    event.currentTarget.blur();
                  }
                }}
              /><svg class="title-pencil" viewBox="0 0 16 16" aria-hidden="true"
                ><path
                  d="m10.7 2.3 3 3-8.6 8.6-3.6.6.6-3.6zM9.3 3.7l3 3"
                /></svg
              >{#if current.modified}<span
                  class="modified"
                  aria-label="Modified"
                  title="Modified">●</span
                >{/if}
            </div>
            <div class="file-menu-wrap">
              <button
                class="file-trigger"
                aria-label="File"
                bind:this={fileButton}
                aria-haspopup="menu"
                aria-expanded={fileMenu}
                onclick={() => (fileMenu = !fileMenu)}
                onkeydown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    fileMenu = true;
                  }
                }}>File <span>⌄</span></button
              >
              {#if fileMenu}<div
                  class="file-menu"
                  use:focusFileMenu
                  role="menu"
                  tabindex="-1"
                  onkeydown={(event) => {
                    if (event.key === 'Escape') {
                      fileMenu = false;
                      fileButton?.focus();
                    }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      const buttons = Array.from(
                        event.currentTarget.querySelectorAll('button'),
                      );
                      const index = buttons.indexOf(
                        document.activeElement as HTMLButtonElement,
                      );
                      buttons[
                        (index +
                          (event.key === 'ArrowDown'
                            ? 1
                            : buttons.length - 1)) %
                          buttons.length
                      ]?.focus();
                    }
                  }}
                >
                  <button role="menuitem" disabled={operation} onclick={create}
                    >New project <span>Ctrl N</span></button
                  ><button
                    role="menuitem"
                    disabled={operation}
                    onclick={() => void open()}
                    >Open .takt file <span>Ctrl O</span></button
                  ><button
                    role="menuitem"
                    disabled={operation}
                    onclick={() => void save()}
                    >{saveLabel}<span>Ctrl S</span></button
                  >{#if adapter.kind === 'desktop'}<button
                      role="menuitem"
                      disabled={operation}
                      onclick={() => void save(true)}>Save As…</button
                    >{/if}<button role="menuitem" onclick={home}>Home</button>
                </div>{/if}
            </div>
          </div>
        {/snippet}
      </Editor>
    {/key}
  </div>
{/if}
{#if current.warning}<div class="warning" role="status">
    {current.warning}<button
      onclick={() => void session.persist().then(() => session.refreshDrafts())}
      >Retry</button
    >
  </div>{/if}
{#if current.error}<div class="error" role="alert">
    {current.error}<button
      aria-label="Dismiss error"
      onclick={() => {
        session.error = '';
        revision++;
      }}>×</button
    >
  </div>{/if}
{#if guard}<Dialog titleId="replace-title" onclose={cancelGuard}
    ><h2 id="replace-title">Keep your changes?</h2>
    {#if acknowledge}<p>
        Confirm that you retained the downloaded .takt file before continuing.
      </p>
      <div class="dialog-actions">
        <Button onclick={cancelGuard}>Cancel</Button><Button
          variant="primary"
          onclick={() => void confirmDownload()}
          >I kept the download — Continue</Button
        >
      </div>{:else}<p>
        This project has changes that haven’t been {adapter.kind === 'web'
          ? 'downloaded'
          : 'saved'}.
      </p>
      <div class="dialog-actions">
        <Button onclick={cancelGuard}>Cancel</Button><Button
          onclick={() => void continueGuard(true)}>Discard changes</Button
        ><Button
          variant="primary"
          disabled={operation}
          onclick={() => void saveContinue()}
          >{adapter.kind === 'web' ? 'Download and continue' : 'Save'}</Button
        >
      </div>{/if}</Dialog
  >{/if}
{#if conflict}<Dialog
    titleId="conflict-title"
    onclose={() => (conflict = false)}
    ><h2 id="conflict-title">File changed elsewhere</h2>
    <p>Your edits are still here. Reload replaces your local changes.</p>
    <div class="dialog-actions">
      <Button onclick={() => (conflict = false)}>Cancel</Button><Button
        onclick={() => {
          conflict = false;
          reloadConfirm = true;
        }}>Reload their version</Button
      ><Button
        onclick={() => {
          conflict = false;
          void save(true);
        }}>Save my work as another file</Button
      ><Button
        onclick={() => {
          conflict = false;
          void save(false, true);
        }}>Overwrite</Button
      >
    </div></Dialog
  >{/if}
{#if reloadConfirm}<Dialog
    titleId="reload-title"
    onclose={() => {
      reloadConfirm = false;
      reloadRequest++;
    }}
    ><h2 id="reload-title">Replace local changes?</h2>
    <p>
      Reloading the file replaces your local edits with the version on disk.
    </p>
    <div class="dialog-actions">
      <Button
        onclick={() => {
          reloadConfirm = false;
          reloadRequest++;
        }}>Cancel</Button
      ><Button
        variant="primary"
        disabled={operation}
        onclick={() => void reloadExternal()}
        >Reload and replace local changes</Button
      >
    </div></Dialog
  >{/if}
{#if missing}<Dialog titleId="missing-title" onclose={() => (missing = null)}
    ><h2 id="missing-title">File unavailable</h2>
    <p>{missing.path}</p>
    <div class="dialog-actions">
      <Button onclick={() => (missing = null)}>Cancel</Button><Button
        onclick={() => {
          const path = missing!.path;
          missing = null;
          void adapter
            .removeRecent?.(path)
            .then(() => adapter.listRecents?.())
            .then((value) => (recents = value ?? []));
        }}>Remove from recents</Button
      ><Button
        variant="primary"
        onclick={() => {
          const oldPath = missing!.path;
          missing = null;
          void open(undefined, oldPath);
        }}>Locate file</Button
      >
    </div></Dialog
  >{/if}

<style>
  .inactive {
    position: fixed;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .recent-entry {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .remove-recent {
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 20px;
    cursor: pointer;
  }
  .home {
    max-width: 960px;
    margin: auto;
    padding: 40px 34px 70px;
  }
  .home-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -1px;
  }
  .home-brand img {
    width: 23px;
  }
  .home-brand span {
    color: var(--accent);
    margin-left: -10px;
  }
  .welcome {
    margin: 80px 0 56px;
    max-width: 600px;
  }
  .eyebrow {
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
  }
  h1 {
    font-size: 44px;
    line-height: 1.15;
    letter-spacing: -1.5px;
    margin: 18px 0;
  }
  p {
    color: var(--muted);
    line-height: 1.6;
  }
  .actions {
    display: flex;
    gap: 12px;
    margin-top: 28px;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 16px;
  }
  .drafts {
    margin-top: 28px;
  }
  .draft {
    display: flex;
    width: 100%;
    text-align: left;
    justify-content: space-between;
    padding: 18px 20px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    margin: 8px 0;
    cursor: pointer;
    font-weight: 600;
  }
  .draft span {
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
  }
  .file-controls {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 0;
    flex: 1;
    justify-content: center;
    min-width: 0;
  }
  .title-wrap {
    position: relative;
    max-width: 300px;
    min-width: 100px;
    width: 100%;
  }
  .title-wrap input {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 5px;
    padding: 9px 28px 9px 12px;
    color: var(--ink);
    background: var(--surface);
    font-size: 13px;
    font-weight: 600;
  }
  .title-wrap input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .modified {
    position: absolute;
    right: -14px;
    top: 11px;
    font-size: 10px;
    color: var(--accent);
  }
  .file-menu-wrap {
    position: absolute;
    left: 110px;
    top: 24px;
  }
  .title-pencil {
    position: absolute;
    right: 11px;
    top: 11px;
    width: 14px;
    height: 14px;
    stroke: var(--muted);
    fill: none;
    stroke-width: 1.25;
    pointer-events: none;
  }
  .file-trigger {
    border: 0;
    background: transparent;
    font-size: 13px;
    padding: 10px;
    cursor: pointer;
  }
  .file-trigger span {
    margin-left: 8px;
  }
  .file-menu {
    position: absolute;
    top: 40px;
    left: 0;
    min-width: 240px;
    z-index: 30;
    background: var(--surface);
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 7px;
    box-shadow: 0 8px 24px #182e471f;
  }
  .file-menu button {
    display: flex;
    justify-content: space-between;
    width: 100%;
    border: 0;
    border-radius: 4px;
    background: transparent;
    padding: 10px;
    text-align: left;
    font-size: 13px;
    cursor: pointer;
  }
  .file-menu button:hover,
  .file-menu button:focus {
    background: var(--soft);
  }
  .file-menu button span {
    color: var(--muted);
    font-size: 11px;
    margin-left: 20px;
  }
  .warning,
  .error {
    position: fixed;
    z-index: 50;
    bottom: 12px;
    left: 34px;
    right: 34px;
    padding: 12px 16px;
    border: 1px solid #e2b88e;
    border-radius: 6px;
    background: #fff4e7;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .error {
    bottom: 64px;
  }
  .warning button,
  .error button {
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--accent);
    font-weight: 600;
  }
  .dialog-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
  }
</style>
