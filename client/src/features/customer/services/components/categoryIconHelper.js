import * as LucideIcons from 'lucide-react';
import { Sparkles } from 'lucide-react';

// Import popular react-icons sets
import * as FiIcons from 'react-icons/fi';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';
import * as IoIcons from 'react-icons/io';
import * as BsIcons from 'react-icons/bs';

export const getDynamicCategoryIcon = (iconName) => {
  if (!iconName) {
    return Sparkles; // fallback
  }

  // If icon is a URL/image path (starts with http, /, or data:)
  if (iconName.startsWith('http') || iconName.startsWith('/') || iconName.startsWith('data:')) {
    return null;
  }

  // 1. Try Lucide Icons
  const LucideIcon = LucideIcons[iconName];
  if (LucideIcon) return LucideIcon;

  // 2. Try React Icons based on prefix
  if (iconName.startsWith('Fi')) {
    const IconComp = FiIcons[iconName];
    if (IconComp) return IconComp;
  }
  if (iconName.startsWith('Fa')) {
    const IconComp = FaIcons[iconName];
    if (IconComp) return IconComp;
  }
  if (iconName.startsWith('Md')) {
    const IconComp = MdIcons[iconName];
    if (IconComp) return IconComp;
  }
  if (iconName.startsWith('Io')) {
    const IconComp = IoIcons[iconName];
    if (IconComp) return IconComp;
  }
  if (iconName.startsWith('Bs')) {
    const IconComp = BsIcons[iconName];
    if (IconComp) return IconComp;
  }

  return Sparkles;
};
