(() => {
  'use strict';

  const PLACEHOLDER_PATTERN = /(?:^|\/)assets\/images\/[^/]+\.svg(?:$|\?)/i;

  const isPlaceholder = (image) => {
    const source = image?.getAttribute('src') || '';
    const alt = image?.getAttribute('alt') || '';
    return PLACEHOLDER_PATTERN.test(source) || /placeholder/i.test(alt);
  };

  const hidePlaceholder = (image) => {
    if (!image || !isPlaceholder(image)) return false;
    image.hidden = true;
    image.dataset.mediaEmpty = 'true';
    image.removeAttribute('data-cover-fallback');

    const container = image.closest('.card-media, .detail-hero, .reward-media');
    if (container) container.dataset.mediaEmpty = 'true';

    const badge = container?.querySelector('.image-status');
    if (badge) {
      badge.hidden = true;
      badge.dataset.mediaEmpty = 'true';
    }
    return true;
  };

  const scan = (root = document) => {
    root.querySelectorAll?.('img').forEach(hidePlaceholder);
  };

  const style = document.createElement('style');
  style.id = 'placeholder-guard-style';
  style.textContent = `
    .card-media[data-media-empty="true"] { display: none !important; }
    .detail-hero > img[data-media-empty="true"] { display: none !important; }
    .reward-media[data-media-empty="true"] { display: none !important; }
    .image-status[data-media-empty="true"] { display: none !important; }
  `;
  document.head.append(style);

  document.addEventListener('error', (event) => {
    const image = event.target instanceof HTMLImageElement ? event.target : null;
    if (!image) return;

    if (image.matches('[data-cover-image]') || isPlaceholder(image)) {
      event.stopImmediatePropagation();
      image.removeAttribute('src');
      image.hidden = true;
      image.dataset.mediaEmpty = 'true';
      image.removeAttribute('data-cover-fallback');

      const container = image.closest('.card-media, .detail-hero');
      if (container) container.dataset.mediaEmpty = 'true';
      const badge = container?.querySelector('.image-status');
      if (badge) {
        badge.hidden = true;
        badge.dataset.mediaEmpty = 'true';
      }
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(), { once: true });
  } else {
    scan();
  }

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches('img')) hidePlaceholder(node);
        scan(node);
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
