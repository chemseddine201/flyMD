import React from 'react';
import { TextDirection, resolveDirection } from '../../../../shared/utils';
import { ArrowLeftRight, AlignLeft, AlignRight } from 'lucide-react';

interface DirectionToggleProps {
  direction?: TextDirection;
  content?: string;
  onToggle: () => void;
}

export const DirectionToggle: React.FC<DirectionToggleProps> = ({
  direction = 'auto',
  content = '',
  onToggle,
}) => {
  const concreteDir = resolveDirection(direction, content);

  const getLabel = () => {
    if (direction === 'auto') {
      return `Auto (${concreteDir.toUpperCase()})`;
    }
    return direction.toUpperCase();
  };

  const getIcon = () => {
    if (direction === 'auto') {
      return <ArrowLeftRight className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
    }
    if (direction === 'rtl') {
      return <AlignRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    }
    return <AlignLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Text Direction: ${getLabel()}. Click to cycle (Auto -> RTL -> LTR). (Ctrl+Shift+D)`}
      className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1.5 transition border ${
        direction === 'rtl'
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-200'
          : direction === 'ltr'
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-200'
          : 'bg-slate-100 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      {getIcon()}
      <span className="font-mono text-[10px] font-semibold">{direction.toUpperCase()}</span>
    </button>
  );
};

