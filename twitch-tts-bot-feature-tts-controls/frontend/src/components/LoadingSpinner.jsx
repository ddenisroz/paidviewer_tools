import React from 'react';

const LoadingSpinner = ({ size = 'h-12 w-12', color = 'text-primary' }) => {
  return (
    <div
      className={`animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] ${color} ${size} motion-reduce:animate-[spin_1.5s_linear_infinite]`}
      role="status"
    >
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
        Loading...
      </span>
    </div>
  );
};

export default LoadingSpinner;
