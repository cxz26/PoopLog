export type DatabaseStatus = "idle" | "initializing" | "ready" | "error";

export interface AppStatus {
  desktop: boolean;
  database: DatabaseStatus;
  databaseError: string | null;
}

// Re-export entities
export * from "./entities";
