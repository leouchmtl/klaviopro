import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hunter: !!process.env.HUNTER_API_KEY,
    apollo: !!process.env.APOLLO_API_KEY,
  });
}
