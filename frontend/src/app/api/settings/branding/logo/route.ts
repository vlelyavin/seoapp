import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Billing disabled: branding available to all users.
  await prisma.brandSettings.updateMany({
    where: { userId: session.user.id },
    data: { logoUrl: null },
  });

  return NextResponse.json({ ok: true });
}
