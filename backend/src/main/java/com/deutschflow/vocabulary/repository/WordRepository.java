package com.deutschflow.vocabulary.repository;

import com.deutschflow.vocabulary.entity.Word;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WordRepository extends JpaRepository<Word, Long> {

    Optional<Word> findByWord(String word);

    List<Word> findByCefrLevel(String cefrLevel);

    List<Word> findByWordType(String wordType);

    List<Word> findAll();
}
