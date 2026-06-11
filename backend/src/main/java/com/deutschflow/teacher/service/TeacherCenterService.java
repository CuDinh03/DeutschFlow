package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lets a teacher self-declare the center they teach at (checklist D11). For non-org (free) teachers
 * this is the only org-affiliation signal we have; ≥N teachers sharing a center becomes a B2B lead.
 */
@Service
@RequiredArgsConstructor
public class TeacherCenterService {

    private static final int MAX_LENGTH = 255;

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public String getCenter(Long userId) {
        return userRepository.findById(userId).map(User::getCenterName).orElse(null);
    }

    /** Sets (or clears, when blank) the teacher's center; returns the normalized stored value. */
    @Transactional
    public String setCenter(Long userId, String centerName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        String normalized = normalize(centerName);
        user.setCenterName(normalized);
        userRepository.save(user);
        return normalized;
    }

    private String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() > MAX_LENGTH ? trimmed.substring(0, MAX_LENGTH) : trimmed;
    }
}
