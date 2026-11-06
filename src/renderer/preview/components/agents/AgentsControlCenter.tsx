import React from 'react';
import { Check } from 'lucide-react';
import { AgentStudioSidebar } from './studio/AgentStudioSidebar';
import { AgentChatTimeline } from './studio/AgentChatTimeline';
import { AgentProgressInspector } from './studio/AgentProgressInspector';
import { DiscussionStudio } from './studio/DiscussionStudio';
import { ProjectTreeNavigator } from './projects/ProjectTreeNavigator';
import { ProjectObservabilityHUD } from './projects/ProjectObservabilityHUD';
import { ProjectSynthesisReportViewer } from './projects/ProjectSynthesisReportViewer';
import { CustomPipelineActionsModal } from './studio/CustomPipelineActionsModal';
import { ClearWorkspaceCacheModal } from './modals/ClearWorkspaceCacheModal';
import { PipelineRecoveryModal } from './modals/PipelineRecoveryModal';
import { StudioTopHeaderBar } from './control-center/StudioTopHeaderBar';
import { PipelineStatusBanners } from './control-center/PipelineStatusBanners';
import { useAgentStudioController } from './control-center/useAgentStudioController';
import { RecoveryModalDecision } from '../../services/pipelineExecutionService';

export type { RecoveryModalDecision };

interface AgentsControlCenterProps {
  folderPath?: string;
  activeTab?: { id: string; filePath?: string; title?: string };
  supervisionConfig?: any;
}

export const AgentsControlCenter: React.FC<AgentsControlCenterProps> = (props) => {
  const ctrl = useAgentStudioController(props);

  const activeFileName =
    ctrl.workspaceFocusMode === 'workspace'
      ? `Entire Project (${
          ctrl.resolvedWorkspace
            ? ctrl.resolvedWorkspace.split(/[\\/]/).pop()
            : 'Root'
        })`
      : ctrl.focusFilePath
      ? ctrl.cleanWorkspaceFilesByPath.get(ctrl.focusFilePath)?.name ||
        ctrl.focusFilePath.split(/[\\/]/).pop() ||
        'Focused File'
      : ctrl.activeTab?.fileName || 'Workspace Specification';

  const activeFilePath =
    ctrl.workspaceFocusMode === 'workspace'
      ? ctrl.resolvedWorkspace
      : ctrl.focusFilePath ||
        ctrl.activeTab?.filePath ||
        ctrl.cleanWorkspaceFiles[0]?.path ||
        '';

  return (
    <div className="flex-1 h-full flex flex-col bg-[#f9f9f9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <StudioTopHeaderBar
        resolvedWorkspace={ctrl.resolvedWorkspace}
        showProjectTree={ctrl.showProjectTree}
        onToggleProjectTree={() => ctrl.setShowProjectTree(!ctrl.showProjectTree)}
        activeProject={ctrl.activeProject}
        lifecycleStage={ctrl.lifecycleStage}
        onSelectLifecycleStage={ctrl.setLifecycleStage}
        workspaceFocusMode={ctrl.workspaceFocusMode}
        focusFilePath={ctrl.focusFilePath}
        activeTabFilePath={ctrl.activeTab?.filePath}
        cleanWorkspaceFiles={ctrl.cleanWorkspaceFiles}
        onChangeTargetScope={(mode, filePath) => {
          ctrl.setWorkspaceFocusMode(mode);
          ctrl.setFocusFilePath(filePath);
        }}
        onOpenAdvancedDispatchModal={() => {
          ctrl.setShowCouncilModal(false);
          ctrl.setShowAgentAccountsModal(false);
          ctrl.openDispatchModal({
            targetAgentId: ctrl.selectedAgentId,
            sourceFilePath: ctrl.activeTab?.filePath || '',
            sourceFileName: ctrl.activeTab?.fileName || 'Specification.md',
            markdownContent: ctrl.activeTab?.content || '',
          });
        }}
        onOpenCouncilBroadcastModal={() => {
          ctrl.setShowAgentAccountsModal(false);
          ctrl.setShowCouncilModal(true);
        }}
        showObservabilityHUD={ctrl.showObservabilityHUD}
        onToggleObservabilityHUD={() =>
          ctrl.setShowObservabilityHUD(!ctrl.showObservabilityHUD)
        }
        onOpenSharedMemory={ctrl.handleOpenSharedMemory}
        onRequestClearCacheModal={() => {
          ctrl.setShowCouncilModal(false);
          ctrl.setShowAgentAccountsModal(false);
          ctrl.requestOpenClearCacheModal();
        }}
        onOpenAgentAccountsModal={() => {
          ctrl.setShowCouncilModal(false);
          ctrl.setShowAgentAccountsModal(true);
        }}
        refreshing={ctrl.refreshing}
        onRefreshAll={ctrl.handleRefreshAll}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {ctrl.showProjectTree && ctrl.resolvedWorkspace && (
          <ProjectTreeNavigator
            workspacePath={ctrl.resolvedWorkspace}
            onClose={() => ctrl.setShowProjectTree(false)}
          />
        )}

        {ctrl.lifecycleStage === 'debate' ? (
          <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
            <DiscussionStudio
              resolvedWorkspace={ctrl.resolvedWorkspace}
              onNavigateToReport={() => ctrl.setLifecycleStage('report')}
            />
          </div>
        ) : ctrl.lifecycleStage === 'report' ? (
          <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden p-2">
            <ProjectSynthesisReportViewer
              workspacePath={ctrl.resolvedWorkspace}
              reportMarkdown={ctrl.effectiveReportMarkdown}
              onLaunchDedicatedPipeline={ctrl.handleLaunchDedicatedPipeline}
              onRollupToMaster={ctrl.handleRollupToMaster}
              onSendBackToDebate={ctrl.handleSendBackToDebate}
            />
          </div>
        ) : (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <AgentStudioSidebar
              visibleAgents={ctrl.visibleAgents}
              allAgents={ctrl.agentProfiles}
              agentsById={ctrl.agentsById}
              tasksById={ctrl.tasksById}
              selectedAgentId={ctrl.selectedAgentId}
              onSelectAgent={ctrl.setSelectedAgentId}
              agentTasks={ctrl.agentTasks}
              selectedTaskId={ctrl.selectedTask?.id || null}
              onSelectTask={ctrl.setSelectedTaskId}
              onDeleteTask={ctrl.handleDeleteTask}
              onClearFinished={ctrl.handleClearFinished}
              onOpenAccountsModal={() => ctrl.setShowAgentAccountsModal(true)}
              pipelines={ctrl.pipelines}
              onUpdatePipelineStep={ctrl.handleUpdatePipelineStep}
              onAddPipelineStep={ctrl.handleAddPipelineStep}
              onRemovePipelineStep={ctrl.handleRemovePipelineStep}
              onResetPipelines={ctrl.handleResetPipelines}
              onRunPipelineInStudio={ctrl.handleRunPipelineInStudio}
              onCancelPipeline={() => {
                ctrl.cancelActivePipelineRun(
                  ctrl.runningPipelineId || ctrl.pipelines[0]?.id
                );
              }}
              runningPipelineId={ctrl.runningPipelineId}
              runningPipelineStepIdx={ctrl.runningPipelineStepIdx}
              workflowExecutionMode={ctrl.workflowExecutionMode}
              onSetWorkflowExecutionMode={ctrl.handleSetWorkflowExecutionMode}
              waitingForStepApproval={ctrl.waitingForStepApproval}
              onProceedNextWorkflowStep={ctrl.handleProceedNextWorkflowStep}
              onDropFileOnAgent={async (agentId, customFile) => {
                ctrl.setSelectedAgentId(agentId);
                await ctrl.handleSendInAppChatTask('', {
                  agentId,
                  filePath: customFile?.filePath,
                  fileName: customFile?.fileName,
                  sourceAgentId: customFile?.sourceAgent,
                });
              }}
              onOpenExternalBrowser={async (agentId) => {
                await window.electronAPI.launchAgentWebAuth(agentId);
              }}
              customActions={ctrl.customActions}
              onOpenCustomActionsModal={() => ctrl.setShowCustomActionsModal(true)}
              onClearStepDoneStatus={ctrl.handleClearStepDoneStatus}
              onRecoverPipelineStep={ctrl.handleRecoverPipelineStep}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <PipelineStatusBanners
                assignedReportDoc={ctrl.assignedReportDoc}
                completedPipelineSummary={ctrl.completedPipelineSummary}
                onViewReport={() => ctrl.setLifecycleStage('report')}
                onAuditDeliverablesInDebate={ctrl.handleAuditDeliverablesInDebate}
              />

              <AgentChatTimeline
                visibleAgents={ctrl.visibleAgents}
                allAgents={ctrl.agentProfiles}
                agentsById={ctrl.agentsById}
                selectedAgentId={ctrl.selectedAgentId}
                onSelectAgent={ctrl.setSelectedAgentId}
                selectedIntent={ctrl.selectedIntent}
                onSelectIntent={ctrl.setSelectedIntent}
                selectedTask={ctrl.selectedTask}
                activeFileName={activeFileName}
                activeFilePath={activeFilePath}
                watchedFiles={ctrl.cleanWorkspaceFiles}
                selectedSourceFile={ctrl.selectedSourceFile}
                onSelectSourceFile={ctrl.setSelectedSourceFile}
                onSendChatTask={async (
                  text,
                  attachedImages,
                  customActionId,
                  effortLevel,
                  thinkingEnabled,
                  modelId
                ) => {
                  let promptToSend = text;
                  if (attachedImages && attachedImages.length > 0) {
                    const imagesMarkdown = attachedImages
                      .map((img) => `![${img.name}](${img.dataUrl})`)
                      .join('\n\n');
                    promptToSend = promptToSend
                      ? `${promptToSend}\n\n### Attached Reference Images:\n${imagesMarkdown}`
                      : `### Attached Reference Images:\n${imagesMarkdown}`;
                  }
                  const customAct = ctrl.resolveCustomAction(customActionId);
                  if (customAct?.promptTemplate) {
                    promptToSend = `${promptToSend}\n\n[Action Directive]: ${customAct.promptTemplate}`;
                  }
                  await ctrl.handleSendInAppChatTask(promptToSend, {
                    epistemicPolicy: customAct?.epistemicPolicy,
                    customActionLabel: customAct?.name,
                    effortLevel,
                    thinkingEnabled,
                    modelId,
                  });
                }}
                onOpenReportInTab={ctrl.handleOpenReportInTab}
                onApplyToActiveTab={ctrl.handleApplyToActiveTab}
                onRelayToNextAgent={ctrl.handleRelayToNextAgent}
                onPasteExternalReply={ctrl.handlePasteExternalReply}
                onCancelTask={ctrl.handleCancelTask}
                onRecoverTask={ctrl.handleRecoverTask}
                submitting={ctrl.submitting}
                runningPipelineId={ctrl.runningPipelineId}
                workflowExecutionMode={ctrl.workflowExecutionMode}
                waitingForStepApproval={ctrl.waitingForStepApproval}
                customActions={ctrl.customActions}
                onOpenCustomActionsModal={() => ctrl.setShowCustomActionsModal(true)}
              />
            </div>

            <div
              onMouseDown={ctrl.handleInspectorResizeMouseDown}
              onDoubleClick={() => {
                ctrl.setInspectorWidth(340);
                try {
                  localStorage.setItem('flymd:agents-inspector-width', '340');
                } catch {}
              }}
              title="Drag to resize Live Progress Inspector (Double-click to reset to 340px)"
              className="w-1.5 h-full bg-slate-200 dark:bg-slate-900/60 hover:bg-sky-500/80 active:bg-sky-500 cursor-col-resize z-20 transition-colors shrink-0 flex items-center justify-center group select-none border-x border-slate-200 dark:border-slate-800"
            >
              <div className="w-0.5 h-8 bg-slate-400 dark:bg-slate-700/80 group-hover:bg-sky-200 rounded transition-colors" />
            </div>

            <AgentProgressInspector
              width={ctrl.inspectorWidth}
              isPipelineRunning={!!ctrl.runningPipelineId}
              selectedTask={ctrl.selectedTask}
              checkpoints={ctrl.agentCheckpoints}
              checkpointsById={ctrl.checkpointsById}
              restoringCheckpointId={ctrl.restoringCheckpointId}
              onRestoreCheckpoint={ctrl.handleRestoreCheckpoint}
              onClearTaskLogs={ctrl.handleClearTaskLogs}
              onDeleteTask={ctrl.handleDeleteTask}
              onCancelTask={ctrl.handleCancelTask}
              onRecoverTask={ctrl.handleRecoverTask}
              activeMarkdownContent={ctrl.activeTab?.content || ''}
              watchedFiles={ctrl.cleanWorkspaceFiles}
              onRunSingleChecklistItem={(itemText) =>
                ctrl.handleSendInAppChatTask(
                  `Execute checklist step: "${itemText}"`,
                  { intent: 'build' }
                )
              }
              onOpenFileInEditor={(path) => ctrl.handleOpenReportInTab(path)}
              onSelectWatchedFileForDispatch={(file) => {
                ctrl.setSelectedSourceFile(file.path);
                ctrl.handleSendInAppChatTask(`Analyze and process ${file.name}`, {
                  filePath: file.path,
                  fileName: file.name,
                  sourceAgentId: file.sourceAgent,
                });
              }}
              onDeleteWorkspaceFile={ctrl.handleDeleteWorkspaceFile}
            />
          </div>
        )}

        {ctrl.showObservabilityHUD && ctrl.resolvedWorkspace && (
          <ProjectObservabilityHUD
            workspacePath={ctrl.resolvedWorkspace}
            onClose={() => ctrl.setShowObservabilityHUD(false)}
          />
        )}
      </div>

      {ctrl.cacheNotification && (
        <div className="absolute top-14 right-4 z-40 bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <span>{ctrl.cacheNotification}</span>
        </div>
      )}

      <ClearWorkspaceCacheModal
        isOpen={ctrl.showClearCacheModal}
        onClose={() => !ctrl.clearingCache && ctrl.setShowClearCacheModal(false)}
        resolvedWorkspace={ctrl.resolvedWorkspace}
        clearingCache={ctrl.clearingCache}
        onExecuteClearCache={ctrl.handleExecuteClearCache}
        clearTempCache={ctrl.clearTempCache}
        setClearTempCache={ctrl.setClearTempCache}
        clearMemoryLedger={ctrl.clearMemoryLedger}
        setClearMemoryLedger={ctrl.setClearMemoryLedger}
        clearCompletedSessions={ctrl.clearCompletedSessions}
        setClearCompletedSessions={ctrl.setClearCompletedSessions}
        clearDebatesAndCouncil={ctrl.clearDebatesAndCouncil}
        setClearDebatesAndCouncil={ctrl.setClearDebatesAndCouncil}
        clearPipelineAndReports={ctrl.clearPipelineAndReports}
        setClearPipelineAndReports={ctrl.setClearPipelineAndReports}
        closeRelatedOpenedFiles={ctrl.closeRelatedOpenedFiles}
        setCloseRelatedOpenedFiles={ctrl.setCloseRelatedOpenedFiles}
      />

      <PipelineRecoveryModal
        promptData={ctrl.pendingRecoveryPrompt}
        agentCheckpoints={ctrl.agentCheckpoints}
        visibleAgents={ctrl.visibleAgents}
        recoveryAgentId={ctrl.recoveryAgentId}
        setRecoveryAgentId={ctrl.setRecoveryAgentId}
        recoveryModelId={ctrl.recoveryModelId}
        setRecoveryModelId={ctrl.setRecoveryModelId}
        recoveryEffortLevel={ctrl.recoveryEffortLevel}
        setRecoveryEffortLevel={ctrl.setRecoveryEffortLevel}
        recoveryThinkingEnabled={ctrl.recoveryThinkingEnabled}
        setRecoveryThinkingEnabled={ctrl.setRecoveryThinkingEnabled}
        recoveryExtraDirective={ctrl.recoveryExtraDirective}
        setRecoveryExtraDirective={ctrl.setRecoveryExtraDirective}
        onDismissOrPause={ctrl.dismissOrPauseRecoveryPrompt}
        onExecuteDecision={(mode) => {
          if (!ctrl.pendingRecoveryPrompt) return;
          ctrl.executeRecoveryDecision(
            ctrl.pendingRecoveryPrompt.failedTask,
            mode,
            ctrl.pendingRecoveryPrompt.pipeline,
            ctrl.pendingRecoveryPrompt.stepIdx,
            ctrl.recoveryAgentId || ctrl.pendingRecoveryPrompt.failedTask.targetAgentId,
            ctrl.recoveryExtraDirective.trim() || undefined,
            ctrl.recoveryEffortLevel,
            ctrl.recoveryThinkingEnabled,
            ctrl.recoveryModelId || undefined
          );
        }}
      />

      <CustomPipelineActionsModal
        isOpen={ctrl.showCustomActionsModal}
        onClose={() => ctrl.setShowCustomActionsModal(false)}
        customActions={ctrl.customActions}
        onSaveAction={ctrl.handleSaveCustomAction}
        onDeleteAction={ctrl.handleDeleteCustomAction}
      />
    </div>
  );
};
