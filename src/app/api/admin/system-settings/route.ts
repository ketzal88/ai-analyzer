import { NextResponse } from "next/server";
import { SystemSettingsService } from "@/lib/system-settings-service";

export async function GET() {
    try {
        const settings = await SystemSettingsService.getSettings();
        return NextResponse.json(settings);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        await SystemSettingsService.updateSettings(body);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
