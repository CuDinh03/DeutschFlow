package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VocabularyImageBatchService {

    private final JdbcTemplate jdbcTemplate;
    private final VocabularyImageGeneratorService generatorService;

    public int countMissingImages() {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words WHERE image_url IS NULL OR TRIM(image_url) = ''", Integer.class);
        return count == null ? 0 : count;
    }

    public List<Long> listMissingWordIds(int limit) {
        return listMissingWordIds(limit, null, null, null);
    }

    public List<Long> listMissingWordIds(int limit, String cefr, String dtype, String tag) {
        return listMissingWordIds(limit, cefr, dtype, tag, null);
    }

    public List<Long> listMissingWordIds(int limit, String cefr, String dtype, String tag, List<Long> approvedWordIds) {
        StringBuilder sql = new StringBuilder("SELECT id FROM words WHERE (image_url IS NULL OR TRIM(image_url) = '')");
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (cefr != null && !cefr.isBlank()) {
            sql.append(" AND cefr_level = ?");
            args.add(cefr.trim().toUpperCase());
        }
        if (dtype != null && !dtype.isBlank()) {
            sql.append(" AND dtype = ?");
            args.add(dtype.trim().toUpperCase());
        }
        if (tag != null && !tag.isBlank()) {
            sql.append(" AND tag = ?");
            args.add(tag.trim());
        }
        if (approvedWordIds != null && !approvedWordIds.isEmpty()) {
            sql.append(" AND id IN (");
            sql.append(String.join(",", java.util.Collections.nCopies(approvedWordIds.size(), "?")));
            sql.append(")");
            args.addAll(approvedWordIds);
        }
        sql.append(" ORDER BY id LIMIT ?");
        args.add(limit);
        return jdbcTemplate.queryForList(sql.toString(), Long.class, args.toArray());
    }

    @Transactional
    public int generateBatch(int limit, String personaStyle) {
        return generateBatch(limit, personaStyle, null, null, null);
    }

    @Transactional
    public int generateBatch(int limit, String personaStyle, String cefr, String dtype, String tag) {
        return generateBatch(limit, personaStyle, cefr, dtype, tag, null);
    }

    @Transactional
    public int generateBatch(int limit, String personaStyle, String cefr, String dtype, String tag, List<Long> approvedWordIds) {
        List<Long> ids = listMissingWordIds(limit, cefr, dtype, tag, approvedWordIds);
        for (Long wordId : ids) {
            Map<String, Object> row = jdbcTemplate.queryForMap("SELECT base_form, dtype, COALESCE(meaning, '') AS meaning FROM words WHERE id = ?", wordId);
            String baseForm = String.valueOf(row.get("base_form"));
            String wordDtype = String.valueOf(row.get("dtype"));
            String meaning = String.valueOf(row.get("meaning"));
            generatorService.generateAndApply(wordId, baseForm, meaning, wordDtype, personaStyle);
        }
        return ids.size();
    }

    @Transactional
    public int previewAndMarkMissing(int limit, String personaStyle) {
        return listMissingWordIds(limit).size();
    }

    public int countMissingImages(String cefr, String dtype, String tag) {
        return countMissingImages(cefr, dtype, tag, null);
    }

    public int countMissingImages(String cefr, String dtype, String tag, List<Long> approvedWordIds) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM words WHERE (image_url IS NULL OR TRIM(image_url) = '')");
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (cefr != null && !cefr.isBlank()) {
            sql.append(" AND cefr_level = ?");
            args.add(cefr.trim().toUpperCase());
        }
        if (dtype != null && !dtype.isBlank()) {
            sql.append(" AND dtype = ?");
            args.add(dtype.trim().toUpperCase());
        }
        if (tag != null && !tag.isBlank()) {
            sql.append(" AND tag = ?");
            args.add(tag.trim());
        }
        if (approvedWordIds != null && !approvedWordIds.isEmpty()) {
            sql.append(" AND id IN (");
            sql.append(String.join(",", java.util.Collections.nCopies(approvedWordIds.size(), "?")));
            sql.append(")");
            args.addAll(approvedWordIds);
        }
        Integer count = jdbcTemplate.queryForObject(sql.toString(), Integer.class, args.toArray());
        return count == null ? 0 : count;
    }

    public Map<String, Object> buildPromptContext(long wordId, String baseForm, String meaning, String dtype, String personaStyle) {
        return Map.of(
                "wordId", wordId,
                "baseForm", baseForm,
                "meaning", meaning,
                "dtype", dtype,
                "personaStyle", personaStyle
        );
    }
}
