// `id` là giá trị gửi API (experienceLevel) — giữ nguyên, chỉ nhãn đi qua catalog
// `v2.student.companionSelect`. Dùng chung cho màn chọn người phỏng vấn và thẻ phỏng vấn theo nghề.
export const EXPERIENCE_LEVELS = [
  { id: "0-6M", labelKey: "experience.upTo6Months" },
  { id: "6-12M", labelKey: "experience.sixTo12Months" },
  { id: "1-2Y", labelKey: "experience.oneToTwoYears" },
  { id: "3Y", labelKey: "experience.threeYears" },
  { id: "5Y", labelKey: "experience.fivePlusYears" },
] as const;
