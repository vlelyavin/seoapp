import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, readdir, unlink } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { getUploadsDir } from "@/lib/logo-storage";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planId: true },
  });

  if (!user || user.planId !== "agency") {
    return NextResponse.json({ error: "Agency plan required" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("logo") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file extension
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `File extension not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}` },
      { status: 400 }
    );
  }

  // Validate file type. Some browsers may send empty/generic MIME for valid SVG files.
  const mime = (file.type || "").toLowerCase();
  const hasMime = mime.length > 0;
  const mimeLooksImage = mime.startsWith("image/");
  const mimeIsGenericBinary = mime === "application/octet-stream";
  if (hasMime && !mimeLooksImage && !mimeIsGenericBinary) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  // Validate size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const filename = `logo_${session.user.id}_${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
  const uploadDir = getUploadsDir();
  await mkdir(uploadDir, { recursive: true });
  const filepath = join(uploadDir, filename);

  await writeFile(filepath, buffer);

  // Keep only the latest logo file for each user.
  // Match both formats safely:
  // - legacy: logo_<userId>.<ext>
  // - current: logo_<userId>_<timestamp>_<rand>.<ext>
  const escapedUserId = session.user.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const userLogoPattern = new RegExp(`^logo_${escapedUserId}(?:_|\\.).+`);
  try {
    const entries = await readdir(uploadDir, { withFileTypes: true });
    const stale = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name !== filename && userLogoPattern.test(name));

    await Promise.all(
      stale.map(async (name) => {
        try {
          await unlink(join(uploadDir, name));
        } catch {
          // Best-effort cleanup only.
        }
      })
    );
  } catch {
    // Keep upload success even if cleanup failed.
  }

  return NextResponse.json({ url: `/uploads/${filename}` });
}
