import React from 'react';
import { Star } from 'lucide-react';

const Rating = ({ rating, onChange, interactive = false }) => {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onChange && onChange(star)}
          className={`transition-all ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          disabled={!interactive}
        >
          <Star className={`w-4 h-4 ${star <= rating ? 'fill-accent text-accent' : 'text-gray-200'}`} />
        </button>
      ))}
    </div>
  );
};

export default Rating;
