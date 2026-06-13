import * as LucideIcons from 'lucide-react';
import { Sparkles } from 'lucide-react';

export const getDynamicCategoryIcon = (iconName) => {
  if (!iconName) {
    return Sparkles; // fallback
  }

  // If icon is a URL/image path
  if (iconName.startsWith('http') || iconName.startsWith('/') || iconName.startsWith('data:')) {
    return null;
  }

  // If icon is a Lucide name
  const IconComponent = LucideIcons[iconName];
  if (IconComponent) return IconComponent;

  return Sparkles;
};
