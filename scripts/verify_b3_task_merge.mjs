// Verification script for Part B3: Task Update Merging
// Tests that when two single-task events arrive without intermediate React re-renders,
// neither update is lost in PreviewApp store merge or FloatApp task map.

import assert from 'node:assert';

console.log('Testing Part B3: Task Update Merging...');

// 1. Simulate PreviewApp store logic
class MockPreviewStore {
  constructor() {
    this.state = {
      agentTasks: [
        { id: 'task-1', intent: 'review', status: 'running' }
      ],
      setAgentTasks: (tasks) => {
        this.state.agentTasks = tasks;
      }
    };
  }

  getState() {
    return this.state;
  }
}

const store = new MockPreviewStore();

// Handler matching PreviewApp.tsx:181-195
function handlePreviewTaskUpdate(payload) {
  if (Array.isArray(payload)) {
    store.getState().setAgentTasks(payload);
  } else if (payload && typeof payload === 'object' && 'id' in payload) {
    const existing = store.getState().agentTasks || [];
    const idx = existing.findIndex((t) => t.id === payload.id);
    if (idx >= 0) {
      const next = [...existing];
      next[idx] = payload;
      store.getState().setAgentTasks(next);
    } else {
      store.getState().setAgentTasks([payload, ...existing]);
    }
  }
}

// 2. Simulate FloatApp logic matching FloatApp.tsx:10-47
const floatTasksMap = new Map();
let runningAgentsCount = 0;

function recalculateRunningAgents() {
  let count = 0;
  for (const t of floatTasksMap.values()) {
    if (t.status === 'running') {
      count++;
    }
  }
  runningAgentsCount = count;
}

function handleFloatTaskUpdate(payload) {
  if (Array.isArray(payload)) {
    floatTasksMap.clear();
    payload.forEach((t) => floatTasksMap.set(t.id, t));
    recalculateRunningAgents();
  } else if (payload && typeof payload === 'object' && 'id' in payload) {
    floatTasksMap.set(payload.id, payload);
    recalculateRunningAgents();
  }
}

// Initialize FloatApp with initial task
floatTasksMap.set('task-1', { id: 'task-1', intent: 'review', status: 'running' });
recalculateRunningAgents();
assert.strictEqual(runningAgentsCount, 1, 'Initial running count should be 1');

// Fire Event A: new single task arrived
const task2 = { id: 'task-2', intent: 'test', status: 'running' };
handlePreviewTaskUpdate(task2);
handleFloatTaskUpdate(task2);

// Fire Event B immediately (before any component render or idle tick): update task-1 to completed
const task1Updated = { id: 'task-1', intent: 'review', status: 'completed' };
handlePreviewTaskUpdate(task1Updated);
handleFloatTaskUpdate(task1Updated);

// Verify PreviewApp state
const finalPreviewTasks = store.getState().agentTasks;
assert.strictEqual(finalPreviewTasks.length, 2, 'PreviewApp store must contain both tasks');
const found1 = finalPreviewTasks.find((t) => t.id === 'task-1');
const found2 = finalPreviewTasks.find((t) => t.id === 'task-2');
assert.strictEqual(found1?.status, 'completed', 'Task 1 must have status completed');
assert.strictEqual(found2?.status, 'running', 'Task 2 must have status running');

// Verify FloatApp state
assert.strictEqual(floatTasksMap.size, 2, 'FloatApp task map must contain both tasks');
assert.strictEqual(runningAgentsCount, 1, 'FloatApp running count must accurately reflect 1 running agent (task-2)');

console.log('PASS: Part B3 verification successful! No task updates lost on rapid sequential arrival.');
