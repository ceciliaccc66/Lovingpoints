export interface User {
  id: number;
  username: string;
  pair_id: string | null;
  points: number;
  total_points: number;
  partner?: {
    id: number;
    username: string;
    points: number;
    total_points: number;
  };
}

export interface Application {
  id: number;
  from_user_id: number;
  to_user_id: number;
  from_username: string;
  title: string;
  points: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  created_at: string;
}

export interface Reward {
  id: number;
  creator_id: number;
  pair_id: string;
  title: string;
  points_required: number;
  description: string;
  expected_date: string | null;
  created_at: string;
}

export interface RedemptionRequest {
  id: number;
  user_id: number;
  reward_id: number;
  points_spent: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  title: string;
  from_username: string;
}

export interface PointProject {
  id: number;
  creator_id: number;
  pair_id: string;
  title: string;
  default_points: number;
  created_at: string;
}

export interface HistoryItem {
  id: number;
  type: 'application' | 'redemption';
  title: string;
  points: number;
  status: string;
  created_at: string;
  from_user: string;
  to_user: string | null;
}

export interface WishlistItem {
  id: number;
  creator_id: number;
  creator_name: string;
  pair_id: string;
  title: string;
  description: string;
  is_completed: number; // 0 or 1
  created_at: string;
}
