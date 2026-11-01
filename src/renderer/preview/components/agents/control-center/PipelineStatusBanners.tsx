import React from 'react';
import { FileText, CheckCircle2, RotateCcw } from 'lucide-react';
import { AssignedReportDocState } from '../../../store';

export interface CompletedPipelineSummary {
  pipelineName: string;
  stepsCount: number;
  filesCreated: number;
  lastTaskOutput?: string;
}

export interface PipelineStatusBannersProps {
  assignedReportDoc: AssignedReportDocState | null;
  completedPipelineSummary: CompletedPipelineSummary | null;
  onViewReport: () => void;
  onAuditDeliverablesInDebate: () => void;
}

export const PipelineStatusBanners: React.FC<PipelineStatusBannersProps> = React.memo(
  ({
    assignedReportDoc,
    completedPipelineSummary,
    onViewReport,
    onAuditDeliverablesInDebate,
  }) => {
    if (!assignedReportDoc && !completedPipelineSummary) return null;

    return (
      <>
        {assignedReportDoc && (
          <div className="px-4 py-2 bg-sky-950/40 border-b border-sky-500/30 flex items-center justify-between text-xs text-sky-200">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-sky-400" />
              <span>
                <strong className="text-white">Active Contract:</strong>{' '}
                {assignedReportDoc.pipelineName} (Assigned at{' '}
                {assignedReportDoc.assignedAt})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onViewReport}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline"
              >
                View Report
              </button>
            </div>
          </div>
        )}

        {completedPipelineSummary && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/50 border-b border-purple-500/40 flex items-center justify-between gap-3 text-xs text-slate-200 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-100">
                  Pipeline Completed: {completedPipelineSummary.pipelineName}
                </span>
                <span className="text-[11px] text-slate-400 ml-2">
                  ({completedPipelineSummary.stepsCount} steps finished)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onViewReport}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                📋 View Report
              </button>
              <button
                type="button"
                onClick={onAuditDeliverablesInDebate}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
              >
                <RotateCcw size={12} />
                <span>🔄 Audit Deliverables in Council</span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }
);
