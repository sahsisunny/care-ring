export interface Circle {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  role: string;
  createdAt?: string;
}

export function parseCircle(json: Record<string, any>): Circle {
  return {
    id: String(json.id),
    name: String(json.name || 'Family Circle'),
    inviteCode: String(json.invite_code || json.inviteCode || 'FAM-0000'),
    memberCount: Number(json.member_count ?? json.memberCount ?? 1),
    role: String(json.role || 'member'),
    createdAt: json.created_at || json.createdAt,
  };
}
