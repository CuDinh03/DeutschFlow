package com.deutschflow.moderation.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.moderation.dto.ModerationDtos.BlockedUserDto;
import com.deutschflow.moderation.entity.UserBlock;
import com.deutschflow.moderation.repository.UserBlockRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * User blocking (Apple Guideline 1.2). A block is one-directional from the blocker's perspective,
 * but message sending is refused in EITHER direction so neither party can reach the other.
 */
@Service
@RequiredArgsConstructor
public class UserBlockService {

    private final UserBlockRepository blockRepository;
    private final UserRepository userRepository;

    /** Blocks {@code blockedId} for {@code blockerId} (idempotent). */
    @Transactional
    public void block(Long blockerId, Long blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new BadRequestException("Không thể tự chặn chính mình.");
        }
        if (!userRepository.existsById(blockedId)) {
            throw new BadRequestException("Người dùng không tồn tại.");
        }
        if (blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            return; // already blocked — idempotent
        }
        blockRepository.save(UserBlock.builder()
                .blockerId(blockerId)
                .blockedId(blockedId)
                .createdAt(Instant.now())
                .build());
    }

    /** Removes the block (idempotent). */
    @Transactional
    public void unblock(Long blockerId, Long blockedId) {
        blockRepository.deleteByBlockerIdAndBlockedId(blockerId, blockedId);
    }

    /** True if either user has blocked the other — used to refuse messaging both ways. */
    @Transactional(readOnly = true)
    public boolean isBlockedEitherWay(Long a, Long b) {
        return blockRepository.existsBetween(a, b);
    }

    /** The set of user ids {@code userId} has blocked (to hide their content from this user's view). */
    @Transactional(readOnly = true)
    public Set<Long> blockedIds(Long userId) {
        return Set.copyOf(blockRepository.blockedIdsBy(userId));
    }

    /** The users this user has blocked, most-recent first (for the management screen). */
    @Transactional(readOnly = true)
    public List<BlockedUserDto> listBlocked(Long userId) {
        List<UserBlock> blocks = blockRepository.findByBlockerIdOrderByCreatedAtDesc(userId);
        if (blocks.isEmpty()) {
            return List.of();
        }
        Set<Long> ids = blocks.stream().map(UserBlock::getBlockedId).collect(Collectors.toSet());
        Map<Long, User> users = userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return blocks.stream()
                .map(b -> {
                    User u = users.get(b.getBlockedId());
                    return new BlockedUserDto(
                            b.getBlockedId(),
                            u != null ? u.getDisplayName() : "Người dùng",
                            b.getCreatedAt());
                })
                .toList();
    }
}
