"use client";

interface Props {
    teamName: string;
    clientCount: number;
    colSpan: number;
}

export default function TeamHeaderRow({ teamName, clientCount, colSpan }: Props) {
    return (
        <tr className="bg-special/50">
            <td colSpan={colSpan} className="px-2 py-2">
                <span className="text-classic font-bold text-small uppercase tracking-wider">
                    {teamName}
                </span>
                <span className="text-text-muted text-[10px] ml-2">
                    ({clientCount} {clientCount === 1 ? "cliente" : "clientes"})
                </span>
            </td>
        </tr>
    );
}
