package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.AvailabilitySlot;
import com.deutschflow.teacher.entity.TeacherProfile;
import com.deutschflow.teacher.repository.TeacherProfileRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Teacher weekly-recurring availability ("Lịch dạy"). Stored as JSON in
 * {@code teacher_profiles.available_slots_json}. A teacher reads/writes only their own slots; the
 * profile row is created on first save if it does not exist yet (mirrors the marketplace pattern).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class TeacherAvailabilityService {

    private static final int MAX_SLOTS = 100;
    private static final Pattern HH_MM = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    private final TeacherProfileRepository teacherProfileRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<AvailabilitySlot> getSlots(Long userId) {
        return teacherProfileRepository.findByUserId(userId)
                .map(profile -> parse(profile.getAvailableSlotsJson()))
                .orElseGet(List::of);
    }

    /** Replaces the teacher's weekly slots (validated, normalized); returns what was stored. */
    @Transactional
    public List<AvailabilitySlot> setSlots(Long userId, List<AvailabilitySlot> slots) {
        List<AvailabilitySlot> validated = validate(slots);
        TeacherProfile profile = teacherProfileRepository.findByUserId(userId)
                .orElseGet(() -> createProfile(userId));
        profile.setAvailableSlotsJson(serialize(validated));
        profile.setUpdatedAt(LocalDateTime.now());
        teacherProfileRepository.save(profile);
        return validated;
    }

    private TeacherProfile createProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        TeacherProfile profile = new TeacherProfile();
        profile.setUser(user);
        profile.setHeadline("");
        profile.setCreatedAt(LocalDateTime.now());
        return profile;
    }

    private List<AvailabilitySlot> validate(List<AvailabilitySlot> slots) {
        if (slots == null || slots.isEmpty()) {
            return List.of();
        }
        if (slots.size() > MAX_SLOTS) {
            throw new BadRequestException("Quá nhiều khung giờ (tối đa " + MAX_SLOTS + ")");
        }
        for (AvailabilitySlot slot : slots) {
            if (slot == null) {
                throw new BadRequestException("Khung giờ không hợp lệ");
            }
            if (slot.day() < 0 || slot.day() > 6) {
                throw new BadRequestException("Ngày trong tuần không hợp lệ (0–6)");
            }
            if (slot.start() == null || !HH_MM.matcher(slot.start()).matches()
                    || slot.end() == null || !HH_MM.matcher(slot.end()).matches()) {
                throw new BadRequestException("Giờ phải có dạng HH:mm");
            }
            if (slot.start().compareTo(slot.end()) >= 0) {
                throw new BadRequestException("Giờ bắt đầu phải trước giờ kết thúc");
            }
        }
        return List.copyOf(slots);
    }

    private List<AvailabilitySlot> parse(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<AvailabilitySlot> slots = objectMapper.readValue(json, new TypeReference<>() {});
            return slots == null ? List.of() : slots;
        } catch (Exception e) {
            log.warn("Bỏ qua available_slots_json hỏng (userId profile): {}", e.getMessage());
            return List.of();
        }
    }

    private String serialize(List<AvailabilitySlot> slots) {
        try {
            return objectMapper.writeValueAsString(slots);
        } catch (Exception e) {
            throw new BadRequestException("Không thể lưu lịch dạy");
        }
    }
}
