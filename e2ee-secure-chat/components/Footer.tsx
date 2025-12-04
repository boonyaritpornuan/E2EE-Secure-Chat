
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#050505] text-[#86868b] text-center p-6 mt-auto text-sm border-t border-[#1A1A1A]">
      <p>&copy; {new Date().getFullYear()} benull. Serverless. Encrypted. Ephemeral.</p>
    </footer>
  );
};

export default Footer;
