type WorkspaceSlugCandidate = {
  slug: string;
};

export function slugifyWorkspaceName(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "workspace";
}

export function resolveUniqueWorkspaceSlug(
  workspaces: readonly WorkspaceSlugCandidate[],
  value: string,
) {
  const baseSlug = slugifyWorkspaceName(value);
  const knownSlugs = new Set(workspaces.map((workspace) => workspace.slug));

  if (!knownSlugs.has(baseSlug)) {
    return {
      slug: baseSlug,
      adjusted: false,
    };
  }

  let suffix = 2;

  while (knownSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return {
    slug: `${baseSlug}-${suffix}`,
    adjusted: true,
  };
}
