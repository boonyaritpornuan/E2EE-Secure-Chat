
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-gray-400 text-center p-4 mt-auto">
      <p>&copy; {new Date().getFullYear()} E2EE Secure Chat. All rights reserved (not really, it's a demo!).</p>
    </footer>
  );
};

export default Footer;
