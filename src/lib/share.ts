/** Share code via URL: lz-string-compressed JSON in the fragment. */
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

export interface SharedSnippet {
  name: string;
  code: string;
}

export function buildShareUrl(snippet: SharedSnippet): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(snippet));
  return `${location.origin}${location.pathname}#share=${payload}`;
}

export function readSharedSnippet(): SharedSnippet | null {
  const match = location.hash.match(/#share=(.+)/);
  if (!match) return null;
  try {
    const json = decompressFromEncodedURIComponent(match[1]);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (typeof parsed?.name === "string" && typeof parsed?.code === "string") {
      return parsed;
    }
  } catch {
    // malformed share link — ignore
  }
  return null;
}

export function clearShareHash() {
  history.replaceState(null, "", location.pathname + location.search);
}
