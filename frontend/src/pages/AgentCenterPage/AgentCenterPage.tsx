import { Navigate } from 'react-router-dom';

/** 智能体中心已下线，统一回到首页能力入口。 */
export default function AgentCenterPage() {
  return <Navigate to="/" replace />;
}
