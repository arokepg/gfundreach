/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    // Default to light mode if no saved preference
    if (saved) {
      return saved === 'dark';
    }
    // Only use system preference if explicitly dark, otherwise default to light
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;

    // Respect Reduced Motion users: no animated cross-fade
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (prefersReduced) {
      if (isDarkMode) {
        root.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return; // No transition handling
    }

    // Add transition helper first, then toggle theme on next frame for smoother animation
    root.classList.add('theme-xfade');
    const frame = requestAnimationFrame(() => {
      if (isDarkMode) {
        root.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    });

    // Remove transition helper class after animation ends
    const t = setTimeout(() => {
      root.classList.remove('theme-xfade');
    }, 420); // keep slightly longer than CSS transition

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t);
    };
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
