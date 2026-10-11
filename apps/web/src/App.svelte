<script lang="ts">
  import { onMount } from 'svelte';
  import Editor from './components/Editor.svelte';
  import Dialog from './components/Dialog.svelte';
  import Button from './components/Button.svelte';
  import MenuItem from './components/MenuItem.svelte';
  import ProjectIcon from './components/ProjectIcon.svelte';
  import taktMark from './assets/takt-mark.svg';
  import { browserAdapter } from './project/browser';
  import { newProject, contentKey } from './project/format';
  import type { ProjectSnapshot } from './project/format';
  import type {
    OpenedProject,
    PlatformAdapter,
    RecentFile,
    RecoveryRecord,
    ProjectFileDrop,
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
  let fileDrag = $state(false);
  let dragDepth = 0;
  let recents = $state<RecentFile[]>([]);
  let showAll = $state(false);
  const availableDrafts = $derived(
    current.drafts.filter(
      (record) => !current.snapshot || record.id !== session.recoveryId,
    ),
  );
  const hasProjects = $derived(
    !!current.snapshot ||
      availableDrafts.length > 0 ||
      (adapter.kind === 'desktop' && recents.length > 0),
  );
  const modifier =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘'
      : 'Ctrl';
  let pending: (() => void) | undefined;
  let recoveryClaim: {
    claimed: RecoveryRecord;
    source: RecoveryRecord;
  } | null = null;
  let closeResolve: ((allowed: boolean) => void) | undefined;
  let missing = $state<RecentFile | null>(null);
  const shellDialog = $derived(
    guard || conflict || reloadConfirm || missing !== null,
  );
  const dropBlocked = $derived(operation || shellDialog);
  const saveLabel = $derived(
    adapter.kind === 'web' ? 'Download .takt' : 'Save',
  );
  onMount(() => {
    void session.initialize();
    void adapter.listRecents?.().then((value) => (recents = value));
    const disposeDrop = adapter.onFileDrop?.(nativeFileDrop);
    const disposeClose = adapter.onCloseRequested?.(
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
    return () => {
      disposeDrop?.();
      disposeClose?.();
    };
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
  async function open(source?: string | File, locatePath?: string) {
    const path = typeof source === 'string' ? source : undefined;
    void abandonClaim();
    prepare();
    const generation = session.generation;
    const request = ++commandRequest;
    session.cancelReplacement();
    operation = true;
    try {
      const result =
        source instanceof File
          ? ((await adapter.openFile?.(source)) ?? {
              status: 'failure' as const,
              message: 'Use Open .takt file to open this project.',
            })
          : await adapter.open(path);
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
  function clearFileDrag() {
    dragDepth = 0;
    fileDrag = false;
  }
  function canDrop() {
    return !dropBlocked && !document.querySelector('dialog[open]');
  }
  function dropError(message: string) {
    session.error = message;
    revision++;
  }
  function acceptsDroppedFiles(names: string[]) {
    if (names.length !== 1) {
      dropError('Drop one .takt file at a time.');
      return false;
    }
    if (!/\.takt$/i.test(names[0])) {
      dropError('Drop a .takt project file.');
      return false;
    }
    return true;
  }
  function nativeFileDrop(event: ProjectFileDrop) {
    if (event.type === 'enter') {
      fileDrag = canDrop();
    } else if (event.type === 'drop') {
      clearFileDrag();
      if (!canDrop()) return;
      if (acceptsDroppedFiles(event.paths)) void open(event.paths[0]);
    } else if (event.type === 'failure') {
      clearFileDrag();
      dropError(event.message);
    } else clearFileDrag();
  }
  function fileTransfer(event: DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }
  function dragEnter(event: DragEvent) {
    if (!fileTransfer(event)) return;
    event.preventDefault();
    if (adapter.kind !== 'web' || !canDrop()) return;
    dragDepth++;
    fileDrag = true;
  }
  function dragOver(event: DragEvent) {
    if (!fileTransfer(event)) return;
    event.preventDefault();
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = canDrop() ? 'copy' : 'none';
    if (adapter.kind === 'web' && canDrop()) fileDrag = true;
  }
  function dragLeave(event: DragEvent) {
    if (!fileTransfer(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) fileDrag = false;
  }
  function dropFile(event: DragEvent) {
    if (!fileTransfer(event)) return;
    event.preventDefault();
    clearFileDrag();
    if (adapter.kind !== 'web' || !canDrop()) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (acceptsDroppedFiles(files.map((file) => file.name)))
      void open(files[0]);
  }
</script>

<svelte:window
  ondragenter={dragEnter}
  ondragover={dragOver}
  ondragleave={dragLeave}
  ondrop={dropFile}
  onblur={clearFileDrag}
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
    <header class="home-header">
      <div class="home-brand">
        <img src={taktMark} alt="" />Takt<span>.</span>
      </div>
      <span class="home-caption">A place for your plans</span>
    </header>
    <section class="welcome">
      <h1>Welcome to Takt</h1>
      <p>Give your next idea a timeline.</p>
    </section>
    <div class="home-columns">
      <section class="start" aria-labelledby="start-heading">
        <h2 id="start-heading">Start</h2>
        <button
          class="start-action"
          onclick={create}
          disabled={operation}
          aria-label="New project"
        >
          <span class="action-icon"><ProjectIcon name="new" /></span>
          <span class="action-text"
            ><strong>New project</strong><small
              >A blank canvas for your plan</small
            ></span
          >
          <kbd aria-hidden="true">{modifier} N</kbd>
        </button>
        <button
          class="start-action"
          onclick={() => void open()}
          disabled={operation}
          aria-label="Open .takt file"
        >
          <span class="action-icon"><ProjectIcon name="open" /></span>
          <span class="action-text"
            ><strong>Open .takt file</strong><small
              >Pick up where you left off</small
            ></span
          >
          <kbd aria-hidden="true">{modifier} O</kbd>
        </button>
        <p class="local-note">
          Your files stay on your device.<br />No account needed.
        </p>
        <button
          class="drop-zone"
          class:drag-active={fileDrag}
          disabled={dropBlocked}
          onclick={() => void open()}
          aria-label="Open a project by dropping a .takt file or browsing"
        >
          <ProjectIcon name="drop" />
          <strong>Drop a .takt file here</strong>
          <small>or click to browse</small>
        </button>
      </section>
      <div class="continue">
        {#if current.snapshot}<section class="drafts">
            <h2>Current project</h2>
            <button
              class="draft"
              onclick={() => {
                session.home = false;
                revision++;
              }}
              ><span class="list-icon"><ProjectIcon name="file" /></span><span
                class="project-text"
                ><strong>{current.snapshot.title}</strong><small
                  >Resume project</small
                ></span
              ><span class="resume-arrow"><ProjectIcon name="arrow" /></span
              ></button
            >
          </section>{/if}
        {#if availableDrafts.length}<section class="drafts">
            <h2>
              {adapter.kind === 'web' ? 'Resume draft' : 'Recover unsaved work'}
            </h2>
            {#each availableDrafts as record}<button
                class="draft"
                disabled={operation}
                onclick={() => resume(record)}
                ><span class="list-icon"><ProjectIcon name="clock" /></span
                ><span class="project-text"
                  ><strong>{record.snapshot.title}</strong><small
                    >{new Date(record.updatedAt).toLocaleString()}</small
                  ></span
                ><span class="resume-arrow"><ProjectIcon name="arrow" /></span
                ></button
              >{/each}
          </section>{/if}
        {#if adapter.kind === 'desktop' && recents.length}<section
            class="drafts"
          >
            <h2>Recent files</h2>
            {#each showAll ? recents : recents.slice(0, 10) as recent}<div
                class="recent-entry"
              >
                <button
                  class="draft"
                  disabled={operation}
                  title={recent.path}
                  onclick={() => void open(recent.path)}
                  ><span class="list-icon"><ProjectIcon name="file" /></span
                  ><span class="project-text"
                    ><strong>{recent.name}</strong><small>{recent.folder}</small
                    ></span
                  ></button
                ><button
                  class="remove-recent"
                  disabled={operation}
                  title="Remove from recents"
                  aria-label={`Remove ${recent.name} from recents`}
                  onclick={() =>
                    void adapter
                      .removeRecent?.(recent.path)
                      .then(() => adapter.listRecents?.())
                      .then((value) => (recents = value ?? []))}
                  ><ProjectIcon name="close" /></button
                >
              </div>{/each}{#if recents.length > 10}<button
                class="show-recents"
                onclick={() => (showAll = !showAll)}
                >{showAll ? 'Show latest ten' : 'Show all recent files'}</button
              >{/if}
          </section>{/if}
        {#if !hasProjects}
          <section class="empty-projects" aria-labelledby="empty-heading">
            <div class="mini-timeline" aria-hidden="true">
              <i></i><i></i><i></i><b></b>
            </div>
            <h2 id="empty-heading">Room for what’s next</h2>
            <p>
              {adapter.kind === 'desktop'
                ? 'Your recent projects will appear here.'
                : 'Create a project or open a .takt file to get started.'}
            </p>
            <small
              >{adapter.kind === 'desktop'
                ? 'Unsaved work can be recovered here, too.'
                : 'Locally retained drafts will be available here.'}</small
            >
          </section>
        {/if}
      </div>
    </div>
    <section class="quick-guide" aria-labelledby="guide-heading">
      <h2 id="guide-heading">A few simple moves</h2>
      <div class="guide-items">
        <div>
          <span class="gesture-mark bar-mark" aria-hidden="true"></span><strong
            >Draw your plan</strong
          >
          <p>Drag across a row to create a bar.</p>
        </div>
        <div>
          <span class="gesture-mark milestone-mark" aria-hidden="true"
          ></span><strong>Mark a moment</strong>
          <p>Double-click a row to add a milestone.</p>
        </div>
        <div>
          <span class="gesture-mark adjust-mark" aria-hidden="true"
          ></span><strong>Make it yours</strong>
          <p>Drag bars to move. Drag their ends to resize.</p>
        </div>
      </div>
    </section>
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
        active={!current.home && !shellDialog}
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
          </div>
        {/snippet}
        {#snippet fileMenuControls()}
          <div class="file-menu-wrap">
            <button
              class="file-trigger"
              aria-label="File"
              bind:this={fileButton}
              aria-haspopup="menu"
              aria-expanded={fileMenu}
              title="File commands"
              disabled={operation}
              onclick={() => (fileMenu = !fileMenu)}
              onkeydown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  fileMenu = true;
                }
              }}
              >File <svg
                class:expanded={fileMenu}
                viewBox="0 0 16 16"
                aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg
              ></button
            >
            {#if fileMenu}<div
                class="file-menu"
                use:focusFileMenu
                role="menu"
                tabindex="-1"
                onpointermove={(event) => {
                  const item = (
                    event.target as HTMLElement
                  ).closest<HTMLButtonElement>('button');
                  if (item && !item.disabled) item.focus();
                }}
                onkeydown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    fileMenu = false;
                    fileButton?.focus();
                  }
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const buttons = Array.from(
                      event.currentTarget.querySelectorAll<HTMLButtonElement>(
                        'button:not(:disabled)',
                      ),
                    );
                    const index = buttons.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    buttons[
                      (index +
                        (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
                        buttons.length
                    ]?.focus();
                  }
                  if (event.key === 'Tab') {
                    fileMenu = false;
                    fileButton?.focus();
                  }
                  if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    const buttons =
                      event.currentTarget.querySelectorAll<HTMLButtonElement>(
                        'button:not(:disabled)',
                      );
                    buttons[
                      event.key === 'Home' ? 0 : buttons.length - 1
                    ]?.focus();
                  }
                }}
              >
                <div class="menu-heading">Project</div>
                <MenuItem
                  icon="new"
                  disabled={operation}
                  shortcut={`${modifier} N`}
                  onclick={create}>New project</MenuItem
                >
                <MenuItem
                  icon="open"
                  disabled={operation}
                  shortcut={`${modifier} O`}
                  onclick={() => void open()}>Open .takt file</MenuItem
                >
                <div class="menu-divider" role="separator"></div>
                <MenuItem
                  icon={adapter.kind === 'web' ? 'download' : 'save'}
                  disabled={operation}
                  shortcut={`${modifier} S`}
                  onclick={() => void save()}>{saveLabel}</MenuItem
                >
                {#if adapter.kind === 'desktop'}<MenuItem
                    icon="save"
                    disabled={operation}
                    shortcut={`${modifier} ⇧ S`}
                    onclick={() => void save(true)}>Save As…</MenuItem
                  >{/if}
                <div class="menu-divider" role="separator"></div>
                <MenuItem icon="home" disabled={operation} onclick={home}
                  >Home</MenuItem
                >
              </div>{/if}
          </div>
        {/snippet}
      </Editor>
    {/key}
  </div>
{/if}
{#if fileDrag && !current.home && !dropBlocked}
  <div class="drop-overlay" role="status">
    <div class="drop-prompt">
      <ProjectIcon name="drop" />
      <h2>Drop to open your project</h2>
      <p>Open a .takt file</p>
    </div>
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
  .home {
    max-width: 1080px;
    margin: auto;
    padding: 0 34px 54px;
  }
  .home-header {
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
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
  .home-caption {
    color: var(--muted);
    font-size: 12px;
  }
  .welcome {
    margin: 54px 0 40px;
  }
  h1 {
    font-size: 36px;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: -1.1px;
    margin: 0 0 10px;
  }
  p {
    color: var(--muted);
    line-height: 1.6;
  }
  .welcome p {
    margin: 0;
    font-size: 16px;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 16px;
  }
  .home h2 {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 18px;
  }
  .home-columns {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    gap: 70px;
    min-height: 270px;
  }
  .start-action {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;
    padding: 13px 10px;
    margin: 0 0 4px -10px;
    border: 0;
    border-radius: 7px;
    text-align: left;
    background: transparent;
    cursor: pointer;
  }
  .start-action:hover:enabled {
    background: #e9edf2;
  }
  .action-icon {
    display: grid;
    place-items: center;
    color: var(--accent);
    width: 36px;
    height: 36px;
    background: #f8e9de;
    border-radius: 7px;
  }
  .action-text {
    flex: 1;
  }
  .action-text strong {
    display: block;
    color: var(--accent);
    font-size: 14px;
    font-weight: 600;
  }
  .action-text small {
    display: block;
    color: var(--muted);
    font-size: 12px;
    margin-top: 4px;
  }
  kbd {
    font-family: inherit;
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
  }
  .local-note {
    font-size: 12px;
    margin: 24px 0 0;
    line-height: 1.8;
  }
  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 114px;
    margin-top: 22px;
    padding: 18px;
    border: 1px dashed #b9c3ce;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .drop-zone strong {
    font-size: 12px;
    font-weight: 500;
    color: var(--ink);
  }
  .drop-zone small {
    font-size: 11px;
  }
  .drop-zone:hover:enabled,
  .drop-zone.drag-active {
    border-color: var(--accent);
    background: #f8e9de;
    color: var(--accent);
  }
  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    background: #182e471f;
    pointer-events: none;
    padding: 24px;
  }
  .drop-prompt {
    width: min(420px, 100%);
    padding: 42px 28px;
    text-align: center;
    border: 2px dashed var(--accent);
    border-radius: 12px;
    background: #fffaf5;
    box-shadow: 0 12px 36px #182e471f;
    color: var(--accent);
  }
  .drop-prompt h2 {
    margin: 18px 0 8px;
    font-size: 18px;
    color: var(--ink);
  }
  .drop-prompt p {
    margin: 0;
    font-size: 13px;
  }
  .continue {
    min-width: 0;
  }
  .drafts + .drafts {
    margin-top: 26px;
  }
  .drafts h2 {
    margin-bottom: 10px;
  }
  .draft {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 12px;
    text-align: left;
    padding: 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .draft:hover:enabled,
  .recent-entry:hover {
    background: #e9edf2;
  }
  .list-icon {
    display: flex;
    color: #7e8c9b;
  }
  .project-text {
    min-width: 0;
    flex: 1;
  }
  .project-text strong,
  .project-text small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .project-text strong {
    font-size: 13px;
    font-weight: 500;
  }
  .project-text small {
    margin-top: 3px;
    color: var(--muted);
    font-size: 11px;
  }
  .resume-arrow {
    display: flex;
    color: var(--muted);
  }
  .recent-entry {
    display: flex;
    align-items: center;
    border-radius: 6px;
  }
  .recent-entry .draft {
    padding-block: 8px;
  }
  .recent-entry .project-text {
    display: flex;
    align-items: baseline;
    gap: 18px;
  }
  .recent-entry .project-text strong {
    flex: 0 1 45%;
  }
  .recent-entry .project-text small {
    flex: 1;
    margin-top: 0;
  }
  .remove-recent {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin-right: 8px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--muted);
    opacity: 0;
    cursor: pointer;
  }
  .recent-entry:hover .remove-recent,
  .recent-entry:focus-within .remove-recent {
    opacity: 1;
  }
  .remove-recent:hover:enabled {
    background: var(--surface);
  }
  .show-recents {
    margin: 14px 0 0 10px;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
  }
  .show-recents:hover {
    text-decoration: underline;
  }
  .empty-projects {
    padding: 6px 0 20px;
  }
  .empty-projects h2 {
    margin: 22px 0 8px;
  }
  .empty-projects p {
    font-size: 13px;
    margin: 0 0 6px;
  }
  .empty-projects small {
    font-size: 12px;
    color: var(--muted);
  }
  .mini-timeline {
    position: relative;
    width: 240px;
    height: 98px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0 39px,
        var(--grid) 39px 40px
      ),
      var(--surface);
  }
  .mini-timeline i {
    position: absolute;
    height: 13px;
    border-radius: 3px;
  }
  .mini-timeline i:nth-child(1) {
    top: 18px;
    left: 16px;
    width: 94px;
    background: var(--bar-fill);
  }
  .mini-timeline i:nth-child(2) {
    top: 42px;
    left: 70px;
    width: 92px;
    background: var(--lavender);
  }
  .mini-timeline i:nth-child(3) {
    top: 66px;
    left: 133px;
    width: 76px;
    background: var(--sea-blue);
  }
  .mini-timeline b {
    position: absolute;
    top: 19px;
    left: 178px;
    width: 11px;
    height: 11px;
    background: var(--accent);
    transform: rotate(45deg);
    border-radius: 1px;
  }
  .quick-guide {
    margin-top: 46px;
    padding-top: 26px;
    border-top: 1px solid var(--line);
  }
  .quick-guide h2 {
    margin-bottom: 22px;
    color: var(--muted);
    font-size: 12px;
  }
  .guide-items {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 28px;
  }
  .guide-items strong {
    font-size: 12px;
    font-weight: 600;
  }
  .guide-items p {
    font-size: 12px;
    margin: 6px 0 0;
  }
  .gesture-mark {
    display: inline-block;
    width: 26px;
    height: 10px;
    margin-right: 10px;
    border-radius: 2px;
    background: var(--bar-fill);
    vertical-align: middle;
  }
  .milestone-mark {
    width: 9px;
    height: 9px;
    margin: 0 18px 0 7px;
    background: var(--lavender);
    transform: rotate(45deg);
  }
  .adjust-mark {
    background: var(--sea-blue);
    border-left: 2px solid #547e84;
    border-right: 2px solid #547e84;
  }
  .file-controls {
    display: flex;
    justify-content: center;
    min-width: 0;
  }
  .title-wrap {
    position: relative;
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
    right: -12px;
    top: 11px;
    font-size: 10px;
    color: var(--accent);
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
  .file-menu-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .file-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface);
    box-shadow: 0 1px 2px #182e4708;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .file-trigger:hover:enabled,
  .file-trigger[aria-expanded='true'] {
    background: var(--soft);
    border-color: #b9c3ce;
  }
  .file-trigger svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 150ms ease;
  }
  .file-trigger svg.expanded {
    transform: rotate(180deg);
  }
  .file-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 252px;
    z-index: 30;
    background: var(--surface);
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow:
      0 10px 30px #182e471f,
      0 2px 6px #182e470a;
  }
  .menu-heading {
    padding: 8px 9px 7px;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
  }
  .menu-divider {
    height: 1px;
    background: var(--line);
    margin: 5px 4px;
  }
  @media (max-width: 900px) {
    .home-columns {
      grid-template-columns: 280px minmax(0, 1fr);
      gap: 36px;
    }
    .guide-items {
      gap: 18px;
    }
  }
  @media (max-width: 680px) {
    .home {
      padding-inline: 24px;
    }
    .home-columns {
      grid-template-columns: 1fr;
      gap: 36px;
    }
    .start-action {
      max-width: 340px;
    }
    .welcome {
      margin-top: 36px;
    }
    h1 {
      font-size: 30px;
    }
    .home-caption {
      display: none;
    }
    .guide-items {
      grid-template-columns: 1fr;
      gap: 20px;
    }
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
