export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture: string;
  is_admin: number;
}

export interface Mod {
  id: number;
  title: string;
  description: string;
  icon_url: string;
  size: string;
  rating: number;
  author_id: number;
  author_name: string;
  created_at: string;
  screenshots: string[];
}
