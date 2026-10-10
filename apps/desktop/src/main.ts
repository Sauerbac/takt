import { mount } from 'svelte';
import App from '../../web/src/App.svelte';
import '../../web/src/tokens.css';
import { desktopAdapter } from './platform';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
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
        requestClose: () => getCurrentWindow().close(),
      },
    });
  })
  .catch(() => {});
