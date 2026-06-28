const IFRAME_HEIGHT_MESSAGE_TYPE = "ANCHOR_EVENTS_IFRAME_HEIGHT";
const FALLBACK_IFRAME_HEIGHT = 7000;
const IFRAME_RESIZER_VERSION = "5.5.9";

export function buildRegistrationEmbedCode(
  embedUrl: string,
  iframeId = "anchor-events-form",
) {
  const allowedOrigin = new URL(embedUrl).origin;

  return `<div id="${iframeId}-container" style="width: 100%; overflow: visible;">
<iframe
  id="${iframeId}"
  src="${embedUrl}"
  title="Registration form"
  width="100%"
  height="${FALLBACK_IFRAME_HEIGHT}"
  style="display: block; width: 1px; min-width: 100%; height: ${FALLBACK_IFRAME_HEIGHT}px; border: 0; overflow: hidden;"
  scrolling="no"
></iframe>
</div>

<script src="https://cdn.jsdelivr.net/npm/@iframe-resizer/parent@${IFRAME_RESIZER_VERSION}"></script>
<script>
  (function () {
    var iframe = document.getElementById(${JSON.stringify(iframeId)});
    if (!iframe) return;
    var allowedOrigin = ${JSON.stringify(allowedOrigin)};

    function setIframeHeight(height) {
      height = Number(height);
      if (!Number.isFinite(height) || height <= 0) return;
      var nextHeight = Math.ceil(height);
      iframe.style.height = nextHeight + "px";
      iframe.setAttribute("height", String(nextHeight));
    }

    if (typeof iframeResize === "function") {
      iframeResize({
        license: "GPLv3",
        checkOrigin: [allowedOrigin],
        direction: "vertical"
      }, iframe);
    }

    window.addEventListener("message", function (event) {
      if (event.origin !== allowedOrigin) return;
      if (!event.data || event.data.type !== ${JSON.stringify(IFRAME_HEIGHT_MESSAGE_TYPE)}) return;
      setIframeHeight(event.data.height);
    });
  })();
</script>`;
}
