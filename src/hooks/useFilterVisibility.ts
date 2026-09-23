import { useState, useCallback } from 'react';

/**
 * Controls whether a page's filter bar is shown or hidden, plus an optional
 * personal "Pin" that remembers the user's choice in this browser across
 * visits. Each user/page combination has its own independent preference.
 *
 * - Filter icon -> toggleVisible(): shows/hides the filter bar. If the user
 *   has pinned their preference, the new state is saved automatically.
 * - Pin icon -> togglePinned(): turns the personal pin on/off. Turning it on
 *   saves the current visibility as the user's standing preference; turning
 *   it off forgets it (the filter bar will start visible again next time).
 */
export function useFilterVisibility(pageKey: string, username?: string) {
  const storageKey = `wd_filter_pref_${username || 'guest'}_${pageKey}`;

  const readStored = (): { pinned: boolean; visible: boolean } | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const stored = readStored();
  const [pinned, setPinned] = useState<boolean>(stored?.pinned === true);
  const [visible, setVisible] = useState<boolean>(stored?.pinned === true ? stored.visible !== false : true);

  const toggleVisible = useCallback(() => {
    setVisible(prev => {
      const next = !prev;
      if (pinned) {
        try {
          localStorage.setItem(storageKey, JSON.stringify({ pinned: true, visible: next }));
        } catch {
          // Ignore storage errors (e.g. private browsing) -- the toggle
          // still works for the current session either way.
        }
      }
      return next;
    });
  }, [pinned, storageKey]);

  const togglePinned = useCallback(() => {
    setPinned(prev => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem(storageKey, JSON.stringify({ pinned: true, visible }));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // Ignore storage errors -- pin state still works for this session.
      }
      return next;
    });
  }, [storageKey, visible]);

  return { visible, pinned, toggleVisible, togglePinned };
}
