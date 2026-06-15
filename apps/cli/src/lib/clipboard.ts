/**
 * Best-effort copy of `text` to the system clipboard. `brika login` uses this so
 * that when the browser cannot be opened, the device code is ready to paste.
 *
 * Resolves to whether the copy succeeded. It never throws: when no clipboard
 * tool exists (headless box, missing xclip), it resolves `false` and the caller
 * just prints the code as before.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const command = clipboardCommand(process.platform);
  if (command === undefined) return false;
  try {
    const child = Bun.spawn([...command], {
      stdin: new TextEncoder().encode(text),
      stdout: "ignore",
      stderr: "ignore",
    });
    return (await child.exited) === 0;
  } catch {
    return false;
  }
}

/**
 * The argv that copies stdin to the clipboard on `platform`, or `undefined` when
 * we don't know one. Kept pure and separate from {@link copyToClipboard} so it
 * can be unit-tested without spawning a process.
 */
export function clipboardCommand(platform: NodeJS.Platform): readonly string[] | undefined {
  switch (platform) {
    case "darwin":
      return ["pbcopy"];
    case "win32":
      return ["clip"];
    default:
      return ["xclip", "-selection", "clipboard"];
  }
}
