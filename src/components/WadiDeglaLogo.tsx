import React from 'react';

interface WadiDeglaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLines?: boolean;
  textColor?: string;
  gazelleColor?: string;
  clubsColor?: string;
  lineColor?: string;
}

export const WadiDeglaLogo: React.FC<WadiDeglaLogoProps> = ({
  className = '',
  size = 'md',
  showLines = true,
  gazelleColor = '#8A8AB8', // Official soft periwinkle / lavender purple from brand image
  textColor = '#5E6973',    // Official charcoal / slate gray for "WADI DEGLA"
  clubsColor = '#7E7EB4',   // Official purple for "CLUBS S.A.E"
  lineColor = '#E2E8F0',    // Clean subtle divider lines
}) => {
  const sizeMap = {
    sm: { height: 42, gazelleH: 22, titleSize: '11px', clubsSize: '7px', letterSpacing: '0.2em' },
    md: { height: 60, gazelleH: 30, titleSize: '14px', clubsSize: '8.5px', letterSpacing: '0.25em' },
    lg: { height: 75, gazelleH: 38, titleSize: '16px', clubsSize: '9.5px', letterSpacing: '0.28em' },
    xl: { height: 95, gazelleH: 48, titleSize: '20px', clubsSize: '11px', letterSpacing: '0.3em' },
  };

  const s = sizeMap[size];

  return (
    <div
      className={`wadi-degla-logo flex flex-col items-center justify-center select-none text-center ${className}`}
      style={{ direction: 'ltr', width: 'fit-content', margin: '0 auto' }}
      id="wadi-degla-official-logo"
    >
      {/* Gazelle Icon & Flanking Horizontal Lines */}
      <div className="flex items-center justify-center w-full relative" style={{ minWidth: size === 'lg' || size === 'xl' ? '280px' : '220px' }}>
        {showLines && (
          <div
            className="flex-1 h-[1px]"
            style={{
              backgroundColor: lineColor,
              marginRight: '12px',
              maxWidth: '80px',
            }}
          />
        )}

        {/* Official Wadi Degla Gazelle Silhouette Vector accurately matching the uploaded logo */}
        <svg
          style={{ height: `${s.gazelleH}px`, width: 'auto' }}
          viewBox="0 0 100 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
            Standing/Striding Gazelle facing right with curved horns:
            - Horns: long, ridged curves swept backwards/upwards
            - Head: slender with muzzle pointing right, pointed ear pointing backward-up
            - Slender upright/curved neck
            - Torso/Body: back with slight dip, tail at the rear
            - Short raised tail at the back
            - Four distinct legs standing/walking:
              * Rear left leg extending back-down with hoof
              * Rear right leg slightly forward with angled hock
              * Front left leg descending straight down
              * Front right leg forward-stepping slightly
          */}
          <path
            d="M 57 1.5
               C 56 3, 54 6, 52 9
               C 51 10.5, 49 11.5, 47.5 12
               C 46.5 10.5, 45 7, 47 4
               C 48 2.5, 47 2, 46 3
               C 44 5, 43 8, 44 11.5
               C 42 12, 39.5 11, 38 9
               C 39 10.5, 41 12.5, 43.5 13.5
               C 43.5 14.5, 44 16, 45 17
               C 46 18, 48 18.5, 51 18
               C 54 18, 59 19, 63 21
               C 65 22, 66.5 24, 66 25.5
               C 65 27, 62 27.5, 59 27
               C 57 26.5, 55 26, 53.5 25
               C 52.5 25.5, 52 26.5, 52 28
               C 51.5 32, 51 36, 50 40
               C 52 40.5, 56 41, 60 41.5
               C 63 42, 65 43, 66 45
               C 67 47, 66 48.5, 64.5 49
               C 62 50, 58 48.5, 54 48
               C 53.5 50.5, 54 53, 55.5 57
               C 57 61, 59 66, 61 72
               C 61.5 74, 61.5 75, 60 75
               C 58.5 75, 58 73.5, 57.5 71
               C 56 65, 54 60, 52 56
               C 51 53, 49.5 51, 48 50
               C 47.5 54, 46.5 60, 46 66
               C 45.5 70, 45 74, 44 75.5
               C 43 76.5, 41.5 76, 41.5 74.5
               C 41.5 72, 42.5 67, 43.5 61
               C 44.5 55, 45 50, 45 47
               C 41 46.5, 37 46.5, 33 47
               C 31 47.5, 29 48, 27 49
               C 25.5 50, 24 51.5, 23 53.5
               C 22 55.5, 21.5 58, 22 61
               C 22.5 64, 24.5 68, 26.5 72
               C 27.5 74, 27.5 75, 26 75.5
               C 24.5 75.5, 24 74, 23 71
               C 20.5 66, 18.5 61, 18.5 56.5
               C 18.5 54, 19.5 51, 21 48.5
               C 21.5 46.5, 22 44.5, 21 43
               C 19 41.5, 17 42, 15.5 42
               C 15 40.5, 16 39, 18 38
               C 21 38, 24 38.5, 27 38.5
               C 31 38.5, 36 38, 41 37.5
               C 44 37, 46 36, 47 34
               C 48 31, 48.5 27, 49 23
               C 47.5 22, 46 20.5, 45 19.5
               C 43.5 20.5, 42 21, 40 20
               C 38 18.5, 38 16, 40 14
               C 42 12, 45 10, 48 7
               C 50.5 4.5, 54 2.5, 57 1.5
               Z"
            fill={gazelleColor}
          />
          {/* Inner Back Leg (Rear Right Leg) */}
          <path
            d="M 28 47
               C 29.5 50, 31 54, 32.5 58
               C 34 62, 35.5 67, 37 72
               C 37.5 73.5, 37.5 74.5, 36 74.5
               C 34.5 74.5, 34 73, 33 70
               C 31.5 65, 30 60, 28.5 55
               C 27.5 52, 27 49, 27 47
               Z"
            fill={gazelleColor}
          />
          {/* Inner Front Leg (Front Right Leg) */}
          <path
            d="M 50 47
               C 51 51, 51.5 55, 52 60
               C 52.5 64, 53 68, 54 72
               C 54.5 73.5, 54 74.5, 52.5 74.5
               C 51.5 74.5, 51 73, 50.5 70
               C 49.5 65, 49 60, 48.5 55
               C 48 51, 48.5 48, 49 46
               Z"
            fill={gazelleColor}
          />
        </svg>

        {showLines && (
          <div
            className="flex-1 h-[1px]"
            style={{
              backgroundColor: lineColor,
              marginLeft: '12px',
              maxWidth: '80px',
            }}
          />
        )}
      </div>

      {/* "WADI DEGLA" Text */}
      <div
        className="font-bold tracking-widest leading-none mt-1 uppercase"
        style={{
          fontFamily: 'Montserrat, "Trebuchet MS", "Segoe UI", sans-serif',
          fontSize: s.titleSize,
          color: textColor,
          letterSpacing: s.letterSpacing,
          fontWeight: 700,
        }}
      >
        WADI DEGLA
      </div>

      {/* "CLUBS S.A.E" Sub-text */}
      <div
        className="font-bold leading-none mt-1 uppercase tracking-widest flex items-baseline justify-center"
        style={{
          fontFamily: 'Montserrat, "Trebuchet MS", "Segoe UI", sans-serif',
          fontSize: s.clubsSize,
          color: clubsColor,
          letterSpacing: '0.22em',
          fontWeight: 700,
        }}
      >
        <span>CLUBS</span>
        <span style={{ fontSize: '0.65em', letterSpacing: '0.05em', marginInlineStart: '2px', opacity: 0.85 }}>S.A.E</span>
      </div>
    </div>
  );
};

export default WadiDeglaLogo;
