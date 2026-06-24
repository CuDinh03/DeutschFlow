package com.deutschflow.marketing.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.marketing.dto.FreeGradeRequest;
import com.deutschflow.marketing.dto.FreeGradeResponse;
import com.deutschflow.marketing.dto.GradeReportDto;
import com.deutschflow.marketing.dto.MarketingLeadDto;
import com.deutschflow.marketing.entity.MarketingLead;
import com.deutschflow.marketing.entity.SharedGradeReport;
import com.deutschflow.marketing.repository.MarketingLeadRepository;
import com.deutschflow.marketing.repository.SharedGradeReportRepository;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.teacher.service.GradingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Lead magnet "AI chấm thử 1 bài Schreiben B1 miễn phí" (checklist C8).
 *
 * <p>Endpoint public, không auth ⇒ chống lạm dụng nhiều lớp: honeypot, giới hạn độ dài bài,
 * rate-limit theo IP (đã hash) và global daily cap (chặn trần COGS). Tái dùng đúng lõi chấm bài
 * của {@link GradingService#gradeGermanEssay} (prompt đã sửa bug #94) để điểm/nhận xét nhất quán
 * với luồng chấm bài-tập có phí. Mỗi lượt lưu 1 {@link MarketingLead} để founder follow-up.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeadMagnetService {

    private static final int MIN_ESSAY_CHARS = 50;
    private static final int MAX_ESSAY_CHARS = 3_000;
    private static final int MAX_CONTACT_CHARS = 255;
    private static final int MAX_NAME_CHARS = 160;

    /** Số lượt chấm thử tối đa cho 1 IP trong 24h. */
    private static final int PER_IP_DAILY_LIMIT = 3;
    /** Trần toàn hệ thống / 24h — chặn worst-case chi phí AI khi bị spam. */
    private static final int GLOBAL_DAILY_LIMIT = 200;
    private static final Duration WINDOW = Duration.ofHours(24);
    private static final int RETRY_AFTER_SECONDS = 3_600;

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE = Pattern.compile("^[+0-9][0-9\\s.\\-]{7,19}$");

    private final MarketingLeadRepository leadRepository;
    private final SharedGradeReportRepository reportRepository;
    private final GradingService gradingService;

    /**
     * KHÔNG mở transaction quanh toàn bộ method (audit S-8/P-15): lời gọi LLM
     * ({@link GradingService#gradeGermanEssay}) mất vài giây và endpoint này public + không auth —
     * giữ một Hikari connection suốt lời gọi sẽ cạn pool khi bị spam (lặp lại sự cố DB-pool P0).
     * Các thao tác DB ở đây (đếm rate-limit, lưu lead/report) độc lập, tự commit riêng lẻ nên
     * không cần atomic chung.
     */
    public FreeGradeResponse gradeFree(FreeGradeRequest req, String clientIp) {
        // 1) Honeypot: người thật để trống; bot điền → loại sớm, không tốn token AI.
        if (req.website() != null && !req.website().isBlank()) {
            log.info("[LeadMagnet] honeypot tripped — dropping request from ipHash={}", hashIp(clientIp));
            throw new BadRequestException("Yêu cầu không hợp lệ.");
        }

        String essay = req.essay() == null ? "" : req.essay().trim();
        if (essay.length() < MIN_ESSAY_CHARS) {
            throw new BadRequestException("Bài viết quá ngắn (tối thiểu " + MIN_ESSAY_CHARS + " ký tự).");
        }
        if (essay.length() > MAX_ESSAY_CHARS) {
            throw new BadRequestException("Bài viết quá dài (tối đa " + MAX_ESSAY_CHARS + " ký tự).");
        }

        String contact = req.contact() == null ? "" : req.contact().trim();
        if (contact.isBlank() || contact.length() > MAX_CONTACT_CHARS) {
            throw new BadRequestException("Vui lòng nhập email hoặc số Zalo để nhận kết quả.");
        }
        String contactType = resolveContactType(contact, req.contactType());

        String name = req.name() == null ? null : req.name().trim();
        if (name != null && name.length() > MAX_NAME_CHARS) {
            name = name.substring(0, MAX_NAME_CHARS);
        }
        String topic = (req.topic() == null || req.topic().isBlank()) ? null : req.topic().trim();
        String ipHash = hashIp(clientIp);

        // 2) Rate limits (per-IP + global) trước khi gọi AI.
        Instant since = Instant.now().minus(WINDOW);
        if (ipHash != null && leadRepository.countByIpHashAndCreatedAtAfter(ipHash, since) >= PER_IP_DAILY_LIMIT) {
            throw new RateLimitExceededException(
                    "Bạn đã dùng hết lượt chấm thử miễn phí hôm nay. Vui lòng quay lại vào ngày mai hoặc đăng ký tài khoản.",
                    RETRY_AFTER_SECONDS);
        }
        if (leadRepository.countByCreatedAtAfter(since) >= GLOBAL_DAILY_LIMIT) {
            throw new RateLimitExceededException(
                    "Lượt chấm thử miễn phí hôm nay đã hết. Vui lòng thử lại sau hoặc đăng ký tài khoản.",
                    RETRY_AFTER_SECONDS);
        }

        // 3) Chấm bằng đúng lõi chấm bài-tập (reuse GradingService).
        GradingService.EssayGrade grade = gradingService.gradeGermanEssay(topic, essay);

        // 4) Lưu lead bất kể AI thành công hay không — contact là tài sản, không để mất.
        MarketingLead lead = leadRepository.save(MarketingLead.builder()
                .name(name)
                .contact(contact)
                .contactType(contactType)
                .source("FREE_GRADE_B1")
                .topic(topic)
                .essayChars(essay.length())
                .score(grade.score())
                .ipHash(ipHash)
                .build());
        log.info("[LeadMagnet] captured lead id={} contactType={} score={}", lead.getId(), contactType, grade.score());

        if (grade.score() == null) {
            // Đã lưu lead; báo AI bận để người dùng thử lại (không mất contact).
            throw new AiServiceException("Hệ thống AI đang bận. Chúng tôi đã lưu thông tin của bạn — vui lòng thử lại sau ít phút.");
        }

        String feedback = (grade.feedback() == null || grade.feedback().isBlank())
                ? "Bài viết đã được chấm. Đăng ký để nhận nhận xét chi tiết hơn."
                : grade.feedback();

        // 5) Lưu report công khai (không PII) để chia sẻ qua Zalo — vòng lặp PLG D6.
        String shareToken = newShareToken();
        reportRepository.save(SharedGradeReport.builder()
                .shareToken(shareToken)
                .topic(topic)
                .score(grade.score())
                .feedback(feedback)
                .source("FREE_GRADE_B1")
                .build());

        return new FreeGradeResponse(
                grade.score(),
                feedback,
                "Đây là bản chấm thử bằng AI. Đăng ký DeutschFlow để chấm không giới hạn, theo dõi tiến độ và luyện thi Goethe/telc.",
                shareToken);
    }

    /** Xem report công khai theo share token (cho trang /report/{token}). */
    @Transactional(readOnly = true)
    public GradeReportDto getReport(String shareToken) {
        return reportRepository.findByShareToken(shareToken)
                .map(GradeReportDto::from)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy báo cáo."));
    }

    /** Token chia sẻ ngẫu nhiên, URL-safe (UUID bỏ dấu gạch). */
    private static String newShareToken() {
        return java.util.UUID.randomUUID().toString().replace("-", "");
    }

    /** Số liệu phễu tăng trưởng (lead magnet + report) cho admin. */
    @Transactional(readOnly = true)
    public com.deutschflow.marketing.dto.GrowthStatsDto getGrowthStats() {
        Instant now = Instant.now();
        Instant since7d = now.minus(Duration.ofDays(7));
        Instant since24h = now.minus(WINDOW);
        Double avg = reportRepository.averageScore();
        return new com.deutschflow.marketing.dto.GrowthStatsDto(
                leadRepository.count(),
                leadRepository.countByCreatedAtAfter(since7d),
                leadRepository.countByCreatedAtAfter(since24h),
                reportRepository.count(),
                reportRepository.countByCreatedAtAfter(since7d),
                avg == null ? 0.0 : Math.round(avg * 10.0) / 10.0,
                leadRepository.countByContactType("EMAIL"),
                leadRepository.countByContactType("ZALO"));
    }

    /** Danh sách lead mới nhất cho admin follow-up (mặc định 30 ngày, giới hạn {@code limit}). */
    @Transactional(readOnly = true)
    public List<MarketingLeadDto> listRecentLeads(int days, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        var page = PageRequest.of(0, safeLimit);
        List<MarketingLead> rows = (days > 0)
                ? leadRepository.findRecentSince(Instant.now().minus(Duration.ofDays(days)), page)
                : leadRepository.findRecent(page);
        return rows.stream().map(MarketingLeadDto::from).toList();
    }

    /** EMAIL nếu có '@', ngược lại PHONE/ZALO nếu giống số; tôn trọng contactType client gửi nếu hợp lệ. */
    private static String resolveContactType(String contact, String requested) {
        if (requested != null) {
            String r = requested.trim().toUpperCase();
            if (r.equals("EMAIL") || r.equals("ZALO") || r.equals("PHONE")) {
                // vẫn validate hình dạng tối thiểu theo loại
                if (r.equals("EMAIL") && !EMAIL.matcher(contact).matches()) {
                    throw new BadRequestException("Email không hợp lệ.");
                }
                if ((r.equals("ZALO") || r.equals("PHONE")) && !PHONE.matcher(contact).matches()) {
                    throw new BadRequestException("Số điện thoại/Zalo không hợp lệ.");
                }
                return r;
            }
        }
        if (EMAIL.matcher(contact).matches()) {
            return "EMAIL";
        }
        if (PHONE.matcher(contact).matches()) {
            return "ZALO";
        }
        throw new BadRequestException("Vui lòng nhập email hoặc số Zalo hợp lệ.");
    }

    /** SHA-256 IP (không lưu IP thô). Null/blank IP → null. */
    private static String hashIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(ip.trim().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            return null;
        }
    }
}
