package com.deutschflow.user.repository;

import com.deutschflow.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query(value = "SELECT id FROM users WHERE role = :role AND is_active IS TRUE ORDER BY id ASC",
            nativeQuery = true)
    List<Long> findActiveIdsByRole(@Param("role") String role);
}
