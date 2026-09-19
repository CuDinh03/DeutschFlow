// Stub `expo-localization` cho ts-jest (gói thật là ESM + native). Mặc định thiết bị tiếng Việt;
// test đổi ngôn ngữ bằng `__setLocale` rồi `resetDeviceLocaleForTests()` của lib/i18n.
let languageCode = 'vi'
export function __setLocale(code: string) {
  languageCode = code
}
export function getLocales() {
  return [{ languageCode, languageTag: languageCode, regionCode: null }]
}
