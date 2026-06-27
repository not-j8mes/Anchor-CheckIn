const IFRAME_HEIGHT_MESSAGE_TYPE = "ANCHOR_EVENTS_IFRAME_HEIGHT";

export function buildRegistrationEmbedCode(
  embedUrl: string,
  iframeId = "anchor-events-form",
) {
  const allowedOrigin = new URL(embedUrl).origin;

  return `<iframe
  id="${iframeId}"
  src="${embedUrl}"
  style="width: 100%; border: 0; overflow: hidden;"
  scrolling="no"
></iframe>

<script>
  window.addEventListener("message", function (event) {
    if (event.origin !== ${JSON.stringify(allowedOrigin)}) return;
    if (!event.data || event.data.type !== ${JSON.stringify(IFRAME_HEIGHT_MESSAGE_TYPE)}) return;
    var iframe = document.getElementById(${JSON.stringify(iframeId)});
    if (!iframe) return;
    var height = Number(event.data.height);
    if (!Number.isFinite(height) || height <= 0) return;
    iframe.style.height = Math.ceil(height) + "px";
  });
</script>`;
}
