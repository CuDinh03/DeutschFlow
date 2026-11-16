package com.deutschflow.feedback;

import com.deutschflow.user.entity.User;

import java.util.EnumSet;
import java.util.Set;

/** Các tập giá trị đóng của góp ý (đặc tả gopycapnhat, mục 10). */
public final class FeedbackEnums {

    private FeedbackEnums() {}

    public enum Source { IN_APP, RATING_INVITE, AFTER_MOCK }

    public enum Type { BUG, IDEA, USABILITY, GENERAL }

    /** Mục 9. Lời trả lời không phải trạng thái. */
    public enum Status {
        NEW, READ, IN_PROGRESS, SHIPPED, DECLINED;

        /** Bảng chuyển trạng thái do ADMIN làm (mục 9). Cùng trạng thái = không đổi, không phải lỗi. */
        public boolean canMoveTo(Status target) {
            if (this == target) return true;
            return switch (target) {
                case NEW -> false;
                case READ -> this == NEW || this == SHIPPED || this == DECLINED;
                case IN_PROGRESS -> this == NEW || this == READ || this == SHIPPED || this == DECLINED;
                case SHIPPED, DECLINED -> this == NEW || this == READ || this == IN_PROGRESS;
            };
        }
    }

    /**
     * Nhóm người gửi, quyết định danh sách "Liên quan phần nào?" (FBK-04, FBK-13). ADMIN không gửi
     * góp ý (dùng ghi chú nội bộ), nên không có ở đây.
     */
    public enum Audience {
        STUDENT, TEACHER, ORG;

        public static Audience of(User.Role role) {
            return switch (role) {
                case STUDENT -> STUDENT;
                case TEACHER -> TEACHER;
                case OWNER, MANAGER -> ORG;
                case ADMIN -> null;
            };
        }
    }

    /** Phần liên quan. Mỗi nhóm người gửi chỉ chọn được các phần của mình. */
    public enum Area {
        // Học viên
        EXAM, SPEAKING, INTERVIEW, VOCABULARY, ROADMAP, BILLING, IOS_APP,
        // Giáo viên
        CLASSES, GRADING, SCHEDULE, MATERIALS,
        // Trung tâm
        STUDENTS, REPORTS,
        // Chung
        OTHER;

        private static final Set<Area> STUDENT_AREAS =
                EnumSet.of(EXAM, SPEAKING, INTERVIEW, VOCABULARY, ROADMAP, BILLING, IOS_APP, OTHER);
        private static final Set<Area> TEACHER_AREAS = EnumSet.of(CLASSES, GRADING, SCHEDULE, MATERIALS, OTHER);
        private static final Set<Area> ORG_AREAS = EnumSet.of(STUDENTS, CLASSES, REPORTS, BILLING, OTHER);

        public static Set<Area> forAudience(Audience audience) {
            return switch (audience) {
                case STUDENT -> STUDENT_AREAS;
                case TEACHER -> TEACHER_AREAS;
                case ORG -> ORG_AREAS;
            };
        }
    }
}
