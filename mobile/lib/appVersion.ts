// Chuỗi phiên bản ở chân trang Hồ sơ. Trước 06/09 là chuỗi gõ cứng "v1.0.0" nên lệch với bản
// 1.0.1 đang phát hành — giờ đọc từ native (expo-application: CFBundleShortVersionString /
// versionName + build number) và kèm 8 ký tự đầu của update id expo-updates để nhìn Hồ sơ là
// biết máy đang chạy OTA nào (đối chiếu `eas update:list`). Hàm thuần để test được không cần native.

export interface AppVersionInfo {
  /** Application.nativeApplicationVersion — null trong Expo Go / dev client. */
  version: string | null
  /** Application.nativeBuildVersion — null trong Expo Go / dev client. */
  build: string | null
  /** Updates.updateId — null khi chạy bundle nhúng trong build. */
  updateId: string | null
  /** Updates.isEmbeddedLaunch — true khi chưa nhận OTA nào. */
  isEmbeddedLaunch: boolean
}

export const OTA_ID_PREFIX_LENGTH = 8

export function formatAppVersion(info: AppVersionInfo): string {
  const version = info.version ? `v${info.version}` : 'dev'
  const build = info.build ? ` · build ${info.build}` : ''
  const ota = info.updateId && !info.isEmbeddedLaunch ? ` · OTA ${info.updateId.slice(0, OTA_ID_PREFIX_LENGTH)}` : ''
  return `MyDeutschFlow ${version}${build}${ota}`
}
