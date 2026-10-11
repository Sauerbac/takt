<script lang="ts">
  import { onMount } from 'svelte';
  import Editor from './components/Editor.svelte';
  import Dialog from './components/Dialog.svelte';
  import Button from './components/Button.svelte';
  import MenuItem from './components/MenuItem.svelte';
  import ProjectIcon from './components/ProjectIcon.svelte';
  import TitleField from './components/TitleField.svelte';
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
      // The header names the file a desktop project is saved in.
      fileName: session.file?.path.split(/[\\/]/).pop(),
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
  // Browsers keep Ctrl/Cmd+N for their own new window, so the web app does not advertise it.
  // svelte-ignore state_referenced_locally
  const newShortcut = adapter.kind === 'web' ? undefined : `${modifier} N`;
  let pending: (() => void) | undefined;
  let recoveryClaim: {
    claimed: RecoveryRecord;
    source: RecoveryRecord;
  } | null = null;
  let closeResolve: ((allowed: boolean) => void) | undefined;
  let missing = $state<RecentFile | null>(null);
  let unreadable = $state<RecentFile | null>(null);
  let draftRemoval = $state<RecoveryRecord | null>(null);
  const draftTime = (updatedAt: string) =>
    new Date(updatedAt).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  const shellDialog = $derived(
    guard ||
      conflict ||
      reloadConfirm ||
      missing !== null ||
      unreadable !== null ||
      draftRemoval !== null,
  );
  const dropBlocked = $derived(operation || shellDialog);
  const saveLabel = $derived(
    adapter.kind === 'web' ? 'Download .takt' : 'Save',
  );
  function commitTitle() {
    title = title.trim() || 'Untitled';
    if (session.snapshot) session.update({ ...session.snapshot, title });
  }
  onMount(() => {
    void session.initialize();
    void refreshRecents();
    const disposeDrop = adapter.onFileDrop?.(nativeFileDrop);
    const disposeClose = adapter.onCloseRequested?.(
      () =>
        new Promise((resolve) => {
          const offerGuard = () => {
            closeResolve = resolve;
            guard = true;
            pending = () => resolve(true);
          };
          prepare();
          if (session.modified) return offerGuard();
          // Removing recovery is best effort: a window must always be closable.
          // The editor stays usable meanwhile, so an edit made during removal is guarded.
          void session.discard().finally(() => {
            prepare();
            if (session.modified) offerGuard();
            else resolve(true);
          });
        }),
    );
    return () => {
      disposeDrop?.();
      disposeClose?.();
    };
  });
  async function refreshRecents() {
    try {
      recents = (await adapter.listRecents?.()) ?? [];
    } catch {
      // Recent history is a convenience; Open still works without it.
    }
  }
  async function removeRecent(path: string) {
    try {
      await adapter.removeRecent?.(path);
    } catch {
      session.error = 'Could not remove this entry from recent files.';
      revision++;
    }
    await refreshRecents();
  }
  function prepare() {
    fileMenu = false;
    if (!session.snapshot) return;
    const prepared = editor?.prepareFile();
    title = title.trim() || 'Untitled';
    session.update({ ...session.snapshot, title, ...(prepared ?? {}) });
    void session.flush();
  }
  async function replace(opened: OpenedProject) {
    session.replace(opened);
    title = opened.snapshot.title;
    if (!opened.file || !adapter.rememberRecent) return;
    // Recent history records files that were really opened, not cancelled picks.
    await adapter.rememberRecent(opened.file.path).catch(() => {});
    await refreshRecents();
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
  async function continueGuard() {
    const action = pending;
    const generation = session.generation;
    // A close proceeds even when its recovery copy could not be removed.
    const closing = !!closeResolve;
    if (!(await session.discard()) && !closing) return;
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
    guarded(() => void replace({ snapshot: newProject() }));
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
  async function removeDraft(record: RecoveryRecord) {
    draftRemoval = null;
    operation = true;
    try {
      await adapter.removeRecovery(record.id);
    } catch {
      session.error =
        adapter.kind === 'web'
          ? 'Could not delete this draft. It may be open in another tab.'
          : 'Could not delete this unsaved work. It may be open in another window.';
      revision++;
    } finally {
      operation = false;
    }
    await session.refreshDrafts();
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
          await replace(result.value);
          if (locatePath) {
            await adapter.removeRecent?.(locatePath);
            await refreshRecents();
          }
        });
      else if (result.status === 'failure') {
        session.error = result.message;
        revision++;
        const recent = path && recents.find((item) => item.path === path);
        if (recent && result.invalid) unreadable = recent;
        else if (recent) missing = recent;
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
        await continueGuard();
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
        void replace(result.value);
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
    } else await continueGuard();
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
    await continueGuard();
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
        void refreshRecents();
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
    if (operation || shellDialog) return;
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
    <section class="home-start">
      <div class="home-brand">
        <svg viewBox="0 0 32 32" aria-hidden="true"
          ><rect x="3" y="5" width="15" height="6" rx="1.5" /><rect
            x="9"
            y="13"
            width="17"
            height="6"
            rx="1.5"
            opacity="0.75"
          /><rect
            x="14"
            y="21"
            width="15"
            height="6"
            rx="1.5"
            opacity="0.55"
          /></svg
        >Takt.
      </div>
      <div class="home-art" aria-hidden="true">
        <i></i><i></i><i></i><b></b>
      </div>
      <h1>Welcome to Takt</h1>
      <button class="new-project" onclick={create} disabled={operation}>
        <svg viewBox="0 0 16 16" aria-hidden="true"
          ><path d="M8 3v10M3 8h10" /></svg
        >
        <strong>New project</strong>
        {#if newShortcut}<kbd aria-hidden="true">{newShortcut}</kbd>{/if}
      </button>
      <button
        class="drop-zone"
        class:drag-active={fileDrag}
        disabled={dropBlocked}
        onclick={() => void open()}
        aria-label="Open .takt file"
      >
        <ProjectIcon name="open" />
        <strong>Open .takt file</strong>
        <span>Drop a file here or click to browse</span>
        <kbd aria-hidden="true">{modifier} O</kbd>
      </button>
    </section>
    <div class="home-projects">
      {#if current.snapshot}<section class="drafts">
          <h2>Current project</h2>
          <button
            class="draft current-project"
            onclick={() => {
              session.home = false;
              revision++;
            }}
            ><span class="project-art" aria-hidden="true"
              ><i></i><i></i><i></i></span
            ><span class="project-text"
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
          {#each availableDrafts as record}<div class="draft-entry">
              <button
                class="draft"
                disabled={operation}
                onclick={() => resume(record)}
                ><span class="list-icon"><ProjectIcon name="clock" /></span
                ><span class="project-text"
                  ><strong>{record.snapshot.title}</strong><small
                    >{draftTime(record.updatedAt)}</small
                  ></span
                ></button
              ><button
                class="remove-recent"
                disabled={operation}
                title="Delete"
                aria-label={`Delete ${record.snapshot.title} from ${draftTime(record.updatedAt)}`}
                onclick={() => (draftRemoval = record)}
                ><ProjectIcon name="close" /></button
              >
            </div>{/each}
        </section>{/if}
      {#if adapter.kind === 'desktop' && recents.length}<section class="drafts">
          <h2>Recent files</h2>
          {#each showAll ? recents : recents.slice(0, 10) as recent}<div
              class="recent-entry"
            >
              <button
                class="draft"
                disabled={operation}
                title={recent.path}
                onclick={() => void open(recent.path)}
                ><span class="project-text"
                  ><strong>{recent.name}</strong><small>{recent.folder}</small
                  ></span
                ></button
              ><button
                class="remove-recent"
                disabled={operation}
                title="Remove from recents"
                aria-label={`Remove ${recent.name} from recents`}
                onclick={() => void removeRecent(recent.path)}
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
            <TitleField
              bind:value={title}
              label="Project title"
              hint={current.fileName
                ? `${current.fileName} · Rename project`
                : 'Rename project'}
              modified={current.modified}
              oncommit={commitTitle}
              oncancel={() => (title = session.snapshot?.title ?? 'Untitled')}
            />
          </div>
        {/snippet}
        {#snippet fileMenuControls()}
          <Button
            variant="primary"
            disabled={operation}
            title={saveLabel}
            onclick={() => void save()}
            >{adapter.kind === 'web' ? 'Download' : 'Save'}<kbd
              class="save-hint"
              aria-hidden="true">{modifier} S</kbd
            ></Button
          >
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
                  shortcut={newShortcut}
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
<div class="toasts">
  {#if current.warning}<div class="warning" role="status">
      {current.warning}<button
        onclick={() =>
          void session.persist().then(() => session.refreshDrafts())}
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
</div>
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
          onclick={() => void continueGuard()}>Discard changes</Button
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
{#if draftRemoval}<Dialog
    titleId="draft-removal-title"
    onclose={() => (draftRemoval = null)}
    ><h2 id="draft-removal-title">
      {adapter.kind === 'web' ? 'Delete this draft?' : 'Delete unsaved work?'}
    </h2>
    <p>
      “{draftRemoval.snapshot.title}” from {draftTime(draftRemoval.updatedAt)} will
      be removed permanently.
    </p>
    <div class="dialog-actions">
      <Button onclick={() => (draftRemoval = null)}>Cancel</Button><Button
        variant="primary"
        onclick={() => void removeDraft(draftRemoval!)}>Delete</Button
      >
    </div></Dialog
  >{/if}
{#if unreadable}<Dialog
    titleId="unreadable-title"
    onclose={() => (unreadable = null)}
    ><h2 id="unreadable-title">File can’t be opened</h2>
    <p>{unreadable.path}</p>
    <p>This file is not a valid Takt project.</p>
    <div class="dialog-actions">
      <Button onclick={() => (unreadable = null)}>Cancel</Button><Button
        variant="primary"
        onclick={() => {
          const path = unreadable!.path;
          unreadable = null;
          void removeRecent(path);
        }}>Remove from recents</Button
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
          void removeRecent(path);
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
    min-height: 100dvh;
    display: flex;
    flex-wrap: wrap;
    background: var(--background);
  }
  .home-start {
    flex: 1 1 380px;
    max-width: 520px;
    min-height: 520px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px 40px 40px;
    background: var(--accent);
    color: var(--on-accent);
  }
  .home-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.5px;
  }
  .home-brand svg {
    width: 22px;
    height: 22px;
    fill: currentColor;
  }
  .home-art {
    position: relative;
    height: 64px;
    margin-top: auto;
  }
  .home-art i,
  .home-art b {
    position: absolute;
    background: currentColor;
  }
  .home-art i {
    height: 16px;
    border-radius: var(--radius-sm);
  }
  .home-art i:nth-child(1) {
    top: 0;
    left: 0;
    width: 44%;
  }
  .home-art i:nth-child(2) {
    top: 24px;
    left: 26%;
    width: 38%;
    opacity: 0.7;
  }
  .home-art i:nth-child(3) {
    top: 48px;
    left: 48%;
    width: 40%;
    opacity: 0.5;
  }
  .home-art b {
    top: 50px;
    right: 6px;
    width: 12px;
    height: 12px;
    border-radius: 2px;
    transform: rotate(45deg);
  }
  h1 {
    margin: 28px 0 16px;
    font-size: 40px;
    line-height: 1.05;
    font-weight: 600;
    letter-spacing: -1.4px;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.3px;
  }
  p {
    margin: 0;
    color: var(--muted);
    line-height: 1.6;
  }
  kbd {
    font-family: inherit;
    font-size: 11px;
    white-space: nowrap;
  }
  .new-project,
  .drop-zone {
    border-radius: var(--radius-lg);
    cursor: pointer;
  }
  .new-project:focus-visible,
  .drop-zone:focus-visible {
    outline: 2px solid var(--on-accent);
    outline-offset: 2px;
  }
  .new-project {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 18px;
    border: 0;
    background: var(--surface);
    color: var(--accent-deep);
    text-align: left;
    box-shadow: 0 2px 6px #3c190a40;
  }
  .new-project:hover:enabled {
    background: var(--accent-soft);
  }
  .new-project svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .new-project strong {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
  }
  .new-project kbd {
    padding: 2px 6px;
    border: 1px solid var(--accent-line);
    border-radius: var(--radius-sm);
  }
  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 168px;
    padding: 16px;
    border: 1.5px dashed #ffffffbf;
    background: #ffffff14;
    color: inherit;
    font-size: 12px;
  }
  .drop-zone strong {
    font-size: 15px;
    font-weight: 600;
  }
  .drop-zone kbd {
    margin-top: 4px;
    padding: 2px 6px;
    border: 1px solid #fff9;
    border-radius: var(--radius-sm);
  }
  .drop-zone:hover:enabled,
  .drop-zone.drag-active {
    border-style: solid;
    border-color: var(--on-accent);
    background: #ffffff2e;
  }
  .home-projects {
    flex: 999 1 460px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 30px;
    padding: 48px 56px;
  }
  .drafts,
  .empty-projects {
    width: 100%;
    max-width: 600px;
  }
  .home-projects h2 {
    margin: 0 0 10px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
  }
  .draft {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-width: 0;
    min-height: 46px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  .project-text {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .project-text strong,
  .project-text small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .project-text strong {
    font-size: 13px;
    font-weight: 500;
  }
  .project-text small {
    color: var(--muted);
    font-size: 12px;
  }
  .current-project {
    gap: 16px;
    min-height: 84px;
    padding: 0 20px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    box-shadow: var(--shadow-xs);
  }
  .current-project:hover {
    border-color: var(--line-strong);
    background: var(--soft);
  }
  .current-project .project-text {
    display: block;
  }
  .current-project strong {
    display: block;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.3px;
  }
  .project-art {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 56px;
  }
  .project-art i {
    height: 7px;
    border-radius: 2px;
    background: var(--bar-fill);
  }
  .project-art i:nth-child(1) {
    width: 60%;
  }
  .project-art i:nth-child(2) {
    width: 55%;
    margin-left: 25%;
    background: var(--lavender);
  }
  .project-art i:nth-child(3) {
    width: 45%;
    margin-left: 55%;
    background: var(--sea-blue);
  }
  .resume-arrow,
  .list-icon {
    display: flex;
    color: var(--accent);
  }
  .draft-entry,
  .recent-entry {
    display: flex;
    align-items: center;
  }
  .draft-entry {
    border: 1px solid var(--accent-line);
    border-radius: var(--radius-lg);
    background: var(--accent-soft);
  }
  .draft-entry + .draft-entry {
    margin-top: 8px;
  }
  .draft-entry .project-text strong {
    flex: 1;
  }
  .recent-entry {
    border-bottom: 1px solid var(--line);
  }
  .recent-entry .draft {
    padding-inline: 0;
    border-radius: 0;
  }
  .recent-entry .project-text strong {
    flex: 0 1 48%;
  }
  .recent-entry .project-text small {
    flex: 1;
  }
  .draft-entry:hover,
  .recent-entry:hover .draft:enabled {
    color: var(--accent-deep);
  }
  .remove-recent {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    margin-right: 6px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted);
    opacity: 0;
    cursor: pointer;
  }
  .draft-entry:hover .remove-recent,
  .draft-entry:focus-within .remove-recent,
  .recent-entry:hover .remove-recent,
  .recent-entry:focus-within .remove-recent {
    opacity: 1;
  }
  .remove-recent:hover:enabled {
    background: var(--soft);
    color: var(--ink);
  }
  .show-recents {
    margin-top: 10px;
    padding: 4px 0;
    border: 0;
    background: transparent;
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
  }
  .show-recents:hover {
    text-decoration: underline;
  }
  .empty-projects h2 {
    margin-bottom: 8px;
    color: var(--ink);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.3px;
  }
  .empty-projects p {
    margin-bottom: 4px;
  }
  .empty-projects small {
    color: var(--muted);
    font-size: 12px;
  }
  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 24px;
    background: var(--backdrop);
    pointer-events: none;
  }
  .drop-prompt {
    width: min(420px, 100%);
    padding: 40px 28px;
    border: 2px dashed var(--accent);
    border-radius: var(--radius-xl);
    background: var(--accent-soft);
    box-shadow: var(--shadow-float);
    color: var(--accent);
    text-align: center;
  }
  .drop-prompt h2 {
    margin: 16px 0 8px;
    color: var(--ink);
  }
  .file-controls {
    display: flex;
    justify-content: center;
    min-width: 0;
  }
  .file-menu-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .file-trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-xs);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
  .file-trigger:hover:enabled,
  .file-trigger[aria-expanded='true'] {
    background: var(--soft);
    border-color: var(--line-strong);
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
    z-index: 30;
    width: 252px;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-float);
  }
  .menu-heading {
    padding: 8px 9px 7px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
  }
  .menu-divider {
    height: 1px;
    margin: 5px 4px;
    background: var(--line);
  }
  .toasts {
    position: fixed;
    z-index: 50;
    top: 70px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(640px, 100% - 40px);
    margin-inline: auto;
    pointer-events: none;
  }
  .warning,
  .error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    border: 1px solid var(--accent-line);
    border-radius: var(--radius-lg);
    background: var(--accent-soft);
    box-shadow: var(--shadow-float);
    color: var(--ink);
    font-size: 13px;
    pointer-events: auto;
  }
  .warning button,
  .error button {
    border: 0;
    background: transparent;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }
  .dialog-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
  }
  @media (max-width: 760px) {
    .home-start {
      max-width: none;
      min-height: 0;
      padding: 24px;
    }
    .home-art {
      margin-top: 24px;
    }
    .home-projects {
      justify-content: flex-start;
      padding: 32px 24px 48px;
    }
    h1 {
      font-size: 32px;
    }
  }
  @media (max-width: 900px) {
    /* Without its shortcut hint the Save button leaves the title centred. */
    .save-hint {
      display: none;
    }
  }
</style>
