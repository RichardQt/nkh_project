import { Spin } from 'antd';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequireAuth() {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="route-loading" aria-label="正在验证登录状态">
        <Spin size="small" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
