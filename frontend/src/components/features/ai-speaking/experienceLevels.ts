// `id` là giá trị gửi API (experienceLevel) — giữ nguyên, chỉ nhãn đi qua catalog
// `v2.student.companionSelect`. Dùng chung cho màn chọn người phỏng vấn và thẻ phỏng vấn theo nghề.
export const EXPERIENCE_LEVELS = [
  { id: "0-6M", labelId: "experience.upTo6Months" },
  { id: "6-12M", labelId: "experience.sixTo12Months" },
  { id: "1-2Y", labelId: "experience.oneToTwoYears" },
  { id: "3Y", labelId: "experience.threeYears" },
  { id: "5Y", labelId: "experience.fivePlusYears" },
] as const;
