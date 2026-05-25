import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCdnUrl(key?: string | null) {
  if (!key) return "/default-avatar.png";

  const base = process.env.NEXT_PUBLIC_CLOUDFRONT_URL;
  if (!base) return key;

  return `${base.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}
