import { NextResponse } from "next/server";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize: only alphanumeric, underscores, dots, hyphens
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/uploads/${filename}`, req.url), 307);
}
