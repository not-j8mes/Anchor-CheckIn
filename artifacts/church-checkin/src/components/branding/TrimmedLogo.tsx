import { useEffect, useState } from "react";

interface TrimmedLogoProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
}

export function TrimmedLogo({ src, onLoad, ...props }: TrimmedLogoProps) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    setDisplaySrc(src);
    setProcessed(false);
  }, [src]);

  const trimOuterWhitespace = (image: HTMLImageElement) => {
    if (processed || displaySrc !== src || !image.naturalWidth || !image.naturalHeight) return;
    setProcessed(true);

    try {
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      let left = width;
      let right = -1;
      let top = height;
      let bottom = -1;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 4;
          const alpha = pixels[offset + 3] ?? 0;
          // Uploaded JPGs and resized PNGs often encode a visually white
          // background in the 236–250 range. Treat that as removable margin.
          const isNearWhite = (pixels[offset] ?? 255) > 235
            && (pixels[offset + 1] ?? 255) > 235
            && (pixels[offset + 2] ?? 255) > 235;
          if (alpha > 16 && !isNearWhite) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      }

      if (right < left || bottom < top) return;
      const contentWidth = right - left + 1;
      const contentHeight = bottom - top + 1;
      const padding = Math.max(2, Math.round(Math.max(contentWidth, contentHeight) * 0.04));
      left = Math.max(0, left - padding);
      top = Math.max(0, top - padding);
      right = Math.min(width - 1, right + padding);
      bottom = Math.min(height - 1, bottom + padding);

      if (left < width * 0.02 && top < height * 0.02 && right > width * 0.98 && bottom > height * 0.98) return;

      const croppedWidth = right - left + 1;
      const croppedHeight = bottom - top + 1;
      const cropped = document.createElement("canvas");
      cropped.width = croppedWidth;
      cropped.height = croppedHeight;
      const croppedContext = cropped.getContext("2d");
      if (!croppedContext) return;
      croppedContext.drawImage(canvas, left, top, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
      setDisplaySrc(cropped.toDataURL("image/png"));
    } catch {
      // Cross-origin or unreadable images fall back to the original source.
    }
  };

  return (
    <img
      {...props}
      src={displaySrc}
      onLoad={(event) => {
        trimOuterWhitespace(event.currentTarget);
        onLoad?.(event);
      }}
    />
  );
}
