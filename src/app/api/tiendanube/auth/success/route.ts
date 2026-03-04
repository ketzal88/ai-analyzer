import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const storeId = request.nextUrl.searchParams.get("store_id") || "unknown";
    return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head><title>Worker Brain — Instalación exitosa</title></head>
        <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff;">
            <div style="text-align: center; max-width: 480px;">
                <h1 style="font-size: 2rem;">Worker Brain conectado</h1>
                <p style="color: #888; font-size: 1.1rem;">Tu tienda (ID: ${storeId}) fue vinculada correctamente.</p>
                <p style="color: #666; font-size: 0.9rem; margin-top: 2rem;">Podés cerrar esta ventana.</p>
            </div>
        </body>
        </html>
    `, { headers: { "Content-Type": "text/html" } });
}
