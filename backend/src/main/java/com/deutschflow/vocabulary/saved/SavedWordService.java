package com.deutschflow.vocabulary.saved;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.deutschflow.srs.service.SrsService;
import com.deutschflow.vocabulary.dto.TagItem;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SaveRequest;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SavedWord;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SavedWordList;
import com.deutschflow.vocabulary.saved.SavedWordDtos.Topic;
import com.deutschflow.vocabulary.saved.SavedWordLookupService.Lookup;
import com.deutschflow.vocabulary.service.TagQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Sổ từ riêng của học viên — lưu từ khi luyện đề đọc (owner chốt 13/11/2026).
 *
 * <p>Lưu = tra nghĩa ({@link SavedWordLookupService}, có thể gọi AI — chạy NGOÀI transaction) rồi trong một
 * transaction: thêm hàng {@code user_saved_words} + thẻ ôn {@code vocab_review_schedule} (câu gốc làm ví dụ).
 * Mỗi người một hàng / dạng gốc: lưu lại cùng từ ⇒ trả hàng cũ với {@code alreadySaved = true}.
 * Gỡ khỏi sổ ⇒ gỡ luôn thẻ ôn.
 */
@Service
@RequiredArgsConstructor
public class SavedWordService {

    static final String SRS_PREFIX = "sw:";
    private static final int LIST_LIMIT = 2000;
    private static final Pattern TEIL_KEY = Pattern.compile("^[A-Z_]{2,30}-\\d{1,2}$");
    private static final Pattern BLOCK = Pattern.compile("^[A-Za-z0-9:_\\-.]{1,80}$");

    private final JdbcTemplate jdbc;
    private final SavedWordLookupService lookupService;
    private final SrsService srsService;
    private final TagQueryService tagQueryService;
    private final PlatformTransactionManager txManager;

    public SavedWord save(long userId, SaveRequest req) {
        return save(userId, req, "vi");
    }

    public SavedWord save(long userId, SaveRequest req, String locale) {
        if (req == null) throw new BadRequestException("Thiếu chữ cần lưu.");
        String surface = SavedWordText.normalizeSurface(req.text());
        if (surface == null) {
            throw new BadRequestException("Chỉ lưu được từ 1 đến " + SavedWordText.MAX_WORDS + " từ tiếng Đức liền nhau.");
        }
        String sentence = SavedWordText.normalizeSentence(req.sentence());
        Long examId = req.examId();
        if (examId != null) {
            Long found = jdbc.queryForObject("SELECT COUNT(*) FROM mock_exams WHERE id = ?", Long.class, examId);
            if (found == null || found == 0) throw new NotFoundException("Không tìm thấy đề.");
        }
        String teilKey = req.teilKey() != null && TEIL_KEY.matcher(req.teilKey()).matches() ? req.teilKey() : null;
        String block = req.block() != null && BLOCK.matcher(req.block()).matches() ? req.block() : null;
        Integer start = req.start();
        Integer end = req.end();
        if (block == null || start == null || end == null || start < 0 || end <= start) {
            block = null;
            start = null;
            end = null;
        }

        // Đã có trong sổ theo đúng chữ bôi (khớp kho) ⇒ không cần tra lại.
        SavedWord existingBySurface = findByLemmaKey(userId, SavedWordLookupService.key(surface), locale);
        if (existingBySurface != null) return withAlready(existingBySurface);

        Lookup lk = lookupService.lookup(userId, surface, sentence);
        String lemmaKey = SavedWordLookupService.key(lk.lemma());
        String vocabId = srsVocabId(lk.wordId(), lemmaKey);
        String display = lk.article() != null ? lk.article() + " " + lk.lemma() : lk.lemma();

        final Integer s = start;
        final Integer e = end;
        final String b = block;
        Long newId = new TransactionTemplate(txManager).execute(tx -> {
            Long cards = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND vocab_id = ?",
                    Long.class, userId, vocabId);
            boolean srsCreated = cards == null || cards == 0;
            List<Long> ids = jdbc.queryForList("""
                    INSERT INTO user_saved_words (user_id, lemma, lemma_key, surface, article, pos, meaning_vi,
                        meaning_source, word_id, topic, topic_source, source_sentence, exam_id, teil_key,
                        passage_block, char_start, char_end, srs_vocab_id, srs_created, ai_lookup)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (user_id, lemma_key) DO NOTHING
                    RETURNING id
                    """, Long.class,
                    userId, cut(lk.lemma(), 120), lemmaKey, cut(surface, 120), lk.article(), lk.pos(), lk.meaning(),
                    lk.meaningSource(), lk.wordId(), lk.topic(), lk.topicSource(), sentence, examId, teilKey,
                    b, s, e, vocabId, srsCreated, lk.aiCalled());
            if (ids.isEmpty()) return null; // đã có (cùng dạng gốc, khác chữ bôi — hoặc hai lần bấm chạy đua)
            if (!srsCreated) return ids.get(0); // thẻ ôn đã có sẵn — giữ nguyên lịch của nó
            srsService.scheduleVocab(userId, new ScheduleVocabRequest(
                    null, vocabId, display, lk.meaning(), sentence, display));
            return ids.get(0);
        });

        if (newId == null) {
            SavedWord existing = findByLemmaKey(userId, lemmaKey, locale);
            if (existing == null) throw new NotFoundException("Không tìm thấy từ trong sổ.");
            return withAlready(existing);
        }
        SavedWord saved = findById(userId, newId, locale);
        if (saved == null) throw new NotFoundException("Không tìm thấy từ trong sổ.");
        return saved;
    }

    public SavedWordList list(long userId, String locale) {
        List<SavedWord> items = jdbc.query(SELECT + " WHERE s.user_id = ? ORDER BY s.created_at DESC, s.id DESC LIMIT ?",
                mapper(locale), userId, LIST_LIMIT);
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM user_saved_words WHERE user_id = ?", Long.class, userId);
        return new SavedWordList(items, total == null ? items.size() : total.intValue());
    }

    /** Bộ chủ đề sẵn của kho, xếp theo nhãn — cho ô "Chuyển chủ đề". */
    public List<Topic> topics(String locale) {
        return tagQueryService.listTags(loc(locale), true).stream()
                .map(t -> new Topic(t.name(), t.localizedLabel()))
                .toList();
    }

    /** Đổi chủ đề (học viên tự xếp). {@code null} / rỗng ⇒ "Chưa phân loại"; tên ngoài bộ sẵn ⇒ 400. */
    public SavedWord setTopic(long userId, long id, String topic, String locale) {
        String t = topic == null || topic.isBlank() ? null : topic.trim();
        if (t != null && !tagQueryService.listTopicTaxonomyTagNames().contains(t)) {
            throw new BadRequestException("Chủ đề không có trong danh sách.");
        }
        int n = jdbc.update("""
                UPDATE user_saved_words SET topic = ?, topic_source = ?, updated_at = NOW()
                WHERE id = ? AND user_id = ?
                """, t, t == null ? "NONE" : "USER", id, userId);
        if (n == 0) throw new NotFoundException("Không tìm thấy từ trong sổ.");
        return findById(userId, id, locale);
    }

    /** Sửa nghĩa; thẻ ôn do sổ tạo đổi theo (thẻ có sẵn từ trước giữ nguyên). */
    public SavedWord setMeaning(long userId, long id, String meaning, String locale) {
        String m = meaning == null ? "" : meaning.replaceAll("[\\s\\u00A0]+", " ").trim();
        if (m.isEmpty() || m.length() > 200) throw new BadRequestException("Nghĩa cần 1 đến 200 ký tự.");
        new TransactionTemplate(txManager).executeWithoutResult(tx -> {
            List<Map<String, Object>> rows = jdbc.queryForList("""
                    UPDATE user_saved_words SET meaning_vi = ?, updated_at = NOW()
                    WHERE id = ? AND user_id = ?
                    RETURNING srs_vocab_id, srs_created
                    """, m, id, userId);
            if (rows.isEmpty()) throw new NotFoundException("Không tìm thấy từ trong sổ.");
            if (Boolean.TRUE.equals(rows.get(0).get("srs_created"))) {
                jdbc.update("UPDATE vocab_review_schedule SET meaning = ? WHERE user_id = ? AND vocab_id = ?",
                        m, userId, rows.get(0).get("srs_vocab_id"));
            }
        });
        return findById(userId, id, locale);
    }

    public void remove(long userId, long id) {
        new TransactionTemplate(txManager).executeWithoutResult(tx -> {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "DELETE FROM user_saved_words WHERE id = ? AND user_id = ? RETURNING srs_vocab_id, srs_created",
                    id, userId);
            if (rows.isEmpty()) throw new NotFoundException("Không tìm thấy từ trong sổ.");
            if (Boolean.TRUE.equals(rows.get(0).get("srs_created"))) {
                jdbc.update("DELETE FROM vocab_review_schedule WHERE user_id = ? AND vocab_id = ?",
                        userId, rows.get(0).get("srs_vocab_id"));
            }
        });
    }

    // ── đọc ──────────────────────────────────────────────────────────────────

    private static final String SELECT = """
            SELECT s.id, s.lemma, s.article, s.pos, s.meaning_vi, s.topic, s.surface, s.source_sentence,
                   s.exam_id, e.title AS exam_title, s.teil_key, s.passage_block, s.char_start, s.char_end,
                   s.created_at
            FROM user_saved_words s
            LEFT JOIN mock_exams e ON e.id = s.exam_id
            """;

    private SavedWord findById(long userId, long id, String locale) {
        List<SavedWord> rows = jdbc.query(SELECT + " WHERE s.user_id = ? AND s.id = ?", mapper(locale), userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private SavedWord findByLemmaKey(long userId, String lemmaKey, String locale) {
        List<SavedWord> rows = jdbc.query(SELECT + " WHERE s.user_id = ? AND s.lemma_key = ?", mapper(locale),
                userId, lemmaKey);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Ngôn ngữ nhãn chủ đề: vi / en có bản dịch; còn lại (de) dùng tên gốc tiếng Đức. */
    static String loc(String locale) {
        if (locale == null) return "vi";
        String l = locale.trim().toLowerCase(java.util.Locale.ROOT);
        return l.equals("en") || l.equals("de") ? l : "vi";
    }

    private static Integer intOrNull(java.sql.ResultSet rs, String col) throws java.sql.SQLException {
        int v = rs.getInt(col);
        return rs.wasNull() ? null : v;
    }

    private RowMapper<SavedWord> mapper(String locale) {
        Map<String, String> labels = topicLabels(locale);
        return (rs, i) -> {
            String topic = rs.getString("topic");
            long examId = rs.getLong("exam_id");
            boolean noExam = rs.wasNull();
            return new SavedWord(
                    rs.getLong("id"),
                    rs.getString("lemma"),
                    rs.getString("article"),
                    rs.getString("pos"),
                    rs.getString("meaning_vi"),
                    topic,
                    topic == null ? null : labels.getOrDefault(topic, topic),
                    rs.getString("surface"),
                    rs.getString("source_sentence"),
                    noExam ? null : examId,
                    rs.getString("exam_title"),
                    rs.getString("teil_key"),
                    rs.getString("passage_block"),
                    intOrNull(rs, "char_start"),
                    intOrNull(rs, "char_end"),
                    rs.getObject("created_at", OffsetDateTime.class),
                    false);
        };
    }

    private Map<String, String> topicLabels(String locale) {
        List<TagItem> tags = tagQueryService.listTags(loc(locale), true);
        return tags.stream().collect(Collectors.toMap(TagItem::name, TagItem::localizedLabel, (a, b) -> a));
    }

    private static SavedWord withAlready(SavedWord w) {
        return new SavedWord(w.id(), w.lemma(), w.article(), w.pos(), w.meaning(), w.topic(), w.topicLabel(),
                w.surface(), w.sentence(), w.examId(), w.examTitle(), w.teilKey(), w.block(), w.start(), w.end(),
                w.createdAt(), true);
    }

    /**
     * Mã thẻ ôn. Từ trong kho dùng chung {@code word_<id>} với các bài luyện từ vựng (một từ một thẻ, trang Từ
     * vựng hiện đúng trạng thái học). Từ ngoài kho: {@code sw:<dạng gốc>}; cột tối đa 80 ký tự — dài thì băm.
     */
    static String srsVocabId(Long wordId, String lemmaKey) {
        if (wordId != null) return "word_" + wordId;
        String id = SRS_PREFIX + lemmaKey;
        if (id.length() <= 80) return id;
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(lemmaKey.getBytes(StandardCharsets.UTF_8));
            return SRS_PREFIX + "#" + HexFormat.of().formatHex(h).substring(0, 40);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
