import React, { useRef, useEffect } from 'react';
import { useScrollBarContext } from '../contexts/ScrollBarContext';

interface TableScrollWrapperProps {
  children: React.ReactNode;
  className?: string;
  showBarAlways?: boolean;
}

export default function TableScrollWrapper({ children, className = '' }: TableScrollWrapperProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { registerScrollTarget, unregisterScrollTarget } = useScrollBarContext();

  // Register this table's scrollable container with the single global
  // scroll bar (rendered once in the app footer) instead of rendering our
  // own separate left/right bar here -- whichever table is on screen is
  // the one the footer bar controls.
  useEffect(() => {
    registerScrollTarget(scrollRef as React.RefObject<HTMLElement>);
    return () => unregisterScrollTarget(scrollRef as React.RefObject<HTMLElement>);
  }, [registerScrollTarget, unregisterScrollTarget]);

  return (
    <div className={`relative flex flex-col ${className}`}>
      <div
        ref={scrollRef}
        className="overflow-auto scroll-smooth w-full custom-table-scrollbar"
        style={{ maxHeight: 'calc(100dvh - 180px)' }}
      >
        {children}
      </div>
    </div>
  );
}
