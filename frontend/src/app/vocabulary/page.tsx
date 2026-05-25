"use client";

import React, { useEffect, useMemo, useState } from "react";
import { VocabWord } from "@/types/vocabulary";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import api from "@/lib/api";
import { useSpeech } from "@/hooks/useSpeech";

const PAGE_SIZE = 12;

type WordDetailProps = {
  word: VocabWord;
  compact?: boolean;
};

function mapWord(item: any): VocabWord {
  return {
    id: String(item.id),
    wordDe: item.baseForm ?? "",
    article: item.article ?? null,
    plural: item.nounDetails?.plural ?? null,
    meaningVi: item.meaning ?? "",
    exampleSentenceDe: item.exampleDe ?? item.example ?? "",
    exampleSentenceVi: item.exampleEn ?? item.example ?? "",
    partOfSpeech: item.dtype ?? "Word",
    cefrLevel: item.cefrLevel ?? "A1",
    masteryLevel: 0,
    audioUrl: undefined,
    imageUrl: item.imageUrl ?? null,
    lastPracticedAt: undefined,
  };
}

function getDisplayTitle(word: VocabWord) {
  return `${word.article ? `${word.article} ` : ""}${word.wordDe}`.trim();
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={index} className="rounded px-1 bg-amber-200/80 text-slate-900">
        {part}
      </mark>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    ),
  );
}

function WordDetail({ word, compact = false }: WordDetailProps) {
  const { speak } = useSpeech({ lang: "de-DE" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-slate-900 ${compact ? "rounded-t-[24px]" : "rounded-[24px] md:rounded-3xl"} border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden`}
    >
      {word.imageUrl ? (
        <div className="border-b border-slate-100 dark:border-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={word.imageUrl}
            alt=""
            className="w-full max-h-56 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      ) : null}
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-4 w-fit">
              <Sparkles size={12} /> {word.cefrLevel}
            </div>
            <p className="text-sm text-slate-500 mb-1">{word.partOfSpeech}</p>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight break-words">
              {getDisplayTitle(word)}
            </h2>
            {word.plural && <p className="mt-2 text-sm text-slate-500">Số nhiều: {word.plural}</p>}
          </div>
          <button
            type="button"
            onClick={() => speak(getDisplayTitle(word))}
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-100 hover:text-blue-700 transition-colors self-start sm:self-auto"
            title="Phát âm"
          >
            <Volume2 size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Nghĩa tiếng Việt</p>
            <p className="text-base font-semibold text-slate-900 dark:text-white break-words">{word.meaningVi}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Mức độ ghi nhớ</p>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(5, word.masteryLevel)}%` }} />
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{word.masteryLevel}%</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Ví dụ tiếng Đức</p>
          <p className="text-base text-slate-900 dark:text-white leading-7 break-words">“{word.exampleSentenceDe}”</p>
        </section>

        <section className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Dịch nghĩa ví dụ</p>
          <p className="text-base text-slate-600 dark:text-slate-300 leading-7 break-words">{word.exampleSentenceVi}</p>
        </section>
      </div>
    </motion.div>
  );
}

function MobileDetailSheet({
  word,
  onClose,
}: {
  word: VocabWord | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {word && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <div className="max-h-[88vh] overflow-hidden rounded-t-[28px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="h-1.5 w-12 rounded-full bg-slate-300" />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  aria-label="Đóng chi tiết"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[calc(88vh-56px)] overflow-y-auto p-3">
                <WordDetail word={word} compact />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function VocabularyPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cefr, setCefr] = useState("all");
  const [dtype, setDtype] = useState("all");
  const [page, setPage] = useState(0);
  const [words, setWords] = useState<VocabWord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileSheetWord, setMobileSheetWord] = useState<VocabWord | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number | undefined> = {
          q: query || undefined,
          cefr: cefr === "all" ? undefined : cefr,
          dtype: dtype === "all" ? undefined : dtype,
          size: PAGE_SIZE,
          page,
        };
        const { data } = await api.get("/words", { params });
        const items = Array.isArray(data?.items) ? data.items.map(mapWord) : [];
        if (cancelled) return;
        setWords(items);
        setTotal(Number(data?.total ?? 0));
        setSelectedId((prev) => (prev && items.some((w: VocabWord) => w.id === prev) ? prev : items[0]?.id ?? null));
      } catch {
        if (!cancelled) setError("Không tải được danh sách từ vựng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [query, cefr, dtype, page]);

  const selectedWord = useMemo(() => words.find((w) => w.id === selectedId) ?? null, [words, selectedId]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedIndex = words.findIndex((w) => w.id === selectedId);

  const resetFilters = () => {
    setQuery("");
    setCefr("all");
    setDtype("all");
    setPage(0);
  };

  const showSheetForWord = (word: VocabWord) => setMobileSheetWord(word);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-24 lg:pb-0">
      <header className="flex flex-col gap-4 px-4 py-4 md:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:supports-[backdrop-filter]:bg-slate-900/90">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Quay lại Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold px-3 py-2 rounded-full text-sm">
              {total} từ
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setPage(0);
                setQuery(e.target.value);
              }}
              placeholder="Tra cứu từ vựng tiếng Đức..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={cefr}
            onChange={(e) => {
              setPage(0);
              setCefr(e.target.value);
            }}
            className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">Tất cả CEFR</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>

          <select
            value={dtype}
            onChange={(e) => {
              setPage(0);
              setDtype(e.target.value);
            }}
            className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">Tất cả loại từ</option>
            <option value="Noun">Noun</option>
            <option value="Verb">Verb</option>
            <option value="Adjective">Adjective</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Filter size={16} />
            Xóa lọc
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        {loading ? (
          <div className="h-full min-h-[50vh] flex items-center justify-center text-slate-500">Đang tải từ vựng...</div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-center max-w-md w-full mx-auto mt-10">
            <p className="text-red-500 font-medium">{error}</p>
          </div>
        ) : words.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-center max-w-md w-full mx-auto mt-10">
            <p className="text-slate-600 dark:text-slate-400">Không tìm thấy từ phù hợp.</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
            <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden lg:sticky lg:top-24">
              <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={18} className="text-blue-600 shrink-0" />
                  <h2 className="font-bold text-slate-900 dark:text-white truncate">Danh sách từ vựng</h2>
                </div>
                <span className="text-xs text-slate-500 shrink-0">Trang {page + 1}/{totalPages}</span>
              </div>
              <div className="max-h-[42vh] lg:max-h-[70vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {words.map((word) => {
                  const active = word.id === selectedId;
                  return (
                    <div
                      key={word.id}
                      className={`px-4 sm:px-5 py-4 transition-colors ${active ? "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-inset ring-blue-400" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(word.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className={`font-bold break-words ${active ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-white"}`}>
                            {word.article ? `${word.article} ` : ""}{highlight(word.wordDe, query)}
                          </p>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-1 break-words">
                            {highlight(word.meaningVi, query)}
                          </p>
                        </button>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${active ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                          {word.cefrLevel}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 lg:hidden">
                        <button
                          type="button"
                          onClick={() => showSheetForWord(word)}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold"
                        >
                          Xem chi tiết
                        </button>
                        {active && <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Đang chọn</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-sm"
                >
                  <ChevronLeft size={16} />
                  Trước
                </button>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span>{page + 1}</span>
                  <span>/</span>
                  <span>{totalPages}</span>
                </div>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-sm"
                >
                  Sau
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-3 lg:sticky lg:top-24 hidden lg:block">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedIndex >= 0 ? `Đang chọn ${selectedIndex + 1}/${words.length}` : "Chọn một từ để xem chi tiết"}
                </p>
                <p className="text-xs text-slate-500">{query ? `Kết quả gần đúng cho “${query}”` : "Mặc định theo trang hiện tại"}</p>
              </div>

              <div className="lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto pb-4">
                {selectedWord ? (
                  <WordDetail word={selectedWord} />
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
                    Chọn một từ để xem chi tiết.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <MobileDetailSheet word={mobileSheetWord} onClose={() => setMobileSheetWord(null)} />
    </div>
  );
}
