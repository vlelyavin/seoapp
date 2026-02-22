import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Clear GSC tokens from the Google account record
  await prisma.account.updateMany({
    where: { userId, provider: "google" },
    data: {
      refresh_token: null,
      access_token: null,
      expires_at: null,
    },
  });

  // Mark GSC as disconnected
  await prisma.user.update({
    where: { id: userId },
    data: {
      gscConnected: false,
      gscConnectedAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
