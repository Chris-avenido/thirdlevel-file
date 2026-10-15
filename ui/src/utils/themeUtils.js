import { useState, useEffect } from 'react';

/**
 * Seasonal Theme Engine
 * Automatically activates Halloween theme between October 26 and November 6 (inclusive).
 * Also supports previewing / manual toggling via URL query (?theme=halloween | ?theme=normal)
 * or localStorage override ('insighted_theme_override').
 */

// export const isHalloweenDateRange = (date = new Date()) => {
//   const currentYear = date.getFullYear();
//   // Month 9 is October (0-indexed: 0=Jan, 9=Oct, 10=Nov)
//   const startDate = new Date(currentYear, 9, 26, 0, 0, 0);
//   const endDate = new Date(currentYear, 10, 6, 23, 59, 59);

//   return date >= startDate && date <= endDate;
// };
export const isHalloweenDateRange = (date = new Date()) => {
  const currentYear = date.getFullYear();

  // ⬇️ MODIFY DATES HERE (Note: Months are 0-indexed: 9 =
  //  October, 10 = November)
  const startDate = new Date(currentYear, 9, 26, 0, 0, 0); // October 26, 12:00:00 AM
  const endDate = new Date(currentYear, 10, 6, 23, 59, 59); // November 6, 11:59:59 PM

  return date >= startDate && date <= endDate;
};


export const getThemeOverride = () => {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const queryTheme = params.get('theme');
    if (queryTheme === 'halloween' || queryTheme === 'normal') {
      return queryTheme;
    }
    const local = localStorage.getItem('insighted_theme_override');
    if (local === 'halloween' || local === 'normal') {
      return local;
    }
  } catch (e) {
    console.error('Error reading theme override:', e);
  }
  return null;
};

export const setThemeOverride = (theme) => {
  if (typeof window === 'undefined') return;
  try {
    if (theme === 'halloween' || theme === 'normal') {
      localStorage.setItem('insighted_theme_override', theme);
    } else {
      localStorage.removeItem('insighted_theme_override');
    }
    window.dispatchEvent(new CustomEvent('seasonal-theme-change', { detail: { theme } }));
  } catch (e) {
    console.error('Error saving theme override:', e);
  }
};

export const isCentralOfficeUser = (user) => {
  if (user) {
    const role = String(user.role || user.account_category || '').toLowerCase().trim();
    if (role.includes('central office')) return true;
  }
  // Check localStorage fallback
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        const role = String(parsed.role || parsed.account_category || '').toLowerCase().trim();
        if (role.includes('central office')) return true;
      }
      const userRole = String(localStorage.getItem('userRole') || '').toLowerCase().trim();
      if (userRole.includes('central office')) return true;
    } catch (e) { }
  }
  return false;
};

export const isHalloweenActive = (user) => {
  // Halloween design is ONLY displayed when the role is Central Office
  if (!isCentralOfficeUser(user)) {
    return false;
  }
  const override = getThemeOverride();
  if (override === 'halloween') return true;
  if (override === 'normal') return false;
  return isHalloweenDateRange();
};

export const useSeasonalTheme = (customUser) => {
  const [isHalloween, setIsHalloween] = useState(() => isHalloweenActive(customUser));
  const [override, setOverride] = useState(() => getThemeOverride());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isHalloween) {
        document.body.classList.add('theme-halloween-active');
      } else {
        document.body.classList.remove('theme-halloween-active');
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('theme-halloween-active');
      }
    };
  }, [isHalloween]);

  useEffect(() => {
    const handleThemeChange = () => {
      setIsHalloween(isHalloweenActive(customUser));
      setOverride(getThemeOverride());
    };

    window.addEventListener('seasonal-theme-change', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);
    return () => {
      window.removeEventListener('seasonal-theme-change', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, [customUser]);

  const toggleHalloween = (mode) => {
    // mode: 'halloween' | 'normal' | 'auto'
    if (mode === 'halloween') {
      setThemeOverride('halloween');
    } else if (mode === 'normal') {
      setThemeOverride('normal');
    } else {
      setThemeOverride(null);
    }
    setIsHalloween(isHalloweenActive(customUser));
    setOverride(getThemeOverride());
  };

  return {
    isHalloween,
    override,
    toggleHalloween,
    isDateActive: isHalloweenDateRange(),
    isCentralOffice: isCentralOfficeUser(customUser)
  };
};
