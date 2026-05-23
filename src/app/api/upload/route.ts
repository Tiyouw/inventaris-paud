import { NextResponse } from "next/server";

import {
  SupabaseConfigurationError,
  uploadInventoryPhoto,
} from "@/lib/inventory-store";
import { validateWebpUpload } from "@/lib/media";

type Base64UploadPayload = {
  fileName?: string;
  contentType?: string;
  data?: string;
  base64?: string;
};

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const upload = contentType.includes("application/json")
      ? await readJsonUpload(request)
      : await readFormUpload(request);
    const url = await uploadInventoryPhoto(upload);

    return NextResponse.json({ url });
  } catch (error) {
    return handleUploadError(error);
  }
}

async function readFormUpload(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Upload requires a WebP file field named file.");
  }

  const validation = validateWebpUpload(file.type || "image/webp", file.size);

  if (!validation.valid) {
    throw new UploadValidationError(validation.message);
  }

  return {
    content: await file.arrayBuffer(),
    fileName: file.name,
    contentType: file.type || "image/webp",
  };
}

async function readJsonUpload(request: Request) {
  const payload = (await request.json()) as Base64UploadPayload;
  const rawBase64 = payload.base64 ?? payload.data;

  if (!rawBase64) {
    throw new Error("Upload requires a base64 or data field.");
  }

  const base64 = rawBase64.includes(",")
    ? rawBase64.slice(rawBase64.indexOf(",") + 1)
    : rawBase64;
  const content = Buffer.from(base64, "base64");
  const validation = validateWebpUpload(
    payload.contentType ?? "image/webp",
    content.byteLength,
  );

  if (!validation.valid) {
    throw new UploadValidationError(validation.message);
  }

  return {
    content,
    fileName: payload.fileName,
    contentType: payload.contentType ?? "image/webp",
  };
}

class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function handleUploadError(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json(
      {
        error: "SUPABASE_NOT_CONFIGURED",
        message: error.message,
      },
      { status: 503 },
    );
  }

  if (error instanceof UploadValidationError) {
    return NextResponse.json(
      {
        error: "INVALID_UPLOAD",
        message: error.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: "UPLOAD_REQUEST_FAILED",
      message: error instanceof Error ? error.message : "Upload request failed.",
    },
    { status: 500 },
  );
}
