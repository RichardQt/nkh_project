export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
