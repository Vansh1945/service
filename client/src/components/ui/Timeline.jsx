import React from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';

const Timeline = ({ items = [], className = '' }) => {
  return (
    <div className={`space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-neutral-200 ${className}`}>
      {items.map((item, idx) => {
        const isCompleted = item.status === 'completed' || item.completed;
        const isCurrent = item.status === 'current' || item.current;

        return (
          <div key={idx} className="relative flex items-start gap-4 z-10">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 bg-white ${
              isCompleted
                ? 'border-success text-success'
                : isCurrent
                ? 'border-primary text-primary animate-pulse'
                : 'border-neutral-300 text-neutral-400'
            }`}>
              {isCompleted ? (
                <CheckCircle className="w-4 h-4 fill-success/10" />
              ) : isCurrent ? (
                <Clock className="w-4 h-4" />
              ) : (
                <Circle className="w-3 h-3" />
              )}
            </div>
            <div className="flex-1 bg-white p-3.5 rounded-xl border border-neutral-100 shadow-sm">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-secondary">{item.title}</h5>
                {item.time && <span className="text-[10px] text-neutral-400 font-medium">{item.time}</span>}
              </div>
              {item.description && <p className="text-xs text-neutral-500 mt-1 font-medium">{item.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Timeline;
