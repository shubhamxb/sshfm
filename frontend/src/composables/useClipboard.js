import { reactive, readonly } from 'vue';

const state = reactive({ mode: null, files: [], sourcePath: '' });

export function useClipboard() {
  function copy(files, sourcePath) {
    state.mode = 'copy';
    state.files = [...files];
    state.sourcePath = sourcePath;
  }
  function cut(files, sourcePath) {
    state.mode = 'cut';
    state.files = [...files];
    state.sourcePath = sourcePath;
  }
  function clear() {
    state.mode = null;
    state.files = [];
    state.sourcePath = '';
  }
  function isCut(fileName) {
    return state.mode === 'cut' && state.files.some(f => f.name === fileName);
  }
  return { clipboard: readonly(state), copy, cut, clear, isCut };
}
