import { useEffect, useState } from 'react'
import {
  View,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { BIRTH_DATE_SELF_DECLARE_ENABLED, profileApi, toIsoBirthDate } from '@/lib/profileApi'
import { avatarInitial } from '@/lib/avatarInitial'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, TextField, GaGlyph, Button } from '@/components/ui'
import { MeCard, PageTitle, SubHeader } from '@/components/me/MeParts'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

/** Cùng trần với backend (UserAvatarService.MAX_AVATAR_BYTES). */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

// Giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `profileedit`): nút "Lưu thay đổi" trên hàng đầu, thẻ ảnh
// đại diện có chip đổi ảnh, ô nhập có nhãn. Kiểm tra hợp lệ và luồng lưu giữ nguyên.
export default function EditProfileScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['settings/profile'])
  const theme = useTheme()
  const c = theme.colors
  const { user, setUser } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [phone, setPhone] = useState('')
  /** Giá trị vừa nạp từ máy chủ — mốc để biết người dùng có thật sự đổi gì không. */
  const [loadedPhone, setLoadedPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  // Ngày sinh: ba ô số, ghi được MỘT LẦN (backend chặn lần hai bằng 409).
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthDateLocked, setBirthDateLocked] = useState(false)
  const [savedBirthDate, setSavedBirthDate] = useState<string | null>(null)
  const [birthError, setBirthError] = useState<string | undefined>()

  // Nạp hồ sơ đầy đủ: /auth/me không trả số điện thoại lẫn ngày sinh.
  useEffect(() => {
    let cancelled = false
    profileApi
      .me()
      .then((me) => {
        if (cancelled) return
        setDisplayName((prev) => prev || me.displayName)
        setPhone(me.phoneNumber ?? '')
        setLoadedPhone(me.phoneNumber ?? '')
        setAvatarUrl(me.avatarUrl)
        setBirthDateLocked(me.birthDateLocked)
        setSavedBirthDate(me.birthDate)
        if (me.birthDate) {
          const [y, m, d] = me.birthDate.split('-')
          setBirthYear(y)
          setBirthMonth(String(Number(m)))
          setBirthDay(String(Number(d)))
        }
      })
      .catch(() => {
        /* offline: giữ nguyên giá trị từ store, người dùng vẫn sửa được tên */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const saveInfo = useMutation({
    mutationFn: () =>
      profileApi.update({
        displayName: displayName.trim(),
        phoneNumber: phone.trim() || undefined,
      }),
    onSuccess: () => {
      if (user) setUser({ ...user, displayName: displayName.trim() })
      Alert.alert('Đã lưu', 'Thông tin của bạn đã được cập nhật.')
      goBack()
    },
    onError: (e: unknown) => {
      // Backend nói rõ lý do (số điện thoại trùng, sai định dạng…) — đừng nuốt thành "thử lại".
      Alert.alert('Lỗi', messageOf(e, 'Không thể lưu thay đổi. Vui lòng thử lại.'))
    },
  })

  const saveBirthDate = useMutation({
    mutationFn: (iso: string) => profileApi.declareBirthDate(iso),
    onSuccess: (result) => {
      setBirthDateLocked(true)
      setSavedBirthDate(result.birthDate)
      Alert.alert(
        'Đã lưu ngày sinh',
        result.requiresGuardianConsent
          ? 'Tài khoản sẽ được áp các quy định bảo vệ người chưa thành niên.'
          : 'Cảm ơn bạn.'
      )
    },
    onError: (e: unknown) => Alert.alert('Lỗi', messageOf(e, 'Không thể lưu ngày sinh.')),
  })

  const confirmBirthDate = () => {
    setBirthError(undefined)
    const parsed = toIsoBirthDate(birthDay, birthMonth, birthYear)
    if ('error' in parsed) {
      setBirthError(parsed.error)
      return
    }
    // Ghi một lần là hệ quả không hoàn tác được — hỏi lại trước khi gửi.
    Alert.alert(
      'Xác nhận ngày sinh',
      `Ghi ${birthDay}/${birthMonth}/${birthYear} làm ngày sinh? Sau khi lưu bạn không tự sửa được, muốn sửa phải liên hệ trung tâm hoặc hỗ trợ. Dưới 16 tuổi thì phần luyện nói chờ cha mẹ/người giám hộ xác nhận.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Lưu', onPress: () => saveBirthDate.mutate(parsed.iso) },
      ]
    )
  }

  async function pickAvatar(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Cần cấp quyền', fromCamera ? 'Hãy cho phép truy cập máy ảnh.' : 'Hãy cho phép truy cập ảnh.')
      return
    }
    // allowsEditing + aspect 1:1 = khung cắt vuông SẴN CÓ của hệ điều hành — người dùng tự kéo và
    // phóng, không phải thêm thư viện cắt ảnh nào (thư viện native sẽ chặn đường phát hành OTA).
    const options = { allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.8 }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: 'images' })
    if (result.canceled) return
    const asset = result.assets[0]
    if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
      Alert.alert('Ảnh quá lớn', 'Hãy chọn ảnh nhỏ hơn 5MB.')
      return
    }
    setAvatarBusy(true)
    try {
      const url = await profileApi.uploadAvatar(
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
        asset.fileName ?? 'avatar.jpg'
      )
      setAvatarUrl(url)
      if (user) setUser({ ...user, avatarUrl: url })
    } catch (e: unknown) {
      Alert.alert('Lỗi', messageOf(e, 'Không thể tải ảnh lên.'))
    } finally {
      setAvatarBusy(false)
    }
  }

  function changeAvatar() {
    Alert.alert('Ảnh đại diện', undefined, [
      { text: 'Chụp ảnh', onPress: () => void pickAvatar(true) },
      { text: 'Chọn từ thư viện', onPress: () => void pickAvatar(false) },
      ...(avatarUrl ? [{ text: 'Gỡ ảnh', style: 'destructive' as const, onPress: removeAvatar }] : []),
      { text: 'Huỷ', style: 'cancel' as const },
    ])
  }

  function removeAvatar() {
    setAvatarBusy(true)
    profileApi
      .removeAvatar()
      .then(() => {
        setAvatarUrl(null)
        if (user) setUser({ ...user, avatarUrl: null })
      })
      .catch((e: unknown) => Alert.alert('Lỗi', messageOf(e, 'Không thể gỡ ảnh.')))
      .finally(() => setAvatarBusy(false))
  }

  const trimmed = displayName.trim()
  const nameTooShort = trimmed.length > 0 && trimmed.length < 2
  // So với giá trị ĐÃ NẠP chứ không so với chuỗi rỗng: so kiểu cũ thì tài khoản nào đã có số điện
  // thoại cũng thấy nút Lưu sáng sẵn dù chưa sửa gì.
  const infoChanged = trimmed !== (user?.displayName ?? '') || phone.trim() !== loadedPhone
  const canSave = trimmed.length >= 2 && infoChanged
  const initial = avatarInitial(displayName || user?.displayName)

  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
          <SubHeader
            onBack={goBack}
            right={
              <Button
                label="Lưu thay đổi"
                size="sm"
                fullWidth={false}
                onPress={() => canSave && saveInfo.mutate()}
                loading={saveInfo.isPending}
                disabled={!canSave || saveInfo.isPending}
              />
            }
          />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[10], gap: space[4] }}
          keyboardShouldPersistTaps="handled"
        >
          <PageTitle title="Thông tin cá nhân" />

          {/* Ảnh đại diện (mẫu `profileedit`): ảnh tròn, trần 5MB, chip đổi ảnh. */}
          <MeCard style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] + 2 }}>
            {/* Ảnh cũng bấm được, nhưng ẩn khỏi trình đọc màn hình — chip bên cạnh đã có nhãn (khỏi đọc trùng). */}
            <Pressable
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              onPress={changeAvatar}
              disabled={avatarBusy}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: 64, height: 64, borderRadius: radius.full }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: radius.full,
                    backgroundColor: c.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {avatarBusy ? (
                    <ActivityIndicator size="small" color={c.onAccent} />
                  ) : (
                    <ThemedText variant="display" color="onAccent">
                      {initial}
                    </ThemedText>
                  )}
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="bodyStrong">Ảnh đại diện</ThemedText>
              <ThemedText variant="caption" color="muted">
                Tối đa 5MB
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={avatarUrl ? 'Đổi ảnh đại diện' : 'Thêm ảnh đại diện'}
              accessibilityState={{ disabled: avatarBusy }}
              onPress={changeAvatar}
              disabled={avatarBusy}
              hitSlop={4}
              style={({ pressed }) => ({
                height: 36,
                paddingHorizontal: space[3] + 2,
                borderRadius: radius.full,
                backgroundColor: c.surfaceSunken,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed || avatarBusy ? 0.6 : 1,
              })}
            >
              <ThemedText variant="label">{avatarBusy ? 'Đang xử lý…' : avatarUrl ? 'Đổi ảnh' : 'Thêm ảnh'}</ThemedText>
            </Pressable>
          </MeCard>

          <TextField
            label="Tên hiển thị"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Nhập tên của bạn"
            returnKeyType="done"
            error={nameTooShort ? 'Tên phải có ít nhất 2 ký tự.' : undefined}
          />

          <TextField
            label="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            placeholder="0xxxxxxxxx"
            keyboardType="phone-pad"
            returnKeyType="done"
          />

          {/* Birth date — ghi một lần. Cờ BIRTH_DATE_SELF_DECLARE_ENABLED giữ lại để tắt nhanh
              (xem lib/profileApi.ts). */}
          {BIRTH_DATE_SELF_DECLARE_ENABLED && (
          <View style={{ gap: space[2] }}>
            <ThemedText variant="label" color="secondary">Ngày sinh</ThemedText>
            {birthDateLocked ? (
              <MeCard tone="sunken" style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <GaGlyph name="khoa" size={16} ink="muted" />
                <ThemedText variant="bodyLg" color="muted" style={{ flex: 1 }}>
                  {savedBirthDate ?? ''}
                </ThemedText>
              </MeCard>
            ) : (
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={birthDay}
                    onChangeText={setBirthDay}
                    placeholder="Ngày"
                    accessibilityLabel="Ngày sinh: ngày"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={birthMonth}
                    onChangeText={setBirthMonth}
                    placeholder="Tháng"
                    accessibilityLabel="Ngày sinh: tháng"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1.4 }}>
                  <TextField
                    value={birthYear}
                    onChangeText={setBirthYear}
                    placeholder="Năm"
                    accessibilityLabel="Ngày sinh: năm"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>
            )}
            <ThemedText variant="caption" color="muted">
              {birthDateLocked
                ? 'Đã ghi nhận. Nếu sai, hãy liên hệ trung tâm của bạn hoặc bộ phận hỗ trợ.'
                : 'Chỉ khai được một lần — dùng để áp các quy định bảo vệ người chưa thành niên. ' +
                  'Dưới 16 tuổi thì phần luyện nói chờ cha mẹ/người giám hộ xác nhận.'}
            </ThemedText>
            {birthError ? (
              <ThemedText variant="caption" style={{ color: c.danger }}>
                {birthError}
              </ThemedText>
            ) : null}
            {!birthDateLocked && (
              <Button
                label="Lưu ngày sinh"
                variant="secondary"
                onPress={confirmBirthDate}
                loading={saveBirthDate.isPending}
                disabled={saveBirthDate.isPending}
              />
            )}
          </View>
          )}

          {/* Email — locked field */}
          <View style={{ gap: space[2] }}>
            <ThemedText variant="label" color="secondary">Email</ThemedText>
            <MeCard tone="sunken" style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] }}>
              <GaGlyph name="khoa" size={16} ink="muted" />
              <ThemedText variant="bodyLg" color="muted" style={{ flex: 1 }} numberOfLines={1}>
                {user?.email}
              </ThemedText>
            </MeCard>
            <ThemedText variant="caption" color="muted">
              Email không thể thay đổi từ ứng dụng.
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

/** Lấy câu lỗi backend gửi kèm (ProblemDetail.detail) thay vì luôn hiện câu chung chung. */
function messageOf(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
  return detail?.detail || detail?.message || fallback
}
