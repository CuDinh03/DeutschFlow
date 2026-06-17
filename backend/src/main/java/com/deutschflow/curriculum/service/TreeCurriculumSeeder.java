package com.deutschflow.curriculum.service;

import com.deutschflow.curriculum.entity.TreeNode;
import com.deutschflow.curriculum.entity.TreeTopic;
import com.deutschflow.curriculum.repository.TreeNodeRepository;
import com.deutschflow.curriculum.repository.TreeTopicRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Idempotent curriculum seeder for the learning tree. Populates {@code tree_topics} + {@code tree_nodes}
 * from a deterministic template (the proto {@code T}/{@code DEW} structure in
 * {@code ~/Downloads/deutschflow/tree/tree-data.js}): every level A1→C2 grows two topics per skill,
 * each with a few real German lesson titles, so the renderer has true structure to draw and the
 * content team can extend it by adding rows (no endpoint changes — §4).
 *
 * <p>A0 carries no topics (the "germinate" state). Fixed dimensions (levels/skills/groups) are seeded
 * by migration {@code V219}. Runs only when {@code tree_topics} is empty.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TreeCurriculumSeeder {

    /** Four skills, in branch order. Initials feed the stable node-id scheme. */
    private static final List<String[]> SKILLS = List.of(
            new String[]{"hoeren", "h"},
            new String[]{"sprechen", "s"},
            new String[]{"lesen", "l"},
            new String[]{"schreiben", "w"});

    private static final String TRACK_NURSING = "nursing";

    /** One topic taught at a level; its node titles are the German lessons of the shoot. */
    private record TopicTemplate(String topicId, String label, String group, String track, List<String> titles) {}

    /**
     * Two topics per level, reused across all four skills (matching the proto, where the same topic
     * recurs on several skills). Medical topics carry the {@code nursing} track so the flagship
     * Pflege learner sees them as self-chosen shoots.
     */
    private static final Map<String, List<TopicTemplate>> LEVEL_TOPICS = Map.of(
            "A1", List.of(
                    new TopicTemplate("greetings", "Chào hỏi & làm quen", "daily", null,
                            List.of("Begrüßung", "Sich vorstellen", "Small Talk")),
                    new TopicTemplate("family", "Gia đình", "daily", null,
                            List.of("Familie", "Verwandte", "Mein Zuhause"))),
            "A2", List.of(
                    new TopicTemplate("health_basic", "Sức khỏe cơ bản", "medical", TRACK_NURSING,
                            List.of("Beim Arzt", "Körperteile", "Symptome beschreiben")),
                    new TopicTemplate("work", "Công việc", "work", null,
                            List.of("Arbeitsplatz", "Berufe", "Arbeitszeit"))),
            "B1", List.of(
                    new TopicTemplate("nursing_care", "Chăm sóc điều dưỡng", "medical", TRACK_NURSING,
                            List.of("Pflegegespräch", "Übergabe", "Medikamente")),
                    new TopicTemplate("health_docs", "Hồ sơ & tài liệu y tế", "medical", TRACK_NURSING,
                            List.of("Patientenakte", "Pflegebericht", "Dokumentation"))),
            "B2", List.of(
                    new TopicTemplate("nursing_care", "Chăm sóc điều dưỡng nâng cao", "medical", TRACK_NURSING,
                            List.of("Notfall", "Visite", "Therapieplan")),
                    new TopicTemplate("culture", "Văn hóa Đức", "culture", null,
                            List.of("Feste", "Geschichte", "Bräuche"))),
            "C1", List.of(
                    new TopicTemplate("exam_prep", "Luyện đề Goethe C1", "exam", null,
                            List.of("Leseverstehen", "Hörverstehen", "Schriftlicher Ausdruck")),
                    new TopicTemplate("nursing_care", "Điều dưỡng chuyên sâu", "medical", TRACK_NURSING,
                            List.of("Diagnose", "Hygiene", "Beratung"))),
            "C2", List.of(
                    new TopicTemplate("exam_prep", "Luyện đề C2", "exam", null,
                            List.of("Mündliche Prüfung", "Textproduktion", "Argumentation")),
                    new TopicTemplate("society", "Xã hội & truyền thông", "culture", null,
                            List.of("Politik", "Medien", "Gesellschaft"))));

    private final TreeTopicRepository topicRepository;
    private final TreeNodeRepository nodeRepository;

    /** Seeds topics + nodes when none exist yet; a no-op afterwards. */
    @Transactional
    public int seedIfEmpty() {
        if (topicRepository.count() > 0) {
            return 0;
        }
        List<TreeNode> nodes = new ArrayList<>();
        int topicCount = 0;

        for (Map.Entry<String, List<TopicTemplate>> entry : LEVEL_TOPICS.entrySet()) {
            String levelCode = entry.getKey();
            for (String[] skill : SKILLS) {
                String skillCode = skill[0];
                String skillInitial = skill[1];
                int unlockOrder = 1;
                for (TopicTemplate tpl : entry.getValue()) {
                    TreeTopic topic = topicRepository.save(TreeTopic.builder()
                            .levelCode(levelCode)
                            .skillCode(skillCode)
                            .topicId(tpl.topicId())
                            .topicLabel(tpl.label())
                            .groupCode(tpl.group())
                            .unlockOrder(unlockOrder++)
                            .track(tpl.track())
                            .build());
                    topicCount++;

                    int idx = 1;
                    for (String title : tpl.titles()) {
                        String nodeId = levelCode.toLowerCase() + "_" + skillInitial + "_" + tpl.topicId() + "_" + idx;
                        nodes.add(TreeNode.builder()
                                .id(nodeId)
                                .topicPk(topic.getId())
                                .orderIndex(idx)
                                .titleDe(title)
                                .contentKey("tree/" + nodeId)
                                .build());
                        idx++;
                    }
                }
            }
        }
        nodeRepository.saveAll(nodes);
        log.info("Tree curriculum seeded: topics={}, nodes={}", topicCount, nodes.size());
        return topicCount;
    }
}
