import React from 'react';
import logoImg from '../assets/wadi-degla-logo.png';

interface WadiDeglaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const WadiDeglaLogo: React.FC<WadiDeglaLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeMap = {
    sm: 60,
    md: 85,
    lg: 105,
    xl: 135,
  };

  const height = sizeMap[size];

  return (
    <div
      className={`wadi-degla-logo flex items-center justify-center select-none ${className}`}
      style={{ width: 'fit-content', margin: '0 auto' }}
      id="wadi-degla-official-logo"
    >
      <img
        src={logoImg}
        alt="Wadi Degla Clubs"
        style={{ height: `${height}px`, width: 'auto', objectFit: 'contain' }}
        draggable={false}
      />
    </div>
  );
};

export default WadiDeglaLogo;
