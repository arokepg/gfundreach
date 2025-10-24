/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const SearchContext = createContext(null);

export const useSearch = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within a SearchProvider');
  return ctx;
};

export const SearchProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      query,
      setQuery,
    }),
    [isOpen, query]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
};

export default SearchContext;
