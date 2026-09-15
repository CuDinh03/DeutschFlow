package com.deutschflow.organization.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bố cục cột roster — trọng tâm là cột {@code reportSharingConfirmed} (R6, scope
 * {@code GUARDIAN_REPORT_SHARING}): TÙY CHỌN, dò theo TÊN (kể cả bí danh tiếng Việt có dấu), tự bật
 * chế độ đọc theo tên như {@code consentConfirmed}, và KHÔNG được nhận nhầm với cột đồng ý ghi âm khi
 * hai cột đứng cạnh nhau trên cùng một tệp.
 */
@DisplayName("RosterColumnLayout — cột reportSharingConfirmed (R6) là TÙY CHỌN, dò theo tên")
class RosterColumnLayoutTest {

    private static String[] cols(String... c) {
        return c;
    }

    @Test
    @DisplayName("tệp ba cột cũ ⇒ legacy(): không đọc cột chưa thành niên, reportSharingConfirmed = -1")
    void legacyWhenNoMinorColumn() {
        RosterColumnLayout layout = RosterColumnLayout.fromHeader(cols("email", "displayName", "phone"));

        assertThat(layout).isEqualTo(RosterColumnLayout.legacy());
        assertThat(layout.readsMinorColumns()).isFalse();
        assertThat(layout.reportSharingConfirmed()).isEqualTo(-1);
    }

    @Test
    @DisplayName("tệp có guardianName mà không có birthDate/consentConfirmed/reportSharingConfirmed ⇒ vẫn legacy")
    void guardianColumnsAloneStayLegacy() {
        RosterColumnLayout layout = RosterColumnLayout.fromHeader(cols("email", "displayName", "guardianName", "guardianEmail"));

        assertThat(layout).isEqualTo(RosterColumnLayout.legacy());
    }

    @Test
    @DisplayName("chỉ có email,reportSharingConfirmed ⇒ bật chế độ đọc theo tên — tệp đánh dấu hàng loạt không bị bỏ qua im lặng")
    void reportSharingColumnAloneEnablesMinorMode() {
        RosterColumnLayout layout = RosterColumnLayout.fromHeader(cols("email", "reportSharingConfirmed"));

        assertThat(layout.readsMinorColumns()).isTrue();
        assertThat(layout.reportSharingConfirmed()).isEqualTo(1);
        assertThat(layout.birthDate()).isEqualTo(-1);
        assertThat(layout.consentConfirmed()).isEqualTo(-1);
        assertThat(layout.email()).isEqualTo(0);
        // Vị trí 1 đã có chủ (cột đồng ý) ⇒ KHÔNG lùi tên hiển thị về đó — nếu không ô "x" thành tên.
        assertThat(layout.displayName()).isEqualTo(-1);
    }

    @Test
    @DisplayName("bí danh: report_sharing, Report Sharing, guardianReportSharing, và các cách gõ tiếng Việt có dấu")
    void aliasesResolve() {
        String[] aliases = {
                "reportSharingConfirmed", "report_sharing_confirmed", "Report Sharing", "reportSharingConsent",
                "guardianReportSharing", "Chia sẻ phiếu", "Đồng ý chia sẻ phiếu", "Chia sẻ phiếu đánh giá",
                "Đồng ý chia sẻ phiếu đánh giá", "Chia sẻ phiếu với giám hộ", "Gửi phiếu phụ huynh",
        };
        for (String alias : aliases) {
            RosterColumnLayout layout = RosterColumnLayout.fromHeader(cols("email", "birthDate", alias));
            assertThat(layout.reportSharingConfirmed()).as("tiêu đề \"%s\"", alias).isEqualTo(2);
        }
    }

    @Test
    @DisplayName("hai cột đồng ý cạnh nhau không nhận nhầm nhau: \"Đồng ý\" là ghi âm, \"Đồng ý chia sẻ phiếu\" là chia sẻ phiếu")
    void consentAndReportSharingDoNotCollide() {
        RosterColumnLayout layout = RosterColumnLayout.fromHeader(cols("email", "Đồng ý", "Đồng ý chia sẻ phiếu"));

        assertThat(layout.consentConfirmed()).isEqualTo(1);
        assertThat(layout.reportSharingConfirmed()).isEqualTo(2);

        RosterColumnLayout swapped = RosterColumnLayout.fromHeader(cols("email", "Đồng ý chia sẻ phiếu", "Đồng ý"));
        assertThat(swapped.consentConfirmed()).isEqualTo(2);
        assertThat(swapped.reportSharingConfirmed()).isEqualTo(1);
    }

    @Test
    @DisplayName("thứ tự cột tuỳ ý — đủ chín cột, mỗi cột về đúng vị trí")
    void fullHeaderAnyOrder() {
        RosterColumnLayout layout = RosterColumnLayout.fromHeader(cols(
                "reportSharingConfirmed", "consentConfirmed", "guardianEmail", "guardianRelationship",
                "guardianPhone", "guardianName", "birthDate", "displayName", "email"));

        assertThat(layout.reportSharingConfirmed()).isEqualTo(0);
        assertThat(layout.consentConfirmed()).isEqualTo(1);
        assertThat(layout.guardianEmail()).isEqualTo(2);
        assertThat(layout.guardianRelationship()).isEqualTo(3);
        assertThat(layout.guardianPhone()).isEqualTo(4);
        assertThat(layout.guardianName()).isEqualTo(5);
        assertThat(layout.birthDate()).isEqualTo(6);
        assertThat(layout.displayName()).isEqualTo(7);
        assertThat(layout.email()).isEqualTo(8);
        assertThat(layout.readsMinorColumns()).isTrue();
    }

    @Test
    @DisplayName("normalize: bỏ dấu, bỏ ký tự lạ, hạ chữ thường — cùng kết quả với normalizeHeader ở orgCsv.ts")
    void normalizeFoldsVietnamese() {
        assertThat(RosterColumnLayout.normalize("Đồng ý chia sẻ phiếu đánh giá")).isEqualTo("dongychiasephieudanhgia");
        assertThat(RosterColumnLayout.normalize(" report_sharing-Confirmed ")).isEqualTo("reportsharingconfirmed");
        assertThat(RosterColumnLayout.normalize(null)).isEmpty();
    }
}
