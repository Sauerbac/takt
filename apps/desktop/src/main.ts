import { mount } from 'svelte';
import App from '../../web/src/App.svelte';
import '../../web/src/tokens.css';
import { desktopAdapter } from './platform';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { emitTo, TauriEvent } from '@tauri-apps/api/event';
import { encodeProject, parseProject } from '../../web/src/project/format';
mount(App, {
  target: document.getElementById('app')!,
  props: { adapter: desktopAdapter },
});
// Acceptance bridge exists only when the native process was explicitly started in test mode.
void invoke<string>('integration_path')
  .then((path) => {
    Object.assign(window, {
      __TAKT_TEST__: {
        path,
        adapter: desktopAdapter,
        encodeProject,
        parseProject,
        emitFileDrop: (type: 'enter' | 'leave' | 'drop', paths: string[]) =>
          emitTo(
            { kind: 'Webview', label: getCurrentWebview().label },
            {
              enter: TauriEvent.DRAG_ENTER,
              leave: TauriEvent.DRAG_LEAVE,
              drop: TauriEvent.DRAG_DROP,
            }[type],
            { paths, position: { x: 64, y: 64 } },
          ),
        requestClose: () => getCurrentWindow().close(),
      },
    });
  })
  .catch(() => {});
