"use client";

import React from "react";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: { type: string; text: string }[];
}

interface SlackBlockPreviewProps {
  blocks: SlackBlock[];
}

/**
 * Renders Slack Block Kit blocks as an HTML preview.
 * Converts basic mrkdwn syntax to styled HTML.
 */
export default function SlackBlockPreview({ blocks }: SlackBlockPreviewProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 text-sm text-gray-900 font-sans">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "header":
            return (
              <p key={i} className="font-bold text-base text-gray-900">
                {block.text?.text}
              </p>
            );
          case "section":
            return (
              <div
                key={i}
                className="whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: parseMrkdwn(block.text?.text || ""),
                }}
              />
            );
          case "divider":
            return <hr key={i} className="border-gray-200" />;
          case "context":
            return (
              <div key={i} className="text-xs text-gray-500">
                {block.elements?.map((el, j) => (
                  <span
                    key={j}
                    dangerouslySetInnerHTML={{
                      __html: parseMrkdwn(el.text || ""),
                    }}
                  />
                ))}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/** Convert Slack mrkdwn to basic HTML */
function parseMrkdwn(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~([^~]+)~/g, "<del>$1</del>")
    .replace(/\n/g, "<br />");
}
