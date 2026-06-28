const IFRAME_HEIGHT_MESSAGE_TYPE = "ANCHOR_EVENTS_IFRAME_HEIGHT";

export function buildRegistrationEmbedCode(
  embedUrl: string,
  iframeId = "anchor-events-form",
) {
  const allowedOrigin = new URL(embedUrl).origin;

  return `<iframe
  id="${iframeId}"
  src="${embedUrl}"
  width="100%"
  height="900"
  style="display: block; width: 100%; height: 900px; border: 0; overflow: hidden;"
  scrolling="no"
></iframe>

<script>
  (function () {
    var iframe = document.getElementById(${JSON.stringify(iframeId)});
    if (!iframe) return;

    function setIframeHeight(height) {
      height = Number(height);
      if (!Number.isFinite(height) || height <= 0) return;
      var nextHeight = Math.ceil(height);
      iframe.style.height = nextHeight + "px";
      iframe.setAttribute("height", String(nextHeight));
    }

    window.addEventListener("message", function (event) {
      if (event.origin !== ${JSON.stringify(allowedOrigin)}) return;
      if (!event.data || event.data.type !== ${JSON.stringify(IFRAME_HEIGHT_MESSAGE_TYPE)}) return;
      setIframeHeight(event.data.height);
    });
  })();
</script>`;
}
