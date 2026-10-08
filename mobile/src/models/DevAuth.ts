/**
 * Developer Direct Authentication Model
 * Allows quick developer login with email and name (bypasses Apple & Google OAuth)
 */

export interface SavedDevAccount {
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  lastUsedAt: number;
}
