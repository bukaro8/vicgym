export function isAccountNeutralOfflinePath(pathname: string): boolean {
  return pathname === "/offline" || pathname.startsWith("/offline/");
}

export function isSafePreparedAsset(url: string): boolean {
  if (!url.startsWith("/")) return false;
  const pathname = url.split(/[?#]/, 1)[0];
  return pathname.startsWith("/media/") || isAccountNeutralOfflinePath(pathname);
}
