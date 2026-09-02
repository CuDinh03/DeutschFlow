"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { lightImpact } from "@/lib/haptics";
import { REORDER, type SelfCheckItem } from "@/lib/nodeExercises";

/**
 * Bài tập TỰ KIỂM TRA — dịch câu (TRANSLATE) và sắp xếp từ (REORDER).
 *
 * Hai loại này `NodeExerciseGrader` KHÔNG chấm (chỉ MULTIPLE_CHOICE + FILL_BLANK được chấm), nên
 * chúng không được tính vào điểm, không nằm trong `item_answers` gửi lên, và không chặn nút nộp bài.
 * Người học tự nghĩ rồi bấm xem đáp án để đối chiếu — đúng cách mobile đã làm
 * (`mobile/app/(student)/node-practice.tsx` → `RevealCard`).
 *
 * Trước đây web đọc chúng nhưng không có chỗ hiển thị: QA 2026-09-02 thấy chúng ra thành hai dòng
 * TRỐNG kèm ô nhập, lại còn chặn nút nộp vì cổng đòi điền hết mọi ô. Bản vá tạm khi đó ẩn hẳn hai
 * loại này đi; đây là bản thay thế, trả nội dung lại cho người học đúng hình dạng của nó.
 */
export default function SelfCheckCard({ item, index }: { item: SelfCheckItem; index: number }) {
  const [shown, setShown] = useState(false);
  const laSapXep = item.kind === REORDER;

  return (
    <div className="space-y-3 bg-white p-4 rounded-xl border border-[#E2E8F0]">
      <div className="flex items-start gap-2">
        <span className="text-sm font-bold text-[#0F172A]">{index}.</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#F1F5F9] px-2 py-[2px] text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">
              {laSapXep ? "Sắp xếp câu" : "Dịch câu"}
            </span>
            <span className="text-[11.5px] text-[#94A3B8]">Tự kiểm tra · không tính điểm</span>
          </div>

          {item.prompt && (
            <p className="text-sm font-medium text-[#0F172A] break-words">{item.prompt}</p>
          )}

          {laSapXep && item.words && item.words.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
              {item.words.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-xs font-medium text-[#334155]"
                >
                  {w}
                </li>
              ))}
            </ul>
          )}

          {shown ? (
            <p className="text-sm font-semibold text-green-700 break-words">{item.answer}</p>
          ) : (
            <button
              type="button"
              onClick={() => {
                lightImpact();
                setShown(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] hover:underline"
            >
              <Eye size={14} aria-hidden />
              Xem đáp án
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
