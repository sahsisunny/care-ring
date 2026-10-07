export async function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): Promise<string | undefined> {
  // If this is an OAuth callback redirect, consume it silently so Expo Router
  // does not navigate to an unmatched route. The OAuth token is handled directly
  // by WebBrowser.openAuthSessionAsync.
  if (path.includes('oauthredirect')) {
    return initial ? '/' : undefined;
  }
  return path;
}
