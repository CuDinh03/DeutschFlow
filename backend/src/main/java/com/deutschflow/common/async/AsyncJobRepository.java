package com.deutschflow.common.async;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AsyncJobRepository extends JpaRepository<AsyncJob, UUID> {
}
