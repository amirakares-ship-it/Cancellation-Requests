import React, { createContext, useContext, useState, useCallback } from 'react';

// Shared registry so the single global horizontal scroll bar (rendered once
// in the app footer) always knows which scrollable element to control --
// whichever table/content area is currently mounted on screen registers
// itself here instead of rendering its own separate scroll bar.
interface ScrollBarContextValue {
  activeRef: React.RefObject<HTMLElement> | null;
  registerScrollTarget: (ref: React.RefObject<HTMLElement>) => void;
  unregisterScrollTarget: (ref: React.RefObject<HTMLElement>) => void;
}

const ScrollBarContext = createContext<ScrollBarContextValue>({
  activeRef: null,
  registerScrollTarget: () => {},
  unregisterScrollTarget: () => {},
});

export function ScrollBarProvider({ children }: { children: React.ReactNode }) {
  const [activeRef, setActiveRef] = useState<React.RefObject<HTMLElement> | null>(null);

  const registerScrollTarget = useCallback((ref: React.RefObject<HTMLElement>) => {
    setActiveRef(ref);
  }, []);

  // Only clears the active target if it's still the one being unregistered
  // -- protects against a slower unmount cleanup clobbering a newer
  // registration made just after a fast tab switch.
  const unregisterScrollTarget = useCallback((ref: React.RefObject<HTMLElement>) => {
    setActiveRef((prev) => (prev === ref ? null : prev));
  }, []);

  return (
    <ScrollBarContext.Provider value={{ activeRef, registerScrollTarget, unregisterScrollTarget }}>
      {children}
    </ScrollBarContext.Provider>
  );
}

export function useScrollBarContext() {
  return useContext(ScrollBarContext);
}
