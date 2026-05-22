import { NextResponse } from "next/server";

import {
  SupabaseConfigurationError,
  uploadInventoryPhoto,
} from "@/lib/inventory-store";

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

  return {
    content: Buffer.from(base64, "base64"),
    fileName: payload.fileName,
    contentType: payload.contentType ?? "image/webp",
  };
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

  return NextResponse.json(
    {
      error: "UPLOAD_REQUEST_FAILED",
      message: error instanceof Error ? error.message : "Upload request failed.",
    },
    { status: 500 },
  );
}
