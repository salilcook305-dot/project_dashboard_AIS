import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { User } from '../types';
import { LoaderCircle } from 'lucide-react';

export const UserContext = React.createContext<{
  user: User | null;
  refetchUser: () => void;
}>({
  user: null,
  refetchUser: () => {},
});

export const useCurrentUser = () => React.useContext(UserContext);

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.getMe(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <LoaderCircle className="w-8 h-8 text-brand-royal animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <UserContext.Provider value={{ user, refetchUser: refetch }}>
      {children}
    </UserContext.Provider>
  );
};
