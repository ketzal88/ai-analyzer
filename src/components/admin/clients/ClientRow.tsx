import React from "react";
import { Client } from "@/types";

interface ClientRowProps {
    client: Client;
    onToggleActive: (client: Client) => void;
    onArchive: (id: string) => void;
}

export default function ClientRow({ client, onToggleActive, onArchive }: ClientRowProps) {
    return (
        <tr className="hover:bg-special transition-colors group">
            <td className="px-6 py-4 font-medium text-text-primary">{client.name}</td>
            <td className="px-6 py-4 text-center">
                <button
                    onClick={() => onToggleActive(client)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${client.active ? "bg-synced" : "bg-text-muted/30"}`}
                >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${client.active ? "left-6" : "left-1"}`} />
                </button>
            </td>
            <td className="px-6 py-4 text-center">
                {client.isEcommerce ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-synced" title="Ecommerce Active" />
                ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-text-muted/20" />
                )}
            </td>
            <td className="px-6 py-4 text-center">
                {client.isGoogle ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-classic" title="Google Active" />
                ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-text-muted/20" />
                )}
            </td>
            <td className="px-6 py-4 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={`/admin/clients/${client.slug}`} className="text-classic font-bold text-small hover:underline">EDIT</a>
                <button className="text-text-muted font-bold text-small hover:text-text-primary">DUPLICATE</button>
                <button
                    onClick={() => onArchive(client.id)}
                    className="text-red-400 font-bold text-small hover:text-red-600"
                >
                    ARCHIVE
                </button>
            </td>
        </tr>
    );
}
