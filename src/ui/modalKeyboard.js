/** Match keyboard handling to the modal that is painted above the others. */
export function isTopmostModal(content) {
  if (!content?.isConnected) return false;

  const ownerDocument = content.ownerDocument;
  const view = ownerDocument.defaultView;
  let topmost = null;
  let highestLayer = -Infinity;

  ownerDocument.querySelectorAll('[role="dialog"][aria-modal="true"]').forEach((modal) => {
    if (!modal.getClientRects().length || modal.closest('[aria-hidden="true"], [inert]')) return;
    const style = view.getComputedStyle(modal);
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return;

    // Dialog content has a local z-index inside its portal overlay. Sheets are
    // their own layer, so compare the outer dialog overlay with the sheet itself.
    const layer = modal.closest('[data-slot="dialog-overlay"]') || modal;
    const zIndex = Number.parseInt(view.getComputedStyle(layer).zIndex, 10) || 0;
    if (zIndex >= highestLayer) {
      highestLayer = zIndex;
      topmost = modal;
    }
  });

  return topmost === content;
}
