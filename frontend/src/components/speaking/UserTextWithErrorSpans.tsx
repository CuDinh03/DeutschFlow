"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { getErrorSnippet } from "@/lib/errors/errorTaxonomy";
import type { StructuredErrorItem } from "./types";

interface Props {
  text: string;
  errors?: StructuredErrorItem[];
}

/** Inline wrong + correction spans over the user utterance (warm paper only). */
export function UserTextWithErrorSpans({ text, errors }: Props) {
  const nodes = useMemo(() => {
    const errs = errors?.filter((e) => e.wrongSpan && text.includes(e.wrongSpan)) ?? [];
    if (!errs.length) return [<span key="plain">{text}</span>];

    const sorted = [...errs].sort((a, b) => text.indexOf(a.wrongSpan!) - text.indexOf(b.wrongSpan!));
    const out: ReactNode[] = [];
    let pos = 0;
    let k = 0;
    for (const e of sorted) {
      const w = e.wrongSpan!;
      const idx = text.indexOf(w, pos);
      if (idx === -1) continue;
      if (idx > pos) {
        out.push(<span key={`t${k++}`}>{text.slice(pos, idx)}</span>);
      }
      out.push(
        <Fragment key={`e${k++}`}>
          <span
            className="rounded px-0.5 border border-ga-red bg-ga-red-soft text-ga-red"
            title={getErrorSnippet(e.errorCode, 'vi').title}
          >
            {w}
          </span>
          {e.correctedSpan ? (
            <span
              className="text-ga-green text-[12px] font-medium whitespace-nowrap"
            >
              {" → "}
              {e.correctedSpan}
            </span>
          ) : null}
        </Fragment>,
      );
      pos = idx + w.length;
    }
    if (pos < text.length) {
      out.push(<span key={`t${k++}`}>{text.slice(pos)}</span>);
    }
    return out.length ? out : [<span key="plain">{text}</span>];
  }, [text, errors]);

  return <>{nodes}</>;
}
