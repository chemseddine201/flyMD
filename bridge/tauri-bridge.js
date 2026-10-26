(function () {
  if (window.electronAPI) {
    return;
  }

  const tauriCore = window.__TAURI__ ? window.__TAURI__.core : null;
  const tauriEvent = window.__TAURI__ ? window.__TAURI__.event : null;

  function invoke(cmd, args) {
    if (window.__TAURI__ && window.__TAURI__.core) {
      return window.__TAURI__.core.invoke(cmd, args);
    }
    return Promise.reject(new Error('Tauri core not initialized'));
  }

  function makeEventListener(eventName, mapper) {
    return function (callback) {
      let unlistenFn = null;
      let isDisposed = false;
      if (window.__TAURI__ && window.__TAURI__.event) {
        window.__TAURI__.event.listen(eventName, function (event) {
          const data = mapper ? mapper(event.payload) : event.payload;
          try {
            callback(data);
          } catch (e) {
            console.error('Error in event listener for ' + eventName + ':', e);
          }
        }).then(function (unlisten) {
          if (isDisposed) {
            unlisten();
          } else {
            unlistenFn = unlisten;
          }
        });
      }
      return function unsubscribe() {
        isDisposed = true;
        if (unlistenFn) {
          unlistenFn();
        }
      };
    };
  }

  const filePathMap = new WeakMap();

  if (window.__TAURI__ && window.__TAURI__.event) {
    window.__TAURI__.event.listen('tauri://drag-drop', function (event) {
      const paths = (event.payload && event.payload.paths) ? event.payload.paths : [];
      if (paths.length > 0) {
        const firstPath = paths[0];
        const name = firstPath.split(/[\/\\]/).pop() || 'file.md';
        const fakeFile = new File([], name);
        filePathMap.set(fakeFile, firstPath);

        const dt = new DataTransfer();
        dt.items.add(fakeFile);
        const dropEvt = new DragEvent('drop', {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(dropEvt);
      }
    });

    window.__TAURI__.event.listen('tauri://drag-enter', function () {
      const enterEvt = new DragEvent('dragenter', { bubbles: true, cancelable: true });
      window.dispatchEvent(enterEvt);
    });

    window.__TAURI__.event.listen('tauri://drag-leave', function () {
      const leaveEvt = new DragEvent('dragleave', { bubbles: true, cancelable: true });
      window.dispatchEvent(leaveEvt);
    });
  }

  const electronAPI = {
    // File operations
    openFileDialog: function () {
      return invoke('cmd_open_file_dialog');
    },
    readFile: function (filePath) {
      return invoke('cmd_read_file', { filePath: filePath });
    },
    saveFile: function (filePath, content) {
      return invoke('cmd_save_file', { filePath: filePath, content: content });
    },
    saveFileDialog: function (defaultName, content, filters) {
      return invoke('cmd_save_file_dialog', {
        defaultName: defaultName,
        content: content,
        filters: filters || [],
      });
    },
    exportPdf: function (defaultName, htmlContent) {
      return invoke('cmd_export_pdf', {
        defaultName: defaultName,
        htmlContent: htmlContent,
      });
    },
    getPathForFile: function (file) {
      if (file && filePathMap.has(file)) {
        return filePathMap.get(file);
      }
      return (file && file.path) ? file.path : '';
    },

    // History operations
    getHistory: function () {
      return invoke('cmd_get_history');
    },
    addHistory: function (item) {
      return invoke('cmd_add_history', { item: item });
    },
    removeHistory: function (id) {
      return invoke('cmd_remove_history', { id: id });
    },
    clearHistory: function () {
      return invoke('cmd_clear_history');
    },
    onHistoryUpdated: makeEventListener('history:updated'),

    // Float Hub & Window Management
    toggleFloatAlwaysOnTop: function () {
      return invoke('cmd_toggle_float_pin');
    },
    getFloatAlwaysOnTop: function () {
      return invoke('cmd_get_float_pin');
    },
    togglePreviewAlwaysOnTop: function () {
      return invoke('cmd_toggle_preview_pin');
    },
    getPreviewAlwaysOnTop: function () {
      return invoke('cmd_get_preview_pin');
    },
    minimizeWindow: function () {
      invoke('cmd_minimize_window');
    },
    maximizeWindow: function () {
      invoke('cmd_maximize_window');
    },
    closeWindow: function () {
      invoke('cmd_close_window');
    },
    moveFloatWindow: function (deltaX, deltaY) {
      invoke('cmd_move_float_window', { deltaX: deltaX, deltaY: deltaY });
    },
    getFloatPosition: function () {
      return invoke('cmd_get_float_position');
    },
    setFloatPosition: function (x, y) {
      invoke('cmd_set_float_position', { x: x, y: y });
    },
    setFloatExpanded: function (expanded) {
      invoke('cmd_set_float_expanded', { expanded: expanded });
    },
    hideFloatWindow: function () {
      return invoke('cmd_hide_float_window');
    },
    saveFloatPosition: function () {
      return invoke('cmd_save_float_position');
    },

    // Preview & Navigation
    openInPreview: function (filePath) {
      return invoke('cmd_open_in_preview', { filePath: filePath });
    },
    onFileLoaded: makeEventListener('preview:file-loaded'),
    onFolderLoaded: makeEventListener('preview:folder-loaded', function (payload) {
      if (!payload) return { folderPath: '', folderName: '', files: [] };
      return {
        folderPath: payload.folderPath || payload.path || '',
        folderName: payload.folderName || payload.name || 'Folder',
        files: payload.files || []
      };
    }),

    // Settings
    getSettings: function () {
      return invoke('cmd_get_settings');
    },
    saveSettings: function (settings) {
      return invoke('cmd_save_settings', { settings: settings });
    },
    onSettingsChanged: makeEventListener('settings:changed'),

    // Folder Supervision & Tree Scan
    openFolderDialog: function () {
      return invoke('cmd_open_folder_dialog');
    },
    scanFolder: function (dirPath, scanMode) {
      return invoke('cmd_scan_folder', { dirPath: dirPath, scanMode: scanMode });
    },
    setSupervision: function (config) {
      return invoke('cmd_set_supervision', { config: config });
    },
    getSupervision: function () {
      return invoke('cmd_get_supervision');
    },
    onSupervisedFileEvent: makeEventListener('workspace:file-event'),
    onSupervisedTreeUpdated: makeEventListener('workspace:tree-updated'),

    getOllamaModels: function (config) {
      return invoke('cmd_llm_get_models', { config: config || {} });
    },
    testLlmConnection: function (config) {
      return invoke('cmd_llm_test_connection', { config: config || {} });
    },
    startTranslation: function (req) {
      invoke('cmd_llm_start_translation', { req: req });
    },
    abortTranslation: function () {
      invoke('cmd_llm_abort_translation');
    },
    onTranslationChunk: makeEventListener('llm:translate:chunk'),
    onTranslationComplete: makeEventListener('llm:translate:done'),

    // Multi-Agent Workspace Supervisor
    discoverAgents: function () {
      return invoke('cmd_discover_agents');
    },
    saveAgentCredential: function (agentId, credential) {
      return invoke('cmd_save_agent_credential', { agentId: agentId, credential: credential });
    },
    getAgentCredentials: function () {
      return invoke('cmd_get_agent_credentials');
    },
    launchAgentLogin: function (agentId) {
      return invoke('cmd_launch_agent_login', { agentId: agentId });
    },
    launchAgentWebAuth: function (agentId, taskPrompt, taskId) {
      return invoke('cmd_launch_agent_web_auth', {
        agentId: agentId,
        taskPrompt: taskPrompt || null,
        taskId: taskId || null,
      });
    },
    dispatchAgentTask: function (request) {
      return invoke('cmd_dispatch_agent_task', { request: request });
    },
    getAgentTasks: function () {
      return invoke('cmd_get_agent_tasks');
    },
    cancelAgentTask: function (taskId) {
      return invoke('cmd_cancel_agent_task', { taskId: taskId });
    },
    clearAgentTasks: function () {
      return invoke('cmd_clear_agent_tasks');
    },
    getAgentCheckpoints: function () {
      return invoke('cmd_get_agent_checkpoints');
    },
    restoreAgentCheckpoint: function (checkpointId) {
      return invoke('cmd_restore_agent_checkpoint', { checkpointId: checkpointId });
    },
    removeAgentProfile: function (agentId) {
      return invoke('cmd_remove_agent_profile', { agentId: agentId });
    },
    completeWebTaskWithReply: function (taskId, replyMarkdown) {
      return invoke('cmd_complete_web_task_with_reply', {
        taskId: taskId,
        replyMarkdown: replyMarkdown,
      });
    },
    clearAgentTaskLogs: function (taskId) {
      return invoke('cmd_clear_agent_task_logs', { taskId: taskId });
    },
    deleteAgentTask: function (taskId) {
      return invoke('cmd_delete_agent_task', { taskId: taskId });
    },
    revealInExplorer: function (targetPath) {
      return invoke('cmd_reveal_in_explorer', { targetPath: targetPath });
    },
    deleteFilePath: function (targetPath) {
      return invoke('cmd_delete_file_path', { targetPath: targetPath });
    },
    openExternalPath: function (targetPath) {
      return invoke('cmd_open_external_path', { targetPath: targetPath });
    },
    clearWorkspaceCache: function (workspacePath, clearMemory) {
      return invoke('cmd_clear_workspace_cache', {
        workspacePath: workspacePath,
        clearMemory: clearMemory,
      });
    },
    onAgentProfilesUpdated: makeEventListener('agent:profiles-updated'),
    onAgentTasksUpdated: makeEventListener('agent:tasks-updated'),
    onAgentCheckpointsUpdated: makeEventListener('agent:checkpoints-updated'),
    onAgentStream: makeEventListener('agent:stream'),
  };

  window.electronAPI = electronAPI;
  console.log('[TauriBridge] window.electronAPI successfully injected');
})();

