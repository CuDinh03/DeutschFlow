package com.deutschflow.system.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.system.dto.MaintenanceWindowDto;
import com.deutschflow.system.entity.MaintenanceWindow;
import com.deutschflow.system.repository.MaintenanceWindowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Máy trạng thái cửa sổ bảo trì + chuỗi thông báo (plans/2026-09-03 §5.4–5.6).
 *
 * <p>Vòng đời: SCHEDULED → ACTIVE → COMPLETED | CANCELLED. Partial unique index
 * {@code uq_maintenance_windows_active} là chốt chặn cuối cho bất biến "một ACTIVE":
 * hai activate song song → một bên {@code DataIntegrityViolationException} → 409.
 *
 * <p>Thông báo đi qua hạ tầng notification có sẵn ({@code SYSTEM_MAINTENANCE},
 * broadcast ALL batch + Expo push batch). Mỗi mốc gửi ĐÚNG MỘT LẦN nhờ các cột
 * {@code notified_*}. Riêng kind STARTED chỉ ghi in-app (không push): màn chặn đã
 * nói điều đó, push lúc này chỉ là tiếng ồn.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MaintenanceWindowService {

    private final MaintenanceWindowRepository repository;
    private final MaintenanceStateService stateService;
    private final UserNotificationService userNotificationService;

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Value("${app.maintenance.remind-before-minutes:60}")
    private int remindBeforeMinutes;

    @Value("${app.maintenance.overdue-alert-minutes:30}")
    private int overdueAlertMinutes;

    // ── Bảo trì định kỳ hằng ngày (config-driven, mặc định TẮT) ──────────────
    @Value("${app.maintenance.daily.enabled:false}")
    private boolean dailyEnabled;

    /** Giờ bắt đầu theo giờ VN, dạng HH:mm. */
    @Value("${app.maintenance.daily.time:03:00}")
    private String dailyTime;

    @Value("${app.maintenance.daily.duration-minutes:15}")
    private int dailyDurationMinutes;

    @Value("${app.maintenance.daily.mode:FULL}")
    private String dailyMode;

    /** true = gửi SCHEDULED/REMINDER cho cửa sổ đêm; mặc định false (khỏi spam push mỗi đêm). */
    @Value("${app.maintenance.daily.notify:false}")
    private boolean dailyNotify;

    /** Tạo trước cửa sổ định kỳ chừng này phút để job kịp nhắc/bật. */
    @Value("${app.maintenance.daily.materialize-lead-minutes:180}")
    private int dailyMaterializeLeadMinutes;

    // ── Đọc ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<MaintenanceWindowDto> list(int page, int size) {
        return repository
                .findAllByOrderByStartsAtDesc(PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100)))
                .map(MaintenanceWindowDto::from);
    }

    // ── Mutation từ admin ────────────────────────────────────────────────────

    /**
     * Tạo lịch bảo trì. {@code notify=true} (mặc định) gửi ngay thông báo "có lịch"
     * cho toàn bộ user. Trả kèm danh sách id lịch chồng lấn (cảnh báo mềm, không chặn).
     */
    @Transactional
    public CreateResult create(String title, String note, Instant startsAtUtc, Instant endsAtUtc,
                               String mode, Boolean autoActivate, Boolean autoComplete,
                               boolean notify, String actorEmail) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime startsAt = toUtc(startsAtUtc, "startsAtUtc");
        LocalDateTime endsAt = endsAtUtc != null ? LocalDateTime.ofInstant(endsAtUtc, ZoneOffset.UTC) : null;

        if (startsAt.isBefore(now)) {
            throw new BadRequestException("startsAtUtc đã ở quá khứ — bảo trì ngay lập tức thì dùng /emergency.");
        }
        validateWindowShape(startsAt, endsAt, Boolean.TRUE.equals(autoComplete));

        MaintenanceWindow window = MaintenanceWindow.builder()
                .title(title.trim())
                .note(blankToNull(note))
                .startsAt(startsAt)
                .endsAt(endsAt)
                .mode(parseMode(mode))
                .status(MaintenanceWindow.Status.SCHEDULED)
                .autoActivate(autoActivate == null || autoActivate)
                .autoComplete(Boolean.TRUE.equals(autoComplete))
                .createdBy(actorEmail)
                .build();

        List<Long> overlapping = repository
                .findOverlapping(startsAt, endsAt != null ? endsAt : startsAt.plusYears(1),
                        List.of(MaintenanceWindow.Status.SCHEDULED, MaintenanceWindow.Status.ACTIVE))
                .stream().map(MaintenanceWindow::getId).toList();

        if (notify) {
            window.setNotifiedScheduleAt(now);
        }
        window = repository.save(window);
        if (notify) {
            broadcast(window, "SCHEDULED", true);
        }
        stateService.refreshNow();
        log.info("[maintenance] window id={} SCHEDULED {}..{} mode={} by {}",
                window.getId(), startsAt, endsAt, window.getMode(), actorEmail);
        return new CreateResult(MaintenanceWindowDto.from(window), overlapping);
    }

    public record CreateResult(MaintenanceWindowDto window, List<Long> overlappingIds) {}

    /**
     * Sửa lịch. SCHEDULED sửa được mọi trường; ACTIVE chỉ gia hạn/rút {@code endsAt}
     * và sửa {@code note}. Đổi giờ sau khi đã thông báo → gửi bản cập nhật; đổi
     * {@code startsAt} → reset mốc nhắc để nhắc lại theo giờ mới.
     */
    @Transactional
    public MaintenanceWindowDto update(long id, String title, String note, Instant startsAtUtc,
                                       Instant endsAtUtc, String mode, Boolean autoActivate,
                                       Boolean autoComplete) {
        MaintenanceWindow window = require(id);
        return switch (window.getStatus()) {
            case SCHEDULED -> updateScheduled(window, title, note, startsAtUtc, endsAtUtc, mode, autoActivate, autoComplete);
            case ACTIVE -> updateActive(window, title, note, startsAtUtc, endsAtUtc, mode, autoActivate, autoComplete);
            default -> throw new ConflictException(
                    "Lịch bảo trì đã " + window.getStatus() + " — không sửa được nữa.");
        };
    }

    private MaintenanceWindowDto updateScheduled(MaintenanceWindow window, String title, String note,
                                                 Instant startsAtUtc, Instant endsAtUtc, String mode,
                                                 Boolean autoActivate, Boolean autoComplete) {
        boolean timeChanged = false;
        if (startsAtUtc != null) {
            LocalDateTime startsAt = LocalDateTime.ofInstant(startsAtUtc, ZoneOffset.UTC);
            if (!startsAt.equals(window.getStartsAt())) {
                window.setStartsAt(startsAt);
                // Nhắc lại theo giờ mới — mốc nhắc cũ vô nghĩa khi giờ đã đổi.
                window.setNotifiedBeforeAt(null);
                timeChanged = true;
            }
        }
        if (endsAtUtc != null) {
            LocalDateTime endsAt = LocalDateTime.ofInstant(endsAtUtc, ZoneOffset.UTC);
            if (!endsAt.equals(window.getEndsAt())) {
                window.setEndsAt(endsAt);
                timeChanged = true;
            }
        }
        if (title != null && !title.isBlank()) window.setTitle(title.trim());
        if (note != null) window.setNote(blankToNull(note));
        if (mode != null) window.setMode(parseMode(mode));
        if (autoActivate != null) window.setAutoActivate(autoActivate);
        if (autoComplete != null) window.setAutoComplete(autoComplete);
        validateWindowShape(window.getStartsAt(), window.getEndsAt(), window.isAutoComplete());

        if (timeChanged && window.getNotifiedScheduleAt() != null) {
            broadcast(window, "UPDATED", true);
        }
        stateService.refreshNow();
        return MaintenanceWindowDto.from(repository.save(window));
    }

    private MaintenanceWindowDto updateActive(MaintenanceWindow window, String title, String note,
                                              Instant startsAtUtc, Instant endsAtUtc, String mode,
                                              Boolean autoActivate, Boolean autoComplete) {
        if (title != null || startsAtUtc != null || mode != null || autoActivate != null || autoComplete != null) {
            throw new BadRequestException(
                    "Đang ACTIVE chỉ sửa được endsAtUtc (gia hạn/kết thúc sớm dùng /complete) và note.");
        }
        if (endsAtUtc != null) {
            LocalDateTime endsAt = LocalDateTime.ofInstant(endsAtUtc, ZoneOffset.UTC);
            if (!endsAt.isAfter(window.getStartsAt())) {
                throw new BadRequestException("endsAtUtc phải sau startsAt.");
            }
            window.setEndsAt(endsAt);
            // Giờ dự kiến mới → chuông quên-tắt tính lại từ mốc mới.
            window.setOverdueAlertedAt(null);
        }
        if (note != null) window.setNote(blankToNull(note));
        stateService.refreshNow();
        return MaintenanceWindowDto.from(repository.save(window));
    }

    /** Bật sớm một lịch SCHEDULED. Bật "ngay bây giờ" nên startsAt kéo về now nếu đang ở tương lai. */
    @Transactional
    public MaintenanceWindowDto activate(long id) {
        MaintenanceWindow window = require(id);
        if (window.getStatus() != MaintenanceWindow.Status.SCHEDULED) {
            throw new ConflictException("Chỉ lịch SCHEDULED mới bật được (hiện là " + window.getStatus() + ").");
        }
        return MaintenanceWindowDto.from(doActivate(window));
    }

    /** Kết thúc bảo trì: ACTIVE → COMPLETED, endsAt = thời điểm thật, báo "đã hoạt động trở lại". */
    @Transactional
    public MaintenanceWindowDto complete(long id) {
        MaintenanceWindow window = require(id);
        if (window.getStatus() != MaintenanceWindow.Status.ACTIVE) {
            throw new ConflictException("Chỉ window ACTIVE mới kết thúc được (hiện là " + window.getStatus() + ").");
        }
        return MaintenanceWindowDto.from(doComplete(window));
    }

    /** Huỷ lịch SCHEDULED; chỉ báo huỷ cho user nếu trước đó đã báo có lịch. */
    @Transactional
    public MaintenanceWindowDto cancel(long id) {
        MaintenanceWindow window = require(id);
        if (window.getStatus() != MaintenanceWindow.Status.SCHEDULED) {
            throw new ConflictException("Chỉ lịch SCHEDULED mới huỷ được (hiện là " + window.getStatus() + ").");
        }
        window.setStatus(MaintenanceWindow.Status.CANCELLED);
        // Báo huỷ nếu user đã từng nghe về lịch này — QUA "có lịch" HOẶC qua "sắp bảo
        // trì" (fix §12b): job nhắc chạy độc lập theo notified_before_at, nên một lịch
        // notifyUsers=off vẫn có thể đã bắn REMINDER; huỷ im lặng để user chờ hụt.
        if (window.getNotifiedScheduleAt() != null || window.getNotifiedBeforeAt() != null) {
            broadcast(window, "CANCELLED", true);
        }
        MaintenanceWindow saved = repository.save(window);
        stateService.refreshNow();
        log.info("[maintenance] window id={} CANCELLED", id);
        return MaintenanceWindowDto.from(saved);
    }

    /**
     * Bảo trì KHẨN CẤP: tạo window ACTIVE ngay lập tức, mode FULL. Không broadcast
     * (màn chặn tự nói điều đó với người đang dùng; báo trước là vô nghĩa).
     */
    @Transactional
    public MaintenanceWindowDto emergency(String title, String note, Instant endsAtUtc, String actorEmail) {
        if (repository.findFirstByStatus(MaintenanceWindow.Status.ACTIVE).isPresent()) {
            throw new ConflictException("Đang có một window ACTIVE — kết thúc nó trước khi bật khẩn cấp.");
        }
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime endsAt = endsAtUtc != null ? LocalDateTime.ofInstant(endsAtUtc, ZoneOffset.UTC) : null;
        if (endsAt != null && !endsAt.isAfter(now)) {
            throw new BadRequestException("endsAtUtc phải ở tương lai.");
        }
        MaintenanceWindow window = MaintenanceWindow.builder()
                .title(title != null && !title.isBlank() ? title.trim() : "Bảo trì khẩn cấp")
                .note(blankToNull(note))
                .startsAt(now)
                .endsAt(endsAt)
                .mode(MaintenanceWindow.Mode.FULL)
                .status(MaintenanceWindow.Status.ACTIVE)
                .autoActivate(false)
                .autoComplete(false)
                .createdBy(actorEmail)
                .build();
        MaintenanceWindow saved = repository.save(window);
        stateService.refreshNow();
        log.warn("[maintenance] EMERGENCY window id={} ACTIVE by {}", saved.getId(), actorEmail);
        return MaintenanceWindowDto.from(saved);
    }

    // ── Nhịp job (MaintenanceWindowJob gọi từng bước, mỗi bước một transaction) ──

    /** Nhắc trước giờ bảo trì — đúng một lần mỗi window (notified_before_at). */
    @Transactional
    public int sendDueReminders() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        List<MaintenanceWindow> due = repository.findByStatusAndNotifiedBeforeAtIsNullAndStartsAtBetween(
                MaintenanceWindow.Status.SCHEDULED, now, now.plusMinutes(remindBeforeMinutes));
        for (MaintenanceWindow window : due) {
            window.setNotifiedBeforeAt(now);
            repository.save(window);
            broadcast(window, "REMINDER", true);
            log.info("[maintenance] reminder sent for window id={} (starts {})", window.getId(), window.getStartsAt());
        }
        return due.size();
    }

    /** Tự bật lịch đến giờ (auto_activate). */
    @Transactional
    public int activateDueWindows() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        List<MaintenanceWindow> due = repository.findByStatusAndAutoActivateTrueAndStartsAtLessThanEqual(
                MaintenanceWindow.Status.SCHEDULED, now);
        int activated = 0;
        for (MaintenanceWindow window : due) {
            doActivate(window);
            activated++;
        }
        return activated;
    }

    /** Tự tắt khi quá ends_at (chỉ window auto_complete=true — mặc định TẮT có chủ đích). */
    @Transactional
    public int completeDueWindows() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        List<MaintenanceWindow> due = repository.findByStatusAndAutoCompleteTrueAndEndsAtLessThanEqual(
                MaintenanceWindow.Status.ACTIVE, now);
        for (MaintenanceWindow window : due) {
            doComplete(window);
        }
        return due.size();
    }

    /**
     * Chuông quên tắt: ACTIVE quá ends_at + {@code overdueAlertMinutes} → báo admin
     * ({@code ADMIN_SYSTEM_ALERT} có sẵn), lặp lại theo cùng nhịp cho tới khi ai đó xử lý.
     */
    @Transactional
    public int alertOverdueWindows() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        List<MaintenanceWindow> overdue = repository.findByStatusAndEndsAtLessThanEqual(
                MaintenanceWindow.Status.ACTIVE, now.minusMinutes(overdueAlertMinutes));
        int alerted = 0;
        for (MaintenanceWindow window : overdue) {
            if (window.getOverdueAlertedAt() != null
                    && window.getOverdueAlertedAt().isAfter(now.minusMinutes(overdueAlertMinutes))) {
                continue; // đã réo trong nhịp gần nhất
            }
            window.setOverdueAlertedAt(now);
            repository.save(window);
            userNotificationService.onSystemAlert(
                    "maintenance",
                    "Bảo trì quá giờ dự kiến",
                    "Window #" + window.getId() + " (" + window.getTitle() + ") dự kiến xong lúc "
                            + MaintenanceStateService.displayVn(window.getEndsAt())
                            + " nhưng vẫn đang ACTIVE. Vào Admin → Bảo trì để kết thúc hoặc gia hạn.",
                    Map.of("windowId", window.getId()));
            alerted++;
        }
        return alerted;
    }

    /**
     * Bảo trì định kỳ hằng ngày (thiết kế §12b): nếu bật, đảm bảo tồn tại MỘT cửa sổ
     * SCHEDULED cho lần xảy ra kế tiếp (giờ VN), tạo trước {@code materialize-lead-minutes}
     * để job kịp nhắc/bật. auto_activate + auto_complete BẬT; recurrence_key chống trùng
     * (unique index) và loại khỏi banner. Job {@code activate/completeDueWindows} có sẵn
     * lo phần bật/tắt — method này chỉ "vật chất hoá" lịch.
     */
    @Transactional
    public int materializeDailyWindow() {
        if (!dailyEnabled) {
            return 0;
        }
        LocalTime tod = parseDailyTime();
        if (tod == null) {
            return 0;
        }
        ZonedDateTime nowVn = ZonedDateTime.now(VN_ZONE);
        ZonedDateTime occVn = nowVn.toLocalDate().atTime(tod).atZone(VN_ZONE);
        if (!occVn.isAfter(nowVn)) {
            occVn = occVn.plusDays(1); // hôm nay đã qua giờ → lần kế là ngày mai
        }
        // Chỉ tạo khi đã trong tầm lead (tránh tạo trước cả ngày); ngoài tầm thì để tick sau.
        if (Duration.between(nowVn, occVn).toMinutes() > dailyMaterializeLeadMinutes) {
            return 0;
        }
        String key = "daily:" + occVn.toLocalDate();
        if (repository.findByRecurrenceKey(key).isPresent()) {
            return 0;
        }
        LocalDateTime startsUtc = occVn.withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        MaintenanceWindow window = MaintenanceWindow.builder()
                .title("Bảo trì định kỳ hằng ngày")
                .startsAt(startsUtc)
                .endsAt(startsUtc.plusMinutes(Math.max(1, dailyDurationMinutes)))
                .mode(parseMode(dailyMode))
                .status(MaintenanceWindow.Status.SCHEDULED)
                .autoActivate(true)
                .autoComplete(true)
                .recurrenceKey(key)
                .createdBy("recurring-daily")
                .build();
        if (dailyNotify) {
            window.setNotifiedScheduleAt(LocalDateTime.now(ZoneOffset.UTC));
        }
        try {
            window = repository.saveAndFlush(window); // unique index chặn nếu node khác vừa tạo
        } catch (DataIntegrityViolationException e) {
            return 0;
        }
        if (dailyNotify) {
            broadcast(window, "SCHEDULED", true);
        }
        log.info("[maintenance] materialized daily window {} ({}..{} UTC, notify={})",
                key, startsUtc, window.getEndsAt(), dailyNotify);
        return 1;
    }

    /** "03:00" → LocalTime; cấu hình sai → null (log warn, coi như tắt định kỳ). */
    private LocalTime parseDailyTime() {
        try {
            return LocalTime.parse(dailyTime.trim());
        } catch (DateTimeParseException e) {
            log.warn("[maintenance] app.maintenance.daily.time không hợp lệ: '{}' (mong HH:mm) — bỏ qua định kỳ", dailyTime);
            return null;
        }
    }

    // ── Lõi chuyển trạng thái dùng chung ─────────────────────────────────────

    private MaintenanceWindow doActivate(MaintenanceWindow window) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        window.setStatus(MaintenanceWindow.Status.ACTIVE);
        if (window.getStartsAt().isAfter(now)) {
            window.setStartsAt(now); // bật sớm = bắt đầu từ bây giờ
        }
        // saveAndFlush để vi phạm uq_maintenance_windows_active nổ NGAY TRONG lời gọi
        // này (→ 409 qua handler DataIntegrityViolation), không đợi tới commit.
        MaintenanceWindow saved = repository.saveAndFlush(window);
        broadcast(saved, "STARTED", false); // in-app cho lịch sử; KHÔNG push
        stateService.refreshNow();
        log.warn("[maintenance] window id={} ACTIVE (mode={})", saved.getId(), saved.getMode());
        return saved;
    }

    private MaintenanceWindow doComplete(MaintenanceWindow window) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        window.setStatus(MaintenanceWindow.Status.COMPLETED);
        window.setEndsAt(now); // ghi thời điểm kết thúc THẬT (sớm hay muộn hơn dự kiến đều là sự thật)
        if (window.getNotifiedCompleteAt() == null) {
            window.setNotifiedCompleteAt(now);
            broadcast(window, "COMPLETED", true);
        }
        MaintenanceWindow saved = repository.save(window);
        stateService.refreshNow();
        log.info("[maintenance] window id={} COMPLETED", saved.getId());
        return saved;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void broadcast(MaintenanceWindow window, String kind, boolean withPush) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("kind", kind);
        payload.put("windowId", window.getId());
        payload.put("title", window.getTitle());
        if (window.getNote() != null) payload.put("note", window.getNote());
        payload.put("mode", window.getMode().name());
        payload.put("startsAtUtc", window.getStartsAt().toInstant(ZoneOffset.UTC).toString());
        payload.put("startsAtDisplay", MaintenanceStateService.displayVn(window.getStartsAt()));
        if (window.getEndsAt() != null) {
            payload.put("endsAtUtc", window.getEndsAt().toInstant(ZoneOffset.UTC).toString());
            payload.put("endsAtDisplay", MaintenanceStateService.displayVn(window.getEndsAt()));
        }
        userNotificationService.broadcastSystemMaintenance(payload, withPush);
    }

    private MaintenanceWindow require(long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lịch bảo trì #" + id));
    }

    private static void validateWindowShape(LocalDateTime startsAt, LocalDateTime endsAt, boolean autoComplete) {
        if (endsAt != null && !endsAt.isAfter(startsAt)) {
            throw new BadRequestException("endsAtUtc phải sau startsAtUtc.");
        }
        if (autoComplete && endsAt == null) {
            throw new BadRequestException("autoComplete cần endsAtUtc (không thể tự tắt khi chưa rõ giờ xong).");
        }
    }

    private static MaintenanceWindow.Mode parseMode(String mode) {
        if (mode == null || mode.isBlank()) {
            return MaintenanceWindow.Mode.FULL;
        }
        try {
            return MaintenanceWindow.Mode.valueOf(mode.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("mode phải là FULL hoặc ANNOUNCE_ONLY.");
        }
    }

    private static LocalDateTime toUtc(Instant instant, String field) {
        if (instant == null) {
            throw new BadRequestException(field + " là bắt buộc.");
        }
        return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
