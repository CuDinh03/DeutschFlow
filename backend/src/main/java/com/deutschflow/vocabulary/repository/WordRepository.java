package com.deutschflow.vocabulary.repository;

import com.deutschflow.vocabulary.entity.Word;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WordRepository extends JpaRepository<Word, Long> {

    Optional<Word> findByWord(String word);

    List<Word> findByCefrLevel(String cefrLevel);

    List<Word> findByWordType(String wordType);

    List<Word> findAll();

    /** Lemma chuẩn của mục từ. Entity {@link com.deutschflow.vocabulary.entity.Word} ánh xạ cột {@code word}
     *  song song, nhưng trình import chỉ ghi {@code base_form} — đọc thẳng để khỏi phụ thuộc cột nào được ghi. */
    @Query(value = "SELECT base_form FROM words WHERE id = :id", nativeQuery = true)
    String findBaseFormById(@Param("id") Long id);

    /** Nghĩa dùng được của mục từ theo thứ tự vi → en → de, lấy từ bảng dịch chuẩn. */
    @Query(value = """
            SELECT meaning FROM word_translations
            WHERE word_id = :id AND meaning IS NOT NULL AND meaning <> ''
            ORDER BY CASE locale WHEN 'vi' THEN 1 WHEN 'en' THEN 2 WHEN 'de' THEN 3 ELSE 9 END
            LIMIT 1
            """, nativeQuery = true)
    String findMeaningById(@Param("id") Long id);
}
