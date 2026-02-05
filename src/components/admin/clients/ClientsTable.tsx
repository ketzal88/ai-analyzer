import React from "react";
import { Client } from "@/types";
import ClientRow from "./ClientRow";

interface ClientsTableProps {
    clients: Client[];
    onToggleActive: (client: Client) => void;
    onArchive: (id: string) => void;
}

export default function ClientsTable({ clients, onToggleActive, onArchive }: ClientsTableProps) {
    return (
        <table className="w-full">
            <thead>
                <tr className="border-b border-argent text-left">
                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">Client Name</th>
                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider text-center">Active</th>
                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider text-center">Ecommerce</th>
                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider text-center">Google Ads</th>
                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-argent">
                {clients.map(client => (
                    <ClientRow
                        key={client.id}
                        client={client}
                        onToggleActive={onToggleActive}
                        onArchive={onArchive}
                    />
                ))}
            </tbody>
        </table>
    );
}
