import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div className="flex justify-center">
          <ExclamationCircleIcon className="h-24 w-24 text-teal-600 animate-pulse" />
        </div>
        <div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 font-poppins">
            Page Not Found
          </h2>
          <p className="mt-2 text-sm text-gray-600 font-inter">
            The page you are looking for does not exist, has been removed, or is temporarily unavailable.
          </p>
        </div>
        <div className="mt-8 flex justify-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex justify-center py-2 px-4 border border-teal-600 text-sm font-medium rounded-md text-teal-600 bg-white hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
          >
            Home Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
