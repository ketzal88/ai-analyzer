import React from "react";
import { Client, Team } from "@/types";
import ClientRow from "./ClientRow";

interface ClientsTableProps {
    clients: Client[];
    teams: Team[];
    onToggleActive: (client: Client) => void;
    onArchive: (id: string) => void;
}

export default function ClientsTable({ clients, teams, onToggleActive, onArchive }: ClientsTableProps) {
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

    return (
        <table className="w-full">
            <thead>
                <tr className="border-b border-argent text-left">
                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">Client Name</th>
                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">Equipo</th>
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
                        teamName={client.team ? teamMap[client.team] : undefined}
                        onToggleActive={onToggleActive}
                        onArchive={onArchive}
                    />
                ))}
            </tbody>
        </table>
    );
}
