export type WorkspaceId = string;
export type EntityId = string;
export type UserId = string;
export type TimestampIso = string;

export type WorkspaceScoped = {
  workspaceId: WorkspaceId;
};

export type Audited = {
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};
