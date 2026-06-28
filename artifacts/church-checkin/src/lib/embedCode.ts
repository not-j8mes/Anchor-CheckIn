export function buildRegistrationEmbedCode(
  embedUrl: string,
  iframeId = "anchor-events-form",
) {
  return `<iframe
  id="${iframeId}"
  src="${embedUrl}"
  title="Registration form"
  width="100%"
  height="900"
  style="display: block; width: 100%; min-height: 900px; border: 0;"
></iframe>`;
}
