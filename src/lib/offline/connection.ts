/**
 * Whether the device can actually reach Travio.
 *
 * `navigator.onLine === false` isn't reliable on its own: some browsers and
 * embedded browser panes report "offline" while the network works fine (a
 * VPN or virtual network adapter, Chrome on some systems). Trusting it showed
 * the "Sin conexión" banner to people who were online. So "offline" from the
 * browser is only a hint, confirmed with a tiny request. `true` from the
 * browser is trusted as is (a failed request still falls back to the saved
 * copies).
 */
export async function isOnline(): Promise<boolean> {
  if (navigator.onLine) return true;
  try {
    // HEAD of a static icon: no body, skips the proxy and the service worker
    // (it only answers GET), and no-store so the browser cache can't answer.
    const response = await fetch(`/icons/icon-192.png?online=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
