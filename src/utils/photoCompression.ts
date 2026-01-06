export type PhotoCompressionOptions = {
  maxDimension: number;
  quality: number;
};

type LoadedImage = {
  image: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

function loadImageBlob(blob: Blob): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob).then((bitmap) => ({
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => {
        if ("close" in bitmap) {
          bitmap.close();
        }
      },
    }));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({
        image: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen"));
    };
    img.src = url;
  });
}

export async function compressImageFile(
  file: File,
  options: PhotoCompressionOptions,
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Tipo de archivo no permitido");
  }

  const { image, width, height, cleanup } = await loadImageBlob(file);
  const maxDimension = Math.max(width, height);
  const scale =
    maxDimension > options.maxDimension
      ? options.maxDimension / maxDimension
      : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    cleanup();
    throw new Error("No se pudo preparar la compresion");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  cleanup();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("No se pudo comprimir la imagen"));
        }
      },
      "image/jpeg",
      options.quality,
    );
  });

  return blob;
}
