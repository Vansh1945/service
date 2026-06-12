import React from 'react';
import { formatCurrency } from '../utils/format';

/**
 * Standard component to render formatted currency prices consistently.
 * 
 * @param {number|string} amount - The numeric price amount.
 * @param {string} type - Preset style variations.
 * @param {string} prefix - Custom prefix (e.g. "+", "-").
 * @param {string} className - Optional override styles.
 * @param {string|null} freeText - text to show when amount is 0. Pass null to disable.
 */
const PriceDisplay = ({
  amount,
  type = 'default',
  prefix = '',
  className = '',
  freeText = 'Free'
}) => {
  const numericAmount = parseFloat(amount);
  
  if (numericAmount === 0 && freeText) {
    const freeClasses = 'text-green-600 font-semibold italic';
    return <span className={`${freeClasses} ${className}`}>{freeText}</span>;
  }

  let typeClass = '';
  switch (type) {
    case 'positive':
    case 'discount':
      typeClass = 'text-emerald-600 font-medium';
      break;
    case 'negative':
    case 'charge':
      typeClass = 'text-red-500 font-medium';
      break;
    case 'charge-semibold':
      typeClass = 'text-red-500 font-semibold';
      break;
    case 'refund':
    case 'teal':
      typeClass = 'text-teal-700 font-bold';
      break;
    case 'refund-badge':
      typeClass = 'text-purple-600 font-black';
      break;
    case 'earning':
    case 'green-bold':
      typeClass = 'text-green-600 font-bold';
      break;
    case 'primary':
      typeClass = 'text-primary font-semibold';
      break;
    case 'secondary':
      typeClass = 'text-secondary font-semibold';
      break;
    case 'bold-primary':
      typeClass = 'text-primary font-bold';
      break;
    case 'bold-secondary':
      typeClass = 'text-secondary font-bold';
      break;
    case 'large-bold-primary':
      typeClass = 'text-lg font-bold text-primary';
      break;
    case 'large-bold-secondary':
      typeClass = 'text-lg font-bold text-secondary';
      break;
    case 'xl-bold-primary':
      typeClass = 'text-xl font-bold text-primary';
      break;
    case '2xl-bold-primary':
      typeClass = 'text-2xl font-bold text-primary';
      break;
    case 'purple-bold':
      typeClass = 'text-purple-600 font-bold';
      break;
    case 'purple-loss':
      typeClass = 'text-purple-700 font-bold';
      break;
    case 'blue-bold':
      typeClass = 'text-blue-600 font-bold';
      break;
    case 'gray-bold':
      typeClass = 'text-gray-700 font-semibold';
      break;
    case 'red-bold':
      typeClass = 'text-red-600 font-bold';
      break;
    case 'red-semibold':
      typeClass = 'text-red-600 font-semibold';
      break;
    case 'text-only':
      typeClass = '';
      break;
    default:
      typeClass = 'font-semibold text-secondary';
      break;
  }

  const formatted = formatCurrency(amount);

  return (
    <span className={`${typeClass} ${className}`}>
      {prefix}{formatted}
    </span>
  );
};

export default PriceDisplay;
