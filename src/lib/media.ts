export const WEBP_MIME_TYPE = "image/webp";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_SOURCE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const DEFAULT_WEBP_QUALITY = 0.82;
export const DEFAULT_MAX_IMAGE_WIDTH = 1600;
export const DEFAULT_MAX_IMAGE_HEIGHT = 1600;
export const MIN_WEBP_QUALITY = 0.1;
export const MAX_WEBP_QUALITY = 1;

export type WebpCompressionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  fileName?: string;
};

export type WebpCompressionResult = {
  blob: Blob;
  fileName: string;
  mimeType: typeof WEBP_MIME_TYPE;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  compressionRatio: number;
};

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; message: string };

type ImageSource = Blob | File;

export function validateSourceImage(file: File): ImageValidationResult {
  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      message: "File harus berupa gambar.",
    };
  }

  if (
    file.type &&
    !ACCEPTED_SOURCE_IMAGE_TYPES.includes(
      file.type as (typeof ACCEPTED_SOURCE_IMAGE_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      message: "Gunakan foto JPG, PNG, atau WebP.",
    };
  }

  return { valid: true };
}

export function validateWebpUpload(
  contentType: string,
  size: number,
): ImageValidationResult {
  if (contentType !== WEBP_MIME_TYPE) {
    return {
      valid: false,
      message: "Upload hanya menerima foto WebP.",
    };
  }

  if (size > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      message: "Ukuran foto WebP maksimal 5 MB.",
    };
  }

  return { valid: true };
}

export async function compressImageToWebp(
  source: ImageSource,
  options: WebpCompressionOptions = {},
): Promise<WebpCompressionResult> {
  const image = await loadImage(source);
  const { width, height } = getScaledDimensions(image.width, image.height, {
    maxWidth: options.maxWidth ?? DEFAULT_MAX_IMAGE_WIDTH,
    maxHeight: options.maxHeight ?? DEFAULT_MAX_IMAGE_HEIGHT,
  });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is not available in this browser.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const quality = clampQuality(options.quality ?? DEFAULT_WEBP_QUALITY);
  const blob = await canvasToBlob(canvas, WEBP_MIME_TYPE, quality);

  releaseImage(image);

  const originalSize = source.size;
  const compressedSize = blob.size;

  return {
    blob,
    fileName: getWebpFileName(options.fileName ?? getSourceName(source)),
    mimeType: WEBP_MIME_TYPE,
    originalSize,
    compressedSize,
    width,
    height,
    compressionRatio:
      originalSize === 0 ? 0 : Number((compressedSize / originalSize).toFixed(4)),
  };
}

export function getScaledDimensions(
  width: number,
  height: number,
  limits: { maxWidth: number; maxHeight: number },
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(1, limits.maxWidth / width, limits.maxHeight / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Unable to export canvas as WebP."));
      },
      mimeType,
      quality,
    );
  });
}

function clampQuality(quality: number): number {
  if (Number.isNaN(quality)) {
    return DEFAULT_WEBP_QUALITY;
  }

  return Math.min(MAX_WEBP_QUALITY, Math.max(MIN_WEBP_QUALITY, quality));
}

function getSourceName(source: ImageSource): string | undefined {
  return "name" in source ? source.name : undefined;
}

function getWebpFileName(fileName?: string): string {
  if (!fileName) {
    return "inventory-photo.webp";
  }

  return fileName.replace(/\.[^.]+$/, "") + ".webp";
}

async function loadImage(source: ImageSource): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(source);
  const image = new Image();

  image.decoding = "async";
  image.src = imageUrl;

  try {
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function releaseImage(image: HTMLImageElement): void {
  image.removeAttribute("src");
}
