/**
 * Open `url` in the user's default browser. `brika login` uses this to jump
 * straight to the device-approval page, the way `gh auth login` does, rather
 * than asking the user to copy a link by hand.
 *
 * Resolves to whether the browser was launched. It never throws: on a headless
 * box, in CI, or when no opener exists, it resolves `false` so the caller can
 * fall back to printing the URL.
 */
export async function openBrowser(url: string): Promise<boolean> {
  const command = browserCommand(url, process.platform, process.env.BROWSER);
  if (command === undefined) return false;
  try {
    const child = Bun.spawn([...command], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
    return (await child.exited) === 0;
  } catch {
    return false;
  }
}

/**
 * The argv that opens `url` on `platform`, or `undefined` when we should not
 * try. A `$BROWSER` of `none` or empty disables auto-open (the convention for
 * headless environments); any other `$BROWSER` value is used as the opener.
 * Otherwise we fall back to the platform's default launcher.
 *
 * Kept pure and separate from {@link openBrowser} so it can be unit-tested
 * without spawning a process.
 */
export function browserCommand(
  url: string,
  platform: NodeJS.Platform,
  browserEnv: string | undefined,
): readonly string[] | undefined {
  if (browserEnv !== undefined) {
    const opener = browserEnv.trim();
    return opener === "" || opener === "none" ? undefined : [opener, url];
  }
  switch (platform) {
    case "darwin":
      return ["open", url];
    case "win32":
      return ["cmd", "/c", "start", "", url];
    default:
      return ["xdg-open", url];
  }
}
