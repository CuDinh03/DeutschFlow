package com.deutschflow.examspeaking.session;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.entity.SpeakingExamTask;
import com.deutschflow.examspeaking.repository.SpeakingExamTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/** Rút đề ngẫu nhiên, không trùng, đủ số thẻ của Teil. Thiếu đề → 409 rõ ràng thay vì phiên hỏng nửa chừng. */
@Service
@RequiredArgsConstructor
public class ExamTaskBankService {

    private final SpeakingExamTaskRepository taskRepository;
    private final Random random = new Random();

    @Transactional(readOnly = true)
    public List<SpeakingExamTask> pick(ExamBlueprint bp, BlueprintPart part) {
        List<SpeakingExamTask> pool = new ArrayList<>(taskRepository.findApproved(
                bp.provider().name(), bp.level(), part.teilNo(), part.archetype().name()));
        int need = Math.max(1, part.cardsNeeded());
        if (pool.size() < need) {
            throw new ConflictException("Chưa đủ đề cho " + bp.provider() + " " + bp.level() + " Teil " + part.teilNo()
                    + " (cần " + need + ", có " + pool.size() + ")");
        }
        Collections.shuffle(pool, random);
        return List.copyOf(pool.subList(0, need));
    }
}
