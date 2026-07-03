package com.deutschflow.moderation.repository;

import com.deutschflow.moderation.entity.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {

    boolean existsByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    void deleteByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    List<UserBlock> findByBlockerIdOrderByCreatedAtDesc(Long blockerId);

    /** A block exists in either direction between the two users. */
    @Query("select count(b) > 0 from UserBlock b "
            + "where (b.blockerId = :a and b.blockedId = :b) or (b.blockerId = :b and b.blockedId = :a)")
    boolean existsBetween(@Param("a") Long a, @Param("b") Long b);

    /** Ids the given user has blocked (to hide their content from the blocker's view). */
    @Query("select b.blockedId from UserBlock b where b.blockerId = :userId")
    List<Long> blockedIdsBy(@Param("userId") Long userId);
}
