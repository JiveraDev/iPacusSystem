import { useState } from "react";

export function ImageWithFallback({ src, fallbackSrc = "", alt = "", ...props }) {
  const [imageSrc, setImageSrc] = useState(src);

  return (
    <img
      src={imageSrc || fallbackSrc}
      alt={alt}
      onError={() => {
        if (fallbackSrc && imageSrc !== fallbackSrc) {
          setImageSrc(fallbackSrc);
        }
      }}
      {...props}
    />
  );
}
