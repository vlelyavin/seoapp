import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branding = await prisma.brandSettings.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(branding);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check plan
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planId: true },
  });

  if (!user || (user.planId !== "pro" && user.planId !== "agency")) {
    return NextResponse.json(
      { error: "Pro or Agency plan required" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { companyName, primaryColor, accentColor, logoUrl } = body;

  const branding = await prisma.brandSettings.upsert({
    where: { userId: session.user.id },
    update: { companyName, primaryColor, accentColor, logoUrl },
    create: {
      userId: session.user.id,
      companyName,
      primaryColor,
      accentColor,
      logoUrl,
    },
  });

  return NextResponse.json(branding);
}
