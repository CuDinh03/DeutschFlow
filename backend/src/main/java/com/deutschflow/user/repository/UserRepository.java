package com.deutschflow.user.repository;

import com.deutschflow.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    /**
     * Case-insensitive email lookup ({@code WHERE upper(email) = upper(?)}). Authentication and any
     * other "find the account for this typed email" flow MUST use this, not {@link #findByEmail}.
     * Emails are stored canonical lowercase (admin createUser + register normalize; V237 backfilled
     * existing rows), but a user typing a single capital (mobile keyboards auto-capitalize the first
     * letter) or a stray space would miss an exact match — Spring then hides the user-not-found as
     * {@code BadCredentialsException}, surfacing as a misleading "wrong password".
     */
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    /** Case-insensitive existence check — blocks creating {@code Foo@x.com} when {@code foo@x.com} exists. */
    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhoneNumber(String phoneNumber);

    @Query(value = "SELECT id FROM users WHERE role = :role AND is_active IS TRUE ORDER BY id ASC",
            nativeQuery = true)
    List<Long> findActiveIdsByRole(@Param("role") String role);

    List<User> findByRoleAndActiveTrue(User.Role role);

    /** All active users — filtered at the DB instead of loading every row via findAll(). */
    List<User> findByActiveTrue();

    /** "Free teachers" (B2B §4): active TEACHERs with no ACTIVE org membership (derived via
     *  {@code users.org_id IS NULL} — the denormalized fast-path kept in sync by OrgMembershipService). */
    List<User> findByRoleAndOrgIdIsNullAndActiveTrue(User.Role role);
}
