import { mount } from 'svelte';
import Editor from './components/Editor.svelte';
import './tokens.css';

mount(Editor, { target: document.getElementById('app')! });
