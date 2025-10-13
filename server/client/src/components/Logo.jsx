import React from 'react';
import { FaBolt } from 'react-icons/fa';

const Logo = ({ size = 'text-2xl', withIcon = true, isDark = false }) => {
  return (
    <div className={`flex items-center ${withIcon ? 'space-x-2' : ''}`}>
      {withIcon && (
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary shadow-lg">
          <FaBolt className="h-5 w-5 text-accent" />
        </div>
      )}
      <span className={`font-bold ${size} ${isDark ? 'text-white' : 'text-secondary'}`}>
        SAFEVOLT <span className="text-accent">SOLUTIONS</span>
      </span>
    </div>
  );
};

export default Logo;


// import React from 'react';
// import { FaBolt } from 'react-icons/fa';

// const Logo = ({ size = 'text-2xl', withIcon = true, isDark = false }) => {
//   return (
//     <div className={`flex items-center ${withIcon ? 'space-x-3' : ''}`}>
//       {withIcon && (
//         <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 shadow-md">
//           <FaBolt className="h-5 w-5 text-white transform rotate-12" />
//         </div>
//       )}
//       <div className="flex flex-col">
//         <span className={`font-extrabold ${size} ${isDark ? 'text-white' : 'text-gray-800'} leading-tight tracking-tight`}>
//           RAJ
//         </span>
//         <span className={`font-medium text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} tracking-wider`}>
//           ELECTRICAL SERVICES
//         </span>
//       </div>
//     </div>
//   );
// };

// export default Logo;