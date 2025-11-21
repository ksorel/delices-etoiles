import React from 'react';
import logo from '../../assets/logo_delices_etoiles.jpg';

const Logo = ({ className = "w-12 h-12", showText = true }) => {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Logo image réelle */}
      <div className="flex-shrink-0">
        <img 
          src={logo} 
          alt="Délices Étoilés - Restaurant Gastronomique"
          className="w-12 h-12 rounded-full object-cover shadow-md"
        />
      </div>
      
      {/* Texte du logo */}
      {showText && (
        <div className="flex flex-col">
          <span className="font-display font-bold text-primary-900 text-xl leading-tight">
            Délices Étoilés
          </span>
          <span className="text-primary-600 text-xs font-body uppercase tracking-wider">
            Restaurant Gastronomique
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;