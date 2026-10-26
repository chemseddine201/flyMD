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
      return <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />;
    }
    if (direction === 'rtl') {
      return <AlignRight className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <AlignLeft className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Text Direction: ${getLabel()}. Click to cycle (Auto -> RTL -> LTR). (Ctrl+Shift+D)`}
      className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1.5 transition border ${
        direction === 'rtl'
          ? 'bg-amber-950/70 border-amber-500/40 text-amber-200'
          : direction === 'ltr'
          ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
      }`}
    >
      {getIcon()}
      <span className="font-mono text-[10px] font-semibold">{direction.toUpperCase()}</span>
    </button>
  );
};

