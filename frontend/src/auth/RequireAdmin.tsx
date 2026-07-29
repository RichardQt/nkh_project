import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
