package com.deutschflow.messaging.repository;

import com.deutschflow.messaging.entity.ClassChannelMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClassChannelMessageRepository extends JpaRepository<ClassChannelMessage, Long> {

    /** Most-recent 200 messages of a class channel (newest first); the client reverses for display. */
    List<ClassChannelMessage> findTop200ByClassIdOrderByIdDesc(Long classId);
}
