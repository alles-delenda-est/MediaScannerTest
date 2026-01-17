export type UserRole = 'admin' | 'user';
export type OAuthProvider = 'google' | 'twitter';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: OAuthProvider;
  providerId: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface UserSettings {
  id: string;
  userId: string;
  emailDailySummary: boolean;
  emailHighRelevanceAlerts: boolean;
  defaultView: string;
  itemsPerPage: number;
  theme: 'light' | 'dark';
  minRelevanceThreshold: number;
  preferredRegions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
}
