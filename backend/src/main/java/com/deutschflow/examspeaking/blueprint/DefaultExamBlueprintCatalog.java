package com.deutschflow.examspeaking.blueprint;

import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.entity.SpeakingExamBlueprint;
import com.deutschflow.examspeaking.repository.SpeakingExamBlueprintRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Đọc blueprint từ DB và parse thành record. Không cache ở Đợt 0 (bảng nhỏ, đọc ít). */
@Service
@RequiredArgsConstructor
public class DefaultExamBlueprintCatalog implements ExamBlueprintCatalog {

    private final SpeakingExamBlueprintRepository repository;
    private final BlueprintJsonCodec codec;

    @Override
    @Transactional(readOnly = true)
    public Optional<ExamBlueprint> find(ExamProvider provider, String level) {
        String lvl = level == null ? "" : level.trim().toUpperCase(Locale.ROOT);
        return repository.findFirstByProviderAndLevelAndActiveTrueOrderByVersionDesc(provider.name(), lvl)
                .map(this::toModel);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ExamBlueprint> findById(long blueprintId) {
        return repository.findById(blueprintId).map(this::toModel);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExamBlueprint> listActive() {
        return repository.findByActiveTrueOrderByProviderAscLevelAsc().stream().map(this::toModel).toList();
    }

    ExamBlueprint toModel(SpeakingExamBlueprint e) {
        return new ExamBlueprint(
                e.getId(),
                ExamProvider.valueOf(e.getProvider()),
                e.getLevel(),
                e.getVersion(),
                e.getTitle(),
                codec.parsePrepSec(e.getPartsJson()),
                codec.parseParts(e.getPartsJson()),
                codec.parseRubric(e.getRubricJson()));
    }
}
