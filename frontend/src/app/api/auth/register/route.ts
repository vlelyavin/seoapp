import { NextResponse } from "next/server";

// Registration disabled — Google auth only
export async function POST() {
  return NextResponse.json(
    { error: "Registration disabled" },
    { status: 410 }
  );
}
