/**
 * Trigger a file download in the browser.
 * @param url - The URL or object URL to download
 * @param filename - The suggested filename for the download
 */
export function triggerBrowserDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Revoke an object URL created by URL.createObjectURL().
 * Call after triggerBrowserDownload to free memory.
 */
export function revokeObjectUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
