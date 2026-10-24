package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Một nghề trong danh mục phỏng vấn theo nghề (V334, đợt 2a A + B + E).
 *
 * <p>{@code legacyPersonaCode} + {@code legacyPositionDe} chỉ có khi nghề trùng đúng một vị trí
 * cũ của nhân vật — nghề đó dùng bộ câu hỏi viết tay của nhân vật. Nghề còn lại dùng bộ chung
 * (DEFAULT) cho tới khi có lớp câu hỏi theo nghề (đợt 2b).
 */
@Entity
@Table(name = "occupation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Occupation {

    @Id
    @Column(name = "code", length = 64)
    private String code;

    @Column(name = "name_de", nullable = false, length = 160)
    private String nameDe;

    @Column(name = "name_en", nullable = false, length = 160)
    private String nameEn;

    @Column(name = "name_vi", nullable = false, length = 160)
    private String nameVi;

    /** gastro | pflege | bau | industrie | logistik | handel | buero | bildung */
    @Column(name = "workplace", nullable = false, length = 32)
    private String workplace;

    /** Từ khoá tìm kiếm, cách nhau bằng dấu phẩy. */
    @Column(name = "aliases", columnDefinition = "TEXT")
    private String aliases;

    @Column(name = "legacy_persona_code", length = 32)
    private String legacyPersonaCode;

    @Column(name = "legacy_position_de", length = 100)
    private String legacyPositionDe;

    @Column(name = "sort_rank", nullable = false)
    @Builder.Default
    private int sortRank = 1000;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private LocalDateTime updatedAt;
}
