"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import type { StructuredErrorItem } from "./types";

interface Props {
  text: string;
  errors?: StructuredErrorItem[];
  dark?: boolean;
}

/** Inline wrong + correction spans over the user utterance */
export function UserTextWithErrorSpans({ text, errors, dark }: Props) {
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
            className={
              dark
                ? "rounded px-0.5 border border-red-400/50 bg-red-950/50 text-red-200"
                : "rounded px-0.5 border border-red-300 bg-red-100 text-red-900"
            }
            title={e.errorCode}
          >
            {w}
          </span>
          {e.correctedSpan ? (
            <span
              className={
                dark
                  ? "text-emerald-300/95 text-[12px] font-medium whitespace-nowrap"
                  : "text-emerald-700 text-[12px] font-medium whitespace-nowrap"
              }
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
  }, [text, errors, dark]);

  return <>{nodes}</>;
}
