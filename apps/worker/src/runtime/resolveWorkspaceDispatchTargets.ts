import { createServerRuntime } from "@fieldpulse/platform-runtime";

export type WorkspaceDispatchTarget = {
  workspaceId: string;
  workspaceSlug: string;
};

export async function resolveWorkspaceDispatchTargets(input: {
  runtime: Extract<ReturnType<typeof createServerRuntime>, { mode: "supabase" }>;
  workspaceId?: string;
  label: string;
}): Promise<readonly WorkspaceDispatchTarget[]> {
  const workspaces = input.workspaceId
    ? await input.runtime.services.workspaces.listAll().then((available) => {
        const selected = available.find(
          (workspace) => workspace.id === input.workspaceId,
        );

        if (!selected) {
          throw new Error(
            `[${input.label}] workspace "${input.workspaceId}" was not found`,
          );
        }

        return [selected];
      })
    : await input.runtime.services.workspaces.listAll();

  return workspaces.map((workspace) => ({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
  }));
}
