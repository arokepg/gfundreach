import { QueryClient } from '@tanstack/react-query';

// Central QueryClient with sensible defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60, // 1 min fresh
      gcTime: 1000 * 60 * 10, // 10 min cache
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
