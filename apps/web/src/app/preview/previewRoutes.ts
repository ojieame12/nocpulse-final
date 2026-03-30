export function getPreviewHomeRoute() {
  return "/preview";
}

export function getPreviewFieldRoute(fieldId: string) {
  return `/preview?fieldId=${encodeURIComponent(fieldId)}`;
}
