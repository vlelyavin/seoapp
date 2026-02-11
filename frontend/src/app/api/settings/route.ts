import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, currentPassword, newPassword } = body;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Password change
  if (currentPassword && newPassword) {
    if (!user.password) {
      return NextResponse.json(
        { error: "Account uses OAuth, no password to change" },
        { status: 400 }
      );
    }

    const valid = await compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hash(newPassword, 12) },
    });

    return NextResponse.json({ message: "Password changed" });
  }

  // Profile update
  if (name !== undefined) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });
  }

  return NextResponse.json({ message: "Updated" });
}
