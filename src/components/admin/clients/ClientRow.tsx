import React from "react";
import Image from "next/image";
import { Client } from "@/types";

interface ClientRowProps {
    client: Client;
    teamName?: string;
    onToggleActive: (client: Client) => void;
    onArchive: (id: string) => void;
}

interface ChannelLogo {
    src: string;
    alt: string;
    title: string;
}

function getClientChannels(client: Client): ChannelLogo[] {
    const channels: ChannelLogo[] = [];

    if (client.integraciones?.meta || client.metaAdAccountId) {
        channels.push({ src: "/img/logos/meta.png", alt: "Meta", title: "Meta Ads" });
    }
    if (client.integraciones?.google || client.googleAdsId) {
        channels.push({ src: "/img/logos/google.png", alt: "Google", title: "Google Ads" });
    }

    const ecom = client.integraciones?.ecommerce;
    if (ecom === "tiendanube") {
        channels.push({ src: "/img/logos/tiendanube.png", alt: "TN", title: "Tienda Nube" });
    } else if (ecom === "shopify") {
        channels.push({ src: "/img/logos/shopify.png", alt: "Shopify", title: "Shopify" });
    } else if (ecom === "woocommerce") {
        channels.push({ src: "/img/logos/woocomerce.png", alt: "Woo", title: "WooCommerce" });
    }

    const email = client.integraciones?.email;
    if (email === "klaviyo") {
        channels.push({ src: "/img/logos/klaviyo.png", alt: "Klaviyo", title: "Klaviyo" });
    } else if (email === "perfit") {
        channels.push({ src: "/img/logos/perfit.png", alt: "Perfit", title: "Perfit" });
    }

    return channels;
}

export default function ClientRow({ client, teamName, onToggleActive, onArchive }: ClientRowProps) {
    const channels = getClientChannels(client);

    return (
        <tr className="hover:bg-special transition-colors group">
            <td className="px-6 py-4 font-medium text-text-primary">{client.name}</td>
            <td className="px-6 py-4 text-text-secondary text-small">{teamName || "\u2014"}</td>
            <td className="px-6 py-4 text-center">
                <button
                    onClick={() => onToggleActive(client)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${client.active ? "bg-synced" : "bg-text-muted/30"}`}
                >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${client.active ? "left-6" : "left-1"}`} />
                </button>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    {channels.length > 0 ? channels.map((ch) => (
                        <div
                            key={ch.alt}
                            className="w-6 h-6 relative flex-shrink-0 rounded bg-white/5 border border-argent/50 "
                            title={ch.title}
                        >
                            <Image
                                src={ch.src}
                                alt={ch.alt}
                                width={40}
                                height={40}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )) : (
                        <span className="text-tiny text-text-muted">-</span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 text-right space-x-3">
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
