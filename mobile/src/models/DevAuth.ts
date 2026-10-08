/**
 * Developer Direct Authentication Model
 * Allows quick developer login with email and name (bypasses Apple & Google OAuth)
 */

export interface DevLoginCredentials {
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  phone?: string | null;
}

export interface DevLoginRequest extends DevLoginCredentials {
  backendUrl: string;
}

export interface DevLoginResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string | null;
    phone?: string | null;
    created_at?: string;
  };
  circles: any[];
  activeCircle: any | null;
  isNewUser?: boolean;
}

export interface SavedDevAccount {
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  lastUsedAt: number;
}
