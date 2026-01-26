export interface Segment {
  id: number;
  source: string;
  target: string;
  isTmMatch?: boolean;
}

export interface ProjectFile {
  id: number;
  name: string;
  originalPath: string;
  storedPath: string;
  progress: number;
  createdAt: string;
}
