
import React from 'react';

interface CustomerInfoCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const CustomerInfoCard: React.FC<CustomerInfoCardProps> = ({ 
  title, 
  children,
  className = ""
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
};

export default CustomerInfoCard;
