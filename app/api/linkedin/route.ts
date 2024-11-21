import { searchAndInteract } from "../../../lib/linkedin";
import { NextResponse } from "next/server";

// Use the same search terms as Bluesky
const SEARCH_TERMS = [
	"nextjs",
	"react",
	"typescript",
	"tailwindcss",
	"trpc",
	"react-query",
	"shadcn",
	"supabase",
	"vercel",
	"biome",
	"bun",
	"pnpm",
	"bun.sh",
	"magicui",
	"lucide",
	"radix-ui",
	"radix-ui/themes",
	"ui",
	"zod",
];

export async function GET(request: Request) {
	try {
		console.log(
			"🤖 LinkedIn job started:",
			new Date().toISOString()
		);
		console.log("🔍 Searching for terms:", SEARCH_TERMS);

		const authHeader = request.headers.get("authorization");

		if (!process.env.CRON_SECRET) {
			console.error(
				"❌ CRON_SECRET is not defined in environment variables"
			);
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 }
			);
		}

		if (
			authHeader !== `Bearer ${process.env.CRON_SECRET}`
		) {
			console.error(
				"❌ Authorization failed. Received:",
				authHeader
			);
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const results = await searchAndInteract(SEARCH_TERMS);

		console.log("✅ LinkedIn job completed successfully");
		console.log("📊 Summary:", results);

		return NextResponse.json({
			success: true,
			timestamp: new Date().toISOString(),
			results,
		});
	} catch (error) {
		console.error("❌ LinkedIn job failed:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// Configure the route to run every 4 hours
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute timeout
