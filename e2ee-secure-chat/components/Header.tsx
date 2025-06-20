
import React from 'react';
import { APP_NAME } from '../constants';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 py-3">
        <h1 className="text-2xl font-bold text-teal-400">{APP_NAME}</h1>
      </div>
    </header>
  );
};

export default Header;
