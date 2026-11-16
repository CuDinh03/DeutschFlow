package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.PracticeProgramDtos.ProgramDto;
import com.deutschflow.organization.dto.PracticeProgramDtos.SaveRequest;
import com.deutschflow.organization.entity.ClassPracticeProgram;
import com.deutschflow.organization.repository.ClassPracticeProgramRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Đặc tả luyendeu ORG-50/51/65 — khai chương trình, khoá sau tuần 1, cờ chỉ nói. */
class ClassPracticeProgramServiceTest {

    private static final long ORG = 7L;
    private static final long CLASS = 42L;
    private static final LocalDate MON = LocalDate.of(2026, 12, 7);
    private static final AuditActor ACTOR = new AuditActor(1L, "owner@x.test", "STUDENT");

    private ClassPracticeProgramRepository repo;
    private TeacherClassRepository classes;
    private AuditLogService audit;

    @BeforeEach
    void setUp() {
        repo = mock(ClassPracticeProgramRepository.class);
        classes = mock(TeacherClassRepository.class);
        audit = mock(AuditLogService.class);
        TeacherClass tc = new TeacherClass();
        tc.setId(CLASS);
        tc.setOrgId(ORG);
        when(classes.findById(CLASS)).thenReturn(Optional.of(tc));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    /** "Hôm nay" theo giờ VN = {@code day} lúc 10:00. */
    private ClassPracticeProgramService at(LocalDate day) {
        Instant t = day.atTime(10, 0).toInstant(ZoneOffset.ofHours(7));
        return new ClassPracticeProgramService(repo, classes, audit, Clock.fixed(t, ZoneOffset.UTC));
    }

    private ClassPracticeProgram existing(int weeks, int target, int required) {
        ClassPracticeProgram p = ClassPracticeProgram.builder().classId(CLASS).startDate(MON).weeks(weeks)
                .targetPerWeek(target).weeksRequired(required).build();
        when(repo.findById(CLASS)).thenReturn(Optional.of(p));
        return p;
    }

    @Test
    void khaiMoi_dungMacDinh_vaGhiVet() {
        when(repo.findById(CLASS)).thenReturn(Optional.empty());
        ProgramDto dto = at(LocalDate.of(2026, 12, 1)).save(ORG, CLASS, new SaveRequest(MON, null, null, null), ACTOR);

        assertThat(dto.weeks()).isEqualTo(6);
        assertThat(dto.targetPerWeek()).isEqualTo(3);
        assertThat(dto.weeksRequired()).isEqualTo(4);
        assertThat(dto.endDate()).isEqualTo(LocalDate.of(2027, 1, 17));
        assertThat(dto.currentWeek()).isZero();
        assertThat(dto.locked()).isFalse();
        verify(audit).log(eq("org.practice_program.saved"), eq(ACTOR), eq("CLASS"), eq("42"), eq(ORG), anyMap());
    }

    @Test
    void ngayBatDauKhongPhaiThuHai_400() {
        assertThatThrownBy(() -> at(MON).save(ORG, CLASS, new SaveRequest(MON.plusDays(1), 6, 3, 4), ACTOR))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void giaTriNgoaiKhoang_400() {
        var svc = at(MON);
        assertThatThrownBy(() -> svc.save(ORG, CLASS, new SaveRequest(MON, 13, 3, 4), ACTOR))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> svc.save(ORG, CLASS, new SaveRequest(MON, 6, 15, 4), ACTOR))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> svc.save(ORG, CLASS, new SaveRequest(MON, 3, 3, 4), ACTOR))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void lopCuaOrgKhac_404() {
        assertThatThrownBy(() -> at(MON).save(99L, CLASS, new SaveRequest(MON, 6, 3, 4), ACTOR))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> at(MON).get(99L, CLASS)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void trongTuan1_vanSuaDuocMoiThu() {
        existing(6, 3, 4);
        ProgramDto dto = at(MON.plusDays(6)).save(ORG, CLASS, new SaveRequest(MON, 6, 2, 3), ACTOR);
        assertThat(dto.targetPerWeek()).isEqualTo(2);
        assertThat(dto.currentWeek()).isEqualTo(1);
    }

    @Test
    void sauTuan1_doiChiTieu_409() {
        existing(6, 3, 4);
        var svc = at(MON.plusWeeks(1));
        assertThatThrownBy(() -> svc.save(ORG, CLASS, new SaveRequest(MON, 6, 2, 4), ACTOR))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> svc.save(ORG, CLASS, new SaveRequest(MON.minusWeeks(1), 6, 3, 4), ACTOR))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> svc.save(ORG, CLASS, new SaveRequest(MON, 6, 3, 3), ACTOR))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void sauTuan1_doiSoTuan_chiKhiTuanMoiChuaBatDau() {
        existing(6, 3, 4);
        // Hôm nay thuộc tuần 3.
        var svc = at(MON.plusWeeks(2).plusDays(2));
        assertThat(svc.save(ORG, CLASS, new SaveRequest(MON, 8, 3, 4), ACTOR).weeks()).isEqualTo(8);
        existing(6, 3, 4);
        assertThat(svc.save(ORG, CLASS, new SaveRequest(MON, 4, 3, 4), ACTOR).weeks()).isEqualTo(4);
        existing(6, 3, 2);
        assertThatThrownBy(() -> svc.save(ORG, CLASS, new SaveRequest(MON, 2, 3, 2), ACTOR))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void coChiNoi_hoiRepoTheoNgayGioVietNam() {
        // 23:30 UTC ngày 06/12 = 06:30 thứ Hai 07/12 giờ VN.
        Instant t = Instant.parse("2026-12-06T23:30:00Z");
        var svc = new ClassPracticeProgramService(repo, classes, audit, Clock.fixed(t, ZoneOffset.UTC));
        when(repo.isStudentInRunningProgram(5L, MON)).thenReturn(true);

        assertThat(svc.isSpeakOnly(5L)).isTrue();
        assertThat(svc.isSpeakOnly(null)).isFalse();
    }

    @Test
    void tuanHienTai_bienChuongTrinh() {
        assertThat(ClassPracticeProgramService.currentWeek(MON, 6, MON.minusDays(1))).isZero();
        assertThat(ClassPracticeProgramService.currentWeek(MON, 6, MON)).isEqualTo(1);
        assertThat(ClassPracticeProgramService.currentWeek(MON, 6, MON.plusDays(13))).isEqualTo(2);
        assertThat(ClassPracticeProgramService.currentWeek(MON, 6, MON.plusWeeks(6))).isEqualTo(7);
    }
}
