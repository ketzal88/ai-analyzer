"use client";

import { useRef, useEffect, useState } from "react";
import { PanoramaTeamGroup } from "@/types/panorama";
import TeamHeaderRow from "./TeamHeaderRow";
import PanoramaClientRow from "./PanoramaClientRow";

const TOTAL_COLUMNS = 13; // 1 name + 3 meta + 3 google + 3 ecom + 3 email

const CHANNEL_GROUPS = [
    { label: "ECOMMERCE", cols: 3 },
    { label: "META ADS", cols: 3 },
    { label: "EMAIL", cols: 3 },
    { label: "GOOGLE ADS", cols: 3 },
];

const SUB_HEADERS = [
    "Revenue", "Orders", "AOV",
    "Spend", "CPA", "ROAS",
    "Sent", "Open%", "Click%",
    "Spend", "CPA", "ROAS",
];

// Border style for first cell of each channel group
const GROUP_BORDER = "border-l-2 border-argent";

interface Props {
    teams: PanoramaTeamGroup[];
}

export default function PanoramaTable({ teams }: Props) {
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const [scrollWidth, setScrollWidth] = useState(0);

    // Sync scroll positions between top scrollbar and table
    useEffect(() => {
        const topEl = topScrollRef.current;
        const tableEl = tableScrollRef.current;
        if (!topEl || !tableEl) return;

        // Measure table scroll width
        setScrollWidth(tableEl.scrollWidth);

        let syncing = false;
        const onTopScroll = () => {
            if (syncing) return;
            syncing = true;
            tableEl.scrollLeft = topEl.scrollLeft;
            syncing = false;
        };
        const onTableScroll = () => {
            if (syncing) return;
            syncing = true;
            topEl.scrollLeft = tableEl.scrollLeft;
            syncing = false;
        };

        topEl.addEventListener("scroll", onTopScroll);
        tableEl.addEventListener("scroll", onTableScroll);

        // Re-measure on resize
        const ro = new ResizeObserver(() => setScrollWidth(tableEl.scrollWidth));
        ro.observe(tableEl);

        return () => {
            topEl.removeEventListener("scroll", onTopScroll);
            tableEl.removeEventListener("scroll", onTableScroll);
            ro.disconnect();
        };
    }, [teams]);

    return (
        <div className="card p-0 overflow-hidden">
            {/* Top scrollbar */}
            <div
                ref={topScrollRef}
                className="overflow-x-auto overflow-y-hidden"
                style={{ height: 12 }}
            >
                <div style={{ width: scrollWidth, height: 1 }} />
            </div>

            {/* Table with bottom scrollbar */}
            <div ref={tableScrollRef} className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                    <thead>
                        {/* Channel group headers */}
                        <tr className="border-b border-argent">
                            <th className="px-2 py-2 sticky left-0 z-20 bg-stellar" />
                            {CHANNEL_GROUPS.map((g) => (
                                <th
                                    key={g.label}
                                    colSpan={g.cols}
                                    className={`px-2 py-2 text-center text-[10px] font-bold text-classic uppercase tracking-widest ${GROUP_BORDER}`}
                                >
                                    {g.label}
                                </th>
                            ))}
                        </tr>
                        {/* Sub-column headers */}
                        <tr className="border-b border-argent">
                            <th className="px-2 py-1.5 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider sticky left-0 z-20 bg-stellar">
                                Cliente
                            </th>
                            {SUB_HEADERS.map((h, i) => (
                                <th
                                    key={`${h}-${i}`}
                                    className={`px-2 py-1.5 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider ${
                                        i % 3 === 0 ? GROUP_BORDER : ""
                                    }`}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((team) => (
                            <TeamSection key={team.teamId ?? "__none"} team={team} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TeamSection({ team }: { team: PanoramaTeamGroup }) {
    return (
        <>
            <TeamHeaderRow
                teamName={team.teamName}
                clientCount={team.clients.length}
                colSpan={TOTAL_COLUMNS}
            />
            {team.clients.map((client) => (
                <PanoramaClientRow key={client.clientId} row={client} />
            ))}
        </>
    );
}
