import React from 'react';
import { MessageSquare, Plus, CheckCircle } from 'lucide-react';
import {
  DeliberationPreset,
  PresetKey,
  ActionCatalogItem,
  ACTION_CATALOG,
  cleanDiscussionMarkdown,
  DEFAULT_PRESET_TEMPLATES,
  STORAGE_KEY_PRESETS,
  loadSavedPresets,
} from '../../../services/deliberationPresetRepository';
import {
  calculateThinkingSteps,
  renderDiscussionStatusBadge,
} from '../../../utils/discussionTextUtils';
import { NewDeliberationModal } from './discussion/NewDeliberationModal';
import { DiscussionSessionSidebar } from './discussion/DiscussionSessionSidebar';
import { DiscussionTopToolbar } from './discussion/DiscussionTopToolbar';
import { DiscussionTimelineView } from './discussion/DiscussionTimelineView';
import {
  DiscussionReportView,
  DiscussionDisputesView,
} from './discussion/DiscussionReportAndDisputesViews';
import { CouncilInterventionBar } from './discussion/CouncilInterventionBar';
import { DiscussionConfirmModals } from './discussion/DiscussionConfirmModals';
import { DeliberationConfigInspectorModal } from './discussion/DeliberationConfigInspectorModal';
import { useDiscussionStudioController } from './discussion/useDiscussionStudioController';

export type { DeliberationPreset, PresetKey, ActionCatalogItem };
export {
  ACTION_CATALOG,
  cleanDiscussionMarkdown,
  DEFAULT_PRESET_TEMPLATES,
  STORAGE_KEY_PRESETS,
  loadSavedPresets,
  calculateThinkingSteps,
};

interface DiscussionStudioProps {
  resolvedWorkspace: string;
  onNavigateToReport?: () => void;
}

export const DiscussionStudio: React.FC<DiscussionStudioProps> = ({
  resolvedWorkspace,
  onNavigateToReport,
}) => {
  const ctrl = useDiscussionStudioController({
    resolvedWorkspace,
    onNavigateToReport,
  });
  const { draft } = ctrl;

  return (
    <div className="flex-1 h-full w-full min-h-0 flex overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans transition-colors duration-150">
      <DiscussionSessionSidebar
        discussions={ctrl.discussions}
        activeSessionId={ctrl.activeSessionId}
        searchTerm={ctrl.searchTerm}
        setSearchTerm={ctrl.setSearchTerm}
        filteredDiscussions={ctrl.filteredDiscussions}
        onSelectSession={(sessionId) =>
          ctrl.selectDiscussion(resolvedWorkspace, sessionId)
        }
        onOpenNewModal={() => draft.setShowNewModal(true)}
        onOpenClearAllModal={() => ctrl.setShowClearAllModal(true)}
        onInspectSession={ctrl.handleInspectSession}
        onDeleteSession={ctrl.setSessionToDelete}
        getStatusBadge={renderDiscussionStatusBadge}
      />

      <div className="flex-1 h-full flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#f9f9f9] dark:bg-slate-950">
        {ctrl.tabFocusNotification && (
          <div className="px-4 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              <span>{ctrl.tabFocusNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => ctrl.setTabFocusNotification(null)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              &times;
            </button>
          </div>
        )}

        {ctrl.activeSessionId && ctrl.activeMeta ? (
          <>
            <DiscussionTopToolbar
              activeSessionId={ctrl.activeSessionId}
              activeMeta={ctrl.activeMeta}
              transcriptCount={ctrl.activeTranscript.length}
              isRunning={ctrl.isRunning}
              isStepMode={ctrl.isStepMode}
              discussionError={ctrl.discussionError}
              activeTab={ctrl.activeTab}
              onSelectTab={ctrl.handleSelectStageTab}
              timelineFilter={ctrl.timelineFilter}
              onChangeTimelineFilter={ctrl.setTimelineFilter}
              onToggleExpandAll={ctrl.handleToggleExpandAll}
              turnZoom={ctrl.turnZoom}
              onUpdateZoom={ctrl.handleUpdateZoom}
              onToggleStepMode={ctrl.handleToggleStepMode}
              onPause={ctrl.pauseCurrentDiscussion}
              onResume={() => ctrl.resumeCurrentDiscussion(resolvedWorkspace)}
              onCancel={ctrl.cancelCurrentDiscussion}
              onGoToReport={ctrl.handleGoToReport}
              onOpenReportInTab={ctrl.handleOpenReportInTab}
            />

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {ctrl.activeTab === 'timeline' && (
                <DiscussionTimelineView
                  activeMeta={ctrl.activeMeta}
                  transcriptCount={ctrl.activeTranscript.length}
                  isRunning={ctrl.isRunning}
                  roundGroups={ctrl.roundGroups}
                  expandedRounds={ctrl.expandedRounds}
                  expandedTurns={ctrl.expandedTurns}
                  expandedThinking={ctrl.expandedThinking}
                  copiedTurnId={ctrl.copiedTurnId}
                  turnZoom={ctrl.turnZoom}
                  onToggleRound={ctrl.toggleRound}
                  onToggleTurn={ctrl.toggleTurn}
                  onToggleThinking={ctrl.toggleThinking}
                  onProbeAgent={ctrl.handleProbeAgent}
                  onCopyTurn={ctrl.handleCopyTurn}
                  onQuotePoint={ctrl.handleQuoteInGuidance}
                  onToggleTargetedDispatch={() =>
                    ctrl.setShowTargetedDispatch((prev) => !prev)
                  }
                  onResume={() =>
                    ctrl.resumeCurrentDiscussion(resolvedWorkspace)
                  }
                  onGoToReport={ctrl.handleGoToReport}
                  onOpenConfig={() => {
                    if (ctrl.activeSessionId) {
                      ctrl.handleInspectSession(ctrl.activeSessionId);
                    }
                  }}
                />
              )}

              {ctrl.activeTab === 'report' && (
                <DiscussionReportView
                  activeReportMarkdown={ctrl.activeReportMarkdown}
                  activeReportVersion={ctrl.activeReportVersion}
                  latestReportVersion={ctrl.activeMeta.latestReportVersion}
                  turnZoom={ctrl.turnZoom}
                  copiedReport={ctrl.copiedReport}
                  onCopyReport={ctrl.handleCopyReport}
                  onOpenReportInTab={ctrl.handleOpenReportInTab}
                  onReloadReport={() =>
                    ctrl.loadReport(
                      resolvedWorkspace,
                      ctrl.activeSessionId!,
                      ctrl.activeMeta!.latestReportVersion
                    )
                  }
                />
              )}

              {ctrl.activeTab === 'disputes' && (
                <DiscussionDisputesView activeMeta={ctrl.activeMeta} />
              )}

              {ctrl.activeTab === 'timeline' && (
                <CouncilInterventionBar
                  showTargetedDispatch={ctrl.showTargetedDispatch}
                  onToggleTargetedDispatch={() =>
                    ctrl.setShowTargetedDispatch((prev) => !prev)
                  }
                  onCloseTargetedDispatch={() =>
                    ctrl.setShowTargetedDispatch(false)
                  }
                  participantAgents={ctrl.participantAgents}
                  targetedAgentId={ctrl.targetedAgentId}
                  onChangeTargetedAgentId={ctrl.setTargetedAgentId}
                  getSubscriptionTierForAgent={draft.getSubscriptionTierForAgent}
                  getDynamicModelsForAgent={draft.getDynamicModelsForAgent}
                  targetedActionName={ctrl.targetedActionName}
                  onChangeTargetedActionName={ctrl.setTargetedActionName}
                  targetedEffortLevel={ctrl.targetedEffortLevel}
                  onChangeTargetedEffortLevel={ctrl.setTargetedEffortLevel}
                  targetedThinkingEnabled={ctrl.targetedThinkingEnabled}
                  onToggleTargetedThinking={() =>
                    ctrl.setTargetedThinkingEnabled((prev) => !prev)
                  }
                  targetedActionQuery={ctrl.targetedActionQuery}
                  onChangeTargetedActionQuery={ctrl.setTargetedActionQuery}
                  isDispatchingTargeted={ctrl.isDispatchingTargeted}
                  onDispatchTargetedQuery={ctrl.handleDispatchTargetedQuery}
                  guidanceInput={ctrl.guidanceInput}
                  onChangeGuidanceInput={ctrl.setGuidanceInput}
                  onSendGuidance={ctrl.handleSendGuidance}
                  interventionFiles={ctrl.interventionFiles}
                  onAddInterventionFiles={ctrl.handleAddInterventionFiles}
                  onRemoveInterventionFile={ctrl.handleRemoveInterventionFile}
                  interventionClampedNotice={ctrl.interventionClampedNotice}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-600 dark:text-slate-400">
            <MessageSquare size={40} className="text-sky-600 dark:text-sky-400 mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Multi-Agent Discussion Studio
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
              Coordinate multi-agent deliberations and structured debates across
              any domain with strict process isolation, deterministic
              synchronization, human-in-the-loop steering, and evidence grading.
            </p>
            <button
              type="button"
              onClick={() => draft.setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Plus size={14} />
              <span>Launch New Deliberation</span>
            </button>
          </div>
        )}
      </div>

      <NewDeliberationModal
        isOpen={draft.showNewModal}
        onClose={() => draft.setShowNewModal(false)}
        onLaunch={draft.handleLaunchNewDiscussion}
        newTopic={draft.newTopic}
        setNewTopic={draft.setNewTopic}
        newIdea={draft.newIdea}
        setNewIdea={draft.setNewIdea}
        newObjective={draft.newObjective}
        setNewObjective={draft.setNewObjective}
        isFormValid={draft.isFormValid}
        attachedFiles={draft.attachedFiles}
        onAddAttachedFiles={draft.handleAddAttachedFiles}
        onRemoveAttachedFile={draft.handleRemoveAttachedFile}
        attachmentClampedNotice={draft.attachmentClampedNotice}
        maxRoundsInput={draft.maxRoundsInput}
        setMaxRoundsInput={draft.setMaxRoundsInput}
        setMaxRounds={draft.setMaxRounds}
        turnTimeoutInput={draft.turnTimeoutInput}
        setTurnTimeoutInput={draft.setTurnTimeoutInput}
        setTurnTimeoutSecs={draft.setTurnTimeoutSecs}
        newDebateMode={draft.newDebateMode}
        setNewDebateMode={draft.setNewDebateMode}
        enableStepModeInNew={draft.enableStepModeInNew}
        setEnableStepModeInNew={draft.setEnableStepModeInNew}
        presets={draft.presets}
        selectedPreset={draft.selectedPreset}
        onSelectPreset={draft.handleSelectPreset}
        onTogglePresetEnabled={draft.handleTogglePresetEnabled}
        onDeletePreset={draft.handleDeletePreset}
        onDuplicatePreset={draft.handleDuplicatePreset}
        onResetPresetsToDefaults={draft.handleResetPresetsToDefaults}
        editingPreset={draft.editingPreset}
        setEditingPreset={draft.setEditingPreset}
        isCreatingNewPreset={draft.isCreatingNewPreset}
        onStartCreatePreset={draft.handleStartCreatePreset}
        onStartEditPreset={draft.handleStartEditPreset}
        onSaveEditingPreset={draft.handleSaveEditingPreset}
        customParticipants={draft.customParticipants}
        onUpdateParticipant={draft.handleUpdateParticipant}
        onAddParticipant={draft.handleAddParticipant}
        onRemoveParticipant={draft.handleRemoveParticipant}
        availableProviders={ctrl.availableProviders}
        presetEngine={draft.presetEngine}
        setPresetEngine={draft.setPresetEngine}
        presetEffortLevel={draft.presetEffortLevel}
        setPresetEffortLevel={draft.setPresetEffortLevel}
        presetThinkingEnabled={draft.presetThinkingEnabled}
        setPresetThinkingEnabled={draft.setPresetThinkingEnabled}
        customSkillsDir={draft.customSkillsDir}
        setCustomSkillsDir={draft.setCustomSkillsDir}
        includeDefaultSkills={draft.includeDefaultSkills}
        setIncludeDefaultSkills={draft.setIncludeDefaultSkills}
        detectedSkills={draft.detectedSkills}
        isScanningSkills={draft.isScanningSkills}
        onBrowseSkillsDir={draft.handleBrowseSkillsDir}
        onSkillsDirChange={draft.handleSkillsDirChange}
        tokenBudgetCapInput={draft.tokenBudgetCapInput}
        setTokenBudgetCapInput={draft.setTokenBudgetCapInput}
        showCustomRolesModal={draft.showCustomRolesModal}
        setShowCustomRolesModal={draft.setShowCustomRolesModal}
        repeater={{
          dynamicProviders: draft.dynamicProviders,
          selectedEngines: draft.selectedEngines,
          onToggleSelectedEngine: draft.handleToggleSelectedEngine,
          onSelectAllReadyEngines: draft.handleSelectAllReadyEngines,
          isRefreshingSubscriptions: draft.isRefreshingSubscriptions,
          onRefreshSubscriptions: draft.refreshSubscriptionAgents,
          onOpenManageAccounts: draft.handleOpenManageAccounts,
          repeaterMode: draft.repeaterMode,
          onChangeRepeaterMode: draft.setRepeaterMode,
          maxRounds: draft.maxRounds,
          roundSchedule: draft.roundSchedule,
          onChangeRoundSchedule: draft.setRoundSchedule,
          onAutoBuildRoundSchedule: draft.handleAutoBuildRoundSchedule,
          allRoles: draft.allRoles,
          onCreateCustomRole: draft.handleCreateCustomRole,
          onDeleteCustomRole: draft.handleDeleteCustomRole,
          getSubscriptionTierForAgent: draft.getSubscriptionTierForAgent,
          getDynamicModelsForAgent: draft.getDynamicModelsForAgent,
        }}
      />

      <DiscussionConfirmModals
        sessionToDelete={ctrl.sessionToDelete}
        onCancelDeleteSession={() => ctrl.setSessionToDelete(null)}
        onConfirmDeleteSession={ctrl.handleConfirmDeleteSession}
        showClearAllModal={ctrl.showClearAllModal}
        totalDiscussionsCount={ctrl.discussions.length}
        onCancelClearAll={() => ctrl.setShowClearAllModal(false)}
        onConfirmClearAll={ctrl.handleConfirmClearAll}
      />

      <DeliberationConfigInspectorModal
        isOpen={!!ctrl.inspectingSessionId}
        onClose={ctrl.handleCloseInspector}
        config={ctrl.inspectingConfig}
        metadata={
          ctrl.discussions.find((d) => d.sessionId === ctrl.inspectingSessionId) ||
          ctrl.activeMeta
        }
        onSaveConfig={ctrl.handleSaveDiscussionConfig}
        availableProviders={ctrl.availableProviders}
        getDynamicModelsForAgent={draft.getDynamicModelsForAgent}
        getSubscriptionTierForAgent={draft.getSubscriptionTierForAgent}
      />
    </div>
  );
};
