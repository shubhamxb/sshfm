import { ref } from 'vue';

// Global operation queue — shared across components
const operations = ref([]);
let opId = 0;

export function useFileOps() {
  function addOp(label) {
    const id = ++opId;
    operations.value.push({ id, label, done: false });
    return id;
  }
  function finishOp(id) {
    const op = operations.value.find(o => o.id === id);
    if (op) op.done = true;
    // remove after 3s
    setTimeout(() => {
      operations.value = operations.value.filter(o => o.id !== id);
    }, 3000);
  }
  function activeOps() {
    return operations.value.filter(o => !o.done);
  }
  return { operations, addOp, finishOp, activeOps };
}
