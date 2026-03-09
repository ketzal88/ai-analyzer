"use client";

import { PanoramaClientRow as ClientRowType } from "@/types/panorama";
import KPICell, { EmptyCell } from "./KPICell";
import Link from "next/link";

interface Props {
    row: ClientRowType;
}

export default function PanoramaClientRow({ row }: Props) {
    return (
        <tr className="hover:bg-special transition-colors border-b border-argent/30">
            {/* Client name — sticky */}
            <td className="px-2 py-2.5 sticky left-0 z-10 bg-stellar whitespace-nowrap">
                <Link
                    href={`/admin/clients/${row.clientSlug}`}
                    className="text-text-primary text-small font-medium hover:text-classic transition-colors max-w-[160px] truncate block"
                >
                    {row.clientName}
                </Link>
            </td>

            {/* Ecommerce */}
            {row.ecommerce ? (
                <>
                    <KPICell cell={row.ecommerce.revenue} format="currency" groupStart />
                    <KPICell cell={row.ecommerce.orders} format="number" />
                    <KPICell cell={row.ecommerce.aov} format="currency" />
                </>
            ) : (
                <>
                    <EmptyCell groupStart />
                    <EmptyCell />
                    <EmptyCell />
                </>
            )}

            {/* Meta Ads */}
            {row.meta ? (
                <>
                    <KPICell cell={row.meta.spend} format="currency" groupStart />
                    <KPICell cell={row.meta.cpa} format="currency" isInverse />
                    <KPICell cell={row.meta.roas} format="ratio" />
                </>
            ) : (
                <>
                    <EmptyCell groupStart />
                    <EmptyCell />
                    <EmptyCell />
                </>
            )}

            {/* Email */}
            {row.email ? (
                <>
                    <KPICell cell={row.email.sent} format="number" groupStart />
                    <KPICell cell={row.email.openRate} format="percent" />
                    <KPICell cell={row.email.clickRate} format="percent" />
                </>
            ) : (
                <>
                    <EmptyCell groupStart />
                    <EmptyCell />
                    <EmptyCell />
                </>
            )}

            {/* Google Ads */}
            {row.google ? (
                <>
                    <KPICell cell={row.google.spend} format="currency" groupStart />
                    <KPICell cell={row.google.cpa} format="currency" isInverse />
                    <KPICell cell={row.google.roas} format="ratio" />
                </>
            ) : (
                <>
                    <EmptyCell groupStart />
                    <EmptyCell />
                    <EmptyCell />
                </>
            )}
        </tr>
    );
}
