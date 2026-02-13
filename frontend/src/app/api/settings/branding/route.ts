import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HEX_COLOR_RE = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

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

  // Validate companyName
  if (companyName !== undefined && companyName !== null) {
    if (typeof companyName !== "string" || companyName.length > 100) {
      return NextResponse.json(
        { error: "Company name must be a string under 100 characters" },
        { status: 400 }
      );
    }
  }

  // Validate colors
  for (const [name, value] of [["primaryColor", primaryColor], ["accentColor", accentColor]] as const) {
    if (value !== undefined && value !== null && value !== "") {
      if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) {
        return NextResponse.json(
          { error: `${name} must be a valid hex color (e.g. #FF0000)` },
          { status: 400 }
        );
      }
    }
  }

  // Validate logoUrl
  if (logoUrl !== undefined && logoUrl !== null && logoUrl !== "") {
    try {
      const parsed = new URL(logoUrl, "https://placeholder.local");
      if (!parsed.pathname.startsWith("/uploads/")) {
        return NextResponse.json(
          { error: "Invalid logo URL" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid logo URL format" },
        { status: 400 }
      );
    }
  }

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
