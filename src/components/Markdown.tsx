"use client";

import type { ReactNode } from "react";

/** Lightweight markdown renderer for meeting notes (no extra deps). */
export function Markdown({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <p className="text-stone-400 italic text-sm">No enhanced notes yet.</p>
    );
  }

  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${key++}`} className="my-2 space-y-1.5 list-disc pl-5">
        {listItems.map((item, i) => (
          <li key={i} className="text-stone-700 leading-relaxed">
            <Inline text={item} />
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const check = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line);
    const numbered = /^\d+\.\s+(.+)$/.exec(line);

    if (heading) {
      flushList();
      const level = heading[1].length;
      const cls =
        level === 1
          ? "text-xl font-semibold text-stone-900 mt-5 mb-2"
          : level === 2
            ? "text-lg font-semibold text-stone-800 mt-4 mb-1.5"
            : "text-base font-semibold text-stone-800 mt-3 mb-1";
      nodes.push(
        <h3 key={key++} className={cls}>
          <Inline text={heading[2]} />
        </h3>
      );
      continue;
    }

    if (check) {
      listItems.push(
        `${check[1].toLowerCase() === "x" ? "☑" : "☐"} ${check[2]}`
      );
      continue;
    }

    if (bullet || numbered) {
      listItems.push((bullet || numbered)![1]);
      continue;
    }

    flushList();
    if (!line.trim()) {
      nodes.push(<div key={key++} className="h-2" />);
      continue;
    }
    nodes.push(
      <p key={key++} className="text-stone-700 leading-relaxed my-1">
        <Inline text={line} />
      </p>
    );
  }
  flushList();

  return <div className="prose-dictabird">{nodes}</div>;
}

function Inline({ text }: { text: string }) {
  // **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-stone-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-stone-100 px-1 py-0.5 text-[0.9em] font-mono text-stone-800"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
