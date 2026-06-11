package com.deutschflow.marketing.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.marketing.dto.FreeGradeRequest;
import com.deutschflow.marketing.dto.FreeGradeResponse;
import com.deutschflow.marketing.entity.MarketingLead;
import com.deutschflow.marketing.repository.MarketingLeadRepository;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.teacher.service.GradingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeadMagnetServiceTest {

    @Mock
    private MarketingLeadRepository leadRepository;
    @Mock
    private com.deutschflow.marketing.repository.SharedGradeReportRepository reportRepository;
    @Mock
    private GradingService gradingService;

    @InjectMocks
    private LeadMagnetService service;

    private static final String IP = "203.0.113.7";
    private static final String ESSAY =
            "Ich heiße Anna und ich wohne in Berlin. Ich lerne seit zwei Jahren Deutsch und es macht mir viel Spaß.";

    private FreeGradeRequest req(String name, String contact, String contactType, String essay, String website) {
        return new FreeGradeRequest(name, contact, contactType, "B1 Schreiben", essay, website);
    }

    private void allowRateLimits() {
        lenient().when(leadRepository.countByIpHashAndCreatedAtAfter(anyString(), any(Instant.class))).thenReturn(0L);
        lenient().when(leadRepository.countByCreatedAtAfter(any(Instant.class))).thenReturn(0L);
        lenient().when(leadRepository.save(any(MarketingLead.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("happy path: grades, captures lead, returns score + feedback")
    void happyPath() {
        allowRateLimits();
        when(gradingService.gradeGermanEssay(any(), any()))
                .thenReturn(new GradingService.EssayGrade(85, "Tốt, vài lỗi nhỏ về Artikel.", null));

        FreeGradeResponse res = service.gradeFree(req("Anna", "anna@example.com", null, ESSAY, null), IP);

        assertThat(res.score()).isEqualTo(85);
        assertThat(res.feedback()).contains("Artikel");
        ArgumentCaptor<MarketingLead> captor = ArgumentCaptor.forClass(MarketingLead.class);
        verify(leadRepository).save(captor.capture());
        MarketingLead saved = captor.getValue();
        assertThat(saved.getContact()).isEqualTo("anna@example.com");
        assertThat(saved.getContactType()).isEqualTo("EMAIL");
        assertThat(saved.getScore()).isEqualTo(85);
        assertThat(saved.getEssayChars()).isEqualTo(ESSAY.length());
        assertThat(saved.getIpHash()).isNotBlank().hasSize(64);
    }

    @Test
    @DisplayName("happy path also persists a shareable report and returns its token")
    void happyPath_sharesReport() {
        allowRateLimits();
        when(gradingService.gradeGermanEssay(any(), any()))
                .thenReturn(new GradingService.EssayGrade(88, "Sehr gut.", null));

        FreeGradeResponse res = service.gradeFree(req("Anna", "anna@example.com", null, ESSAY, null), IP);

        assertThat(res.shareToken()).isNotBlank();
        ArgumentCaptor<com.deutschflow.marketing.entity.SharedGradeReport> report =
                ArgumentCaptor.forClass(com.deutschflow.marketing.entity.SharedGradeReport.class);
        verify(reportRepository).save(report.capture());
        assertThat(report.getValue().getScore()).isEqualTo(88);
        assertThat(report.getValue().getShareToken()).isEqualTo(res.shareToken());
        assertThat(report.getValue().getFeedback()).isEqualTo("Sehr gut.");
    }

    @Test
    @DisplayName("growth stats aggregate leads + reports for the admin funnel")
    void growthStats() {
        when(leadRepository.count()).thenReturn(10L);
        when(leadRepository.countByCreatedAtAfter(any(Instant.class))).thenReturn(5L);
        when(reportRepository.count()).thenReturn(8L);
        when(reportRepository.countByCreatedAtAfter(any(Instant.class))).thenReturn(3L);
        when(reportRepository.averageScore()).thenReturn(78.36);
        when(leadRepository.countByContactType("EMAIL")).thenReturn(6L);
        when(leadRepository.countByContactType("ZALO")).thenReturn(4L);

        var stats = service.getGrowthStats();

        assertThat(stats.leadsTotal()).isEqualTo(10);
        assertThat(stats.reportsTotal()).isEqualTo(8);
        assertThat(stats.reports7d()).isEqualTo(3);
        assertThat(stats.avgScore()).isEqualTo(78.4); // làm tròn 1 chữ số
        assertThat(stats.emailLeads()).isEqualTo(6);
        assertThat(stats.zaloLeads()).isEqualTo(4);
    }

    @Test
    @DisplayName("growth stats: chưa có report → avg 0.0")
    void growthStats_noReports() {
        when(leadRepository.count()).thenReturn(0L);
        when(leadRepository.countByCreatedAtAfter(any(Instant.class))).thenReturn(0L);
        when(reportRepository.count()).thenReturn(0L);
        when(reportRepository.countByCreatedAtAfter(any(Instant.class))).thenReturn(0L);
        when(reportRepository.averageScore()).thenReturn(null);

        assertThat(service.getGrowthStats().avgScore()).isZero();
    }

    @Test
    @DisplayName("phone/zalo contact is classified as ZALO")
    void zaloContact() {
        allowRateLimits();
        when(gradingService.gradeGermanEssay(any(), any()))
                .thenReturn(new GradingService.EssayGrade(70, "OK", null));

        service.gradeFree(req("Minh", "0901234567", null, ESSAY, null), IP);

        ArgumentCaptor<MarketingLead> captor = ArgumentCaptor.forClass(MarketingLead.class);
        verify(leadRepository).save(captor.capture());
        assertThat(captor.getValue().getContactType()).isEqualTo("ZALO");
    }

    @Test
    @DisplayName("honeypot field tripped → 400, no AI call")
    void honeypot() {
        assertThatThrownBy(() -> service.gradeFree(req("Bot", "x@y.com", null, ESSAY, "http://spam"), IP))
                .isInstanceOf(BadRequestException.class);
        verify(gradingService, never()).gradeGermanEssay(any(), any());
        verify(leadRepository, never()).save(any());
    }

    @Test
    @DisplayName("essay shorter than minimum → 400")
    void essayTooShort() {
        assertThatThrownBy(() -> service.gradeFree(req("A", "a@b.com", null, "zu kurz", null), IP))
                .isInstanceOf(BadRequestException.class);
        verify(gradingService, never()).gradeGermanEssay(any(), any());
    }

    @Test
    @DisplayName("garbage contact (not email/phone) → 400")
    void invalidContact() {
        assertThatThrownBy(() -> service.gradeFree(req("A", "not-a-contact", null, ESSAY, null), IP))
                .isInstanceOf(BadRequestException.class);
        verify(gradingService, never()).gradeGermanEssay(any(), any());
    }

    @Test
    @DisplayName("per-IP daily limit reached → 429")
    void perIpLimit() {
        when(leadRepository.countByIpHashAndCreatedAtAfter(anyString(), any(Instant.class))).thenReturn(3L);

        assertThatThrownBy(() -> service.gradeFree(req("A", "a@b.com", null, ESSAY, null), IP))
                .isInstanceOf(RateLimitExceededException.class);
        verify(gradingService, never()).gradeGermanEssay(any(), any());
    }

    @Test
    @DisplayName("global daily cap reached → 429")
    void globalLimit() {
        when(leadRepository.countByIpHashAndCreatedAtAfter(anyString(), any(Instant.class))).thenReturn(0L);
        when(leadRepository.countByCreatedAtAfter(any(Instant.class))).thenReturn(200L);

        assertThatThrownBy(() -> service.gradeFree(req("A", "a@b.com", null, ESSAY, null), IP))
                .isInstanceOf(RateLimitExceededException.class);
        verify(gradingService, never()).gradeGermanEssay(any(), any());
    }

    @Test
    @DisplayName("AI returns no parseable score → lead still captured, then 503 AiServiceException")
    void aiFailureStillCapturesLead() {
        allowRateLimits();
        when(gradingService.gradeGermanEssay(any(), any()))
                .thenReturn(new GradingService.EssayGrade(null, null, null));

        assertThatThrownBy(() -> service.gradeFree(req("A", "a@b.com", null, ESSAY, null), IP))
                .isInstanceOf(AiServiceException.class);
        // lead is persisted even though grading failed (don't lose the contact)
        verify(leadRepository).save(any(MarketingLead.class));
    }
}
