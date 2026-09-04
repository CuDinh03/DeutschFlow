package com.deutschflow.vocabulary.galerie;

import com.deutschflow.speaking.ai.ChatMessage;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * NGÔI NHÀ DUY NHẤT của mọi prompt Galerie (spec mục 27 — prompt versioning tập trung).
 * Đổi art direction = đổi ở đây + nâng {@link #VERSION}, không copy prompt sang service khác.
 *
 * <p>Hai bản image prompt (spec mục 12 plan): {@link #imagePromptCondensed} cho model có
 * text-encoder ngắn (FLUX — T5 cắt ~512 token, prompt dài bị vứt lặng lẽ);
 * {@link #imagePromptFull} cho model context dài (gpt-image-1...). Cả hai cùng nhận
 * visualConcept đã sinh trước — KHÔNG truyền từ tiếng Đức trần cho image model (spec mục 15).
 */
@Component
public class GaleriePromptFactory {

    /** Ghi vào {@code words.image_style} + {@code media_assets.style} cho mọi artwork của đợt này. */
    public static final String VERSION = "galerie-v1";

    // ── Bước 1: semantic family + visualConcept (LLM text, tier BATCH) ──────────────────────────

    private static final String CONCEPT_SYSTEM_PROMPT = """
            You prepare artwork briefs for "DeutschFlow Galerie" — a curated collection of \
            editorial illustrations, one per German vocabulary word, used by Vietnamese learners.

            Given ONE German word, do two things:

            1. Classify it into exactly one visual family:
               - OBJEKT: objects, food, vehicles, household items, tools
               - LEBEN: people, animals, plants, professions, characters
               - HANDLUNG: verbs, activities, interactions, movement
               - ORT: places, buildings, locations
               - GEFUEHL_IDEE: emotions, adjectives, mental states, abstract concepts

            2. Write a "visual concept": 1–2 English sentences describing ONE clear visual idea a \
            learner could recognize the meaning from, without seeing the word.
               - Style: modern European editorial illustration — simplified, slightly organic, \
            handcrafted shapes with controlled asymmetry; generous cream negative space. Never \
            describe an icon, emoji, pictogram or photo.
               - Colors: only brick red, warm gold, deep gold, ink black on a warm cream ground; \
            name 2–4 of them for the main shapes.
               - Default to ONE primary subject; allow TWO interacting subjects only when the \
            meaning requires interaction (e.g. "geben", "helfen").
               - For actions: a simplified figure in a readable pose, minimal supporting props.
               - For places: one recognizable architectural idea, no full scenery.
               - For emotions/abstract words: one simple, culturally universal metaphor \
            (Zeit → clock, Liebe → heart shape, Idee → light bulb, Freiheit → released bird). \
            Clarity beats artistic ambiguity.
               - Never include letters, text, labels or UI elements in the artwork.

            Answer ONLY with a JSON object: {"family": "...", "concept": "..."}

            Examples:
            der Apfel (quả táo) → {"family":"OBJEKT","concept":"One expressive brick-red apple \
            with a slightly asymmetrical organic silhouette, a small curved ink stem and one warm \
            gold leaf, centered in generous cream negative space."}
            die Katze (con mèo) → {"family":"LEBEN","concept":"One characterful seated ink-black \
            cat with an expressive curved tail, slightly asymmetric pointed ears, small gold eyes \
            and a subtle brick-red accent."}
            lesen (đọc) → {"family":"HANDLUNG","concept":"One simplified figure sitting \
            comfortably while holding an open book, the gold book as the clear visual focus, \
            minimal supporting shapes in ink and brick red."}
            der Bahnhof (nhà ga) → {"family":"ORT","concept":"A simplified side-view train in \
            brick red beneath one minimal gold station canopy, a single recognizable architectural \
            gesture with no further scenery."}
            die Zeit (thời gian) → {"family":"GEFUEHL_IDEE","concept":"One warm gold clock face \
            with expressive ink hands, slightly irregular circle, floating in generous cream \
            negative space."}
            """;

    public List<ChatMessage> conceptMessages(String baseForm, String gender, String dtype,
                                             String meaning, String cefrLevel) {
        String word = (gender == null || gender.isBlank()) ? baseForm : gender + " " + baseForm;
        String user = "German word: \"" + word + "\""
                + "\nWord type: " + nullSafe(dtype)
                + "\nCEFR level: " + nullSafe(cefrLevel)
                + "\nMeaning (Vietnamese): " + nullSafe(meaning)
                + "\n\nReturn the JSON object.";
        return List.of(
                new ChatMessage("system", CONCEPT_SYSTEM_PROMPT),
                new ChatMessage("user", user));
    }

    // ── Bước 2: image generation prompt ────────────────────────────────────────────────────────

    /**
     * Bản rút gọn (~230 từ) cho FLUX-class models: giữ palette hex, form language, avoid-list
     * cốt lõi + visualConcept. Mọi chữ vượt ~512 token T5 sẽ bị model bỏ — đừng thêm vào đây
     * nếu chưa bỏ được chữ khác ra.
     */
    public String imagePromptCondensed(String visualConcept) {
        return """
                Editorial vocabulary illustration for a curated European gallery collection.
                %s
                Style: modern European editorial illustration — simplified, slightly organic \
                handcrafted shapes, controlled asymmetry, expressive proportions, clear memorable \
                silhouette. Flat illustration with subtle depth from overlap and scale only.
                Colors, strictly: warm cream background #F6F3EC; shapes only in gold #FFCD00, \
                deep gold #C79A00, brick red #DA291C, ink black #161513. Use 2–4 of these colors.
                Composition: square, optically centered single visual idea occupying about two \
                thirds of the canvas, generous cream negative space, no decorative filler.
                Not an icon, not a pictogram, not emoji, not clip-art, not Bauhaus geometry, \
                not 3D, no gradients, no shadows, no textures, no photorealism, no text, \
                no letters, no borders, no watermark.""".formatted(oneLine(visualConcept));
    }

    /**
     * Bản đầy đủ theo master prompt của owner (spec mục 17) cho model context dài.
     * {@code article}/{@code germanWord}/{@code meaning} chỉ là ngữ cảnh — spec cấm chữ
     * xuất hiện trong ảnh.
     */
    public String imagePromptFull(String germanWord, String article, String meaning,
                                  GalerieFamily family, String visualConcept) {
        return """
                Create an original vocabulary artwork for DeutschFlow Galerie, a curated visual \
                collection for learning German.

                GERMAN WORD: "%s"
                ARTICLE: "%s"
                MEANING: "%s"
                SEMANTIC FAMILY: "%s"
                VISUAL CONCEPT: "%s"

                Create one clear and memorable visual idea representing the meaning of "%s". The \
                learner should be able to understand or strongly infer the vocabulary meaning from \
                the artwork without seeing the German word.

                ART DIRECTION: Modern European Editorial Vocabulary Illustration — a combination \
                of contemporary European editorial illustration, curated picture dictionary, \
                minimal visual storytelling, modern gallery print and premium educational artwork. \
                It must feel curated, artistic, warm, intelligent, editorial, minimal, memorable, \
                slightly playful, sophisticated, handcrafted, approachable. It must NOT look like \
                a generic app icon or AI-generated stock vector.

                FORM LANGUAGE: Clean, simplified, slightly organic forms. Allow controlled \
                asymmetry, expressive proportions, slightly irregular curves and handcrafted \
                visual character. Do not use strict mathematical geometry or perfect symmetry. \
                Keep silhouettes clear and memorable. Controlled imperfection over mechanical \
                perfection.

                COLOR: Only the DeutschFlow Galerie core palette — Gold #FFCD00, Deep Gold \
                #C79A00, Brick Red #DA291C, Ink #161513, Warm Cream #F6F3EC. Prefer 2–4 colors \
                per artwork. Warm Cream #F6F3EC is the visual ground. Color may be used \
                compositionally rather than realistically, but the concept must remain \
                recognizable.

                COMPOSITION: Square 1:1. Optical centering, balanced perceived visual mass, \
                generous negative space. The main visual idea occupies approximately 60–68%% of \
                the canvas with comfortable optical safe space. Intentional asymmetry is allowed. \
                Do not fill empty areas with decoration.

                VISUAL STORYTELLING: Default to one primary subject; allow up to two interacting \
                subjects only when interaction is necessary for the meaning. Actions use \
                simplified pose or interaction; places use one recognizable architectural idea; \
                emotions and abstract concepts use a simple, culturally universal metaphor. \
                Always communicate ONE VISUAL IDEA.

                DEPTH: Flat illustration foundation; subtle depth only through overlap, layering, \
                scale and partial cropping. No realistic 3D depth.

                CONSISTENCY: This artwork belongs to a 5,000+ piece collection displayed together \
                in one contemporary European gallery — same palette, warmth, level of abstraction, \
                editorial personality, simplification, negative space and shape language, without \
                being mechanically identical.

                STRICTLY AVOID: generic icons, pictogram aesthetic, emoji, clip-art, stock-vector \
                aesthetic, corporate illustration, strict Bauhaus geometry, mathematical-looking \
                shapes, photorealism, photography, 3D rendering, clay rendering, gradients, glossy \
                effects, glassmorphism, realistic or cinematic lighting, complex shadows, detailed \
                textures, noise, grain, watercolor, pencil sketch, anime, comic-book rendering, \
                detailed scenery, complex environments, decorative filler, random floating \
                objects, excessive details, German text, translation, article text, labels, \
                captions, typography, letters, UI elements, flashcard frames, badges, borders, \
                logos, watermarks.""".formatted(
                nullSafe(germanWord), nullSafe(article), nullSafe(meaning),
                family == null ? "" : family.name(), oneLine(visualConcept), nullSafe(meaning));
    }

    // ── Bước 2b: SVG generation prompt (P2 — plan mục 12, model claude-fable-5) ────────────────

    /**
     * System prompt sinh SVG — bản đã chạy pilot P1 v2 (30/30 PASS validator, owner duyệt),
     * gồm sẵn 3 quy tắc art-direction owner chốt 16/08: mặt người biểu cảm, tính từ có vật
     * đối chứng, động từ có micro-scene. Đổi luật vẽ = đổi Ở ĐÂY + nâng {@link #VERSION}.
     */
    private static final String SVG_SYSTEM_PROMPT = """
            You are the illustrator of DeutschFlow Galerie — a curated collection of editorial
            vocabulary artworks hung together like prints in a contemporary European gallery.
            Create ONE SVG artwork for the given German word so a learner can guess the meaning
            from the image alone.

            STYLE: Modern European Editorial Illustration — curated, warm, handcrafted, slightly
            playful. NOT an icon, pictogram, emoji, clip-art or rigid Bauhaus geometry. Build
            shapes from organic bezier paths with controlled asymmetry — silhouettes slightly
            irregular, curves imperfect on purpose, like hand-cut paper.

            HUMAN FIGURES: cream face clearly visible with expressive eyes and mouth matching the
            emotion; hair is only a cap, never swallowing the face; arms end in round visible
            hands so gestures read; add cheek dots for warmth.
            ADJECTIVES: always show an explicit subject plus a contrasting reference
            (big elephant vs tiny mouse; running hare vs watching snail; rain cloud over a sad
            person). Never draw an abstract adjective without a concrete carrier.
            VERBS: build a small detailed micro-scene with context props (a meal needs the table,
            plate and fork; sleeping needs the bed, moon and a sheep dream-bubble; reading needs
            the armchair, book and floor lamp) — still ONE visual idea, no full environment.

            COLOR (strict): background rect #F6F3EC first; shapes only #FFCD00, #C79A00, #DA291C,
            #161513; 2–4 shape colors per artwork; no gradients, no opacity, no filters, no shadows.
            COMPOSITION: viewBox "0 0 1024 1024"; main idea ~60–68% of canvas, optically centered,
            generous cream negative space, intentional asymmetry welcome.
            TECHNICAL: elements allowed: svg,rect,circle,ellipse,path,polygon,g (prefer path);
            FORBIDDEN: text,tspan,image,script,style,filter,gradient,mask,clipPath,animation,
            comments, id/class; no letters or digits drawn as shapes; under 60 elements.
            Output ONLY the SVG markup.""";

    /** 3 anchor few-shot (đại diện 3 loại: danh từ / động từ / tính từ) — bộ pilot P1 đã duyệt. */
    private static final List<String> ANCHOR_RESOURCES =
            List.of("01-der-apfel.svg", "16-lesen.svg", "24-gross.svg");

    /** Nạp một lần trong constructor — fail-fast lúc boot nếu resource anchor thiếu. */
    private final String svgAnchorsBlock = loadAnchorsBlock();

    public String svgSystemPrompt() {
        return SVG_SYSTEM_PROMPT;
    }

    /**
     * Khối anchors đứng SAU system prompt, TRƯỚC user message; cùng system prompt tạo thành
     * prefix ổn định cho prompt caching (mọi lượt sau đọc cache ~0.1× giá — plan mục 12).
     */
    public String svgAnchorsBlock() {
        return svgAnchorsBlock;
    }

    /** User message mỗi từ — format chốt ở handoff P1: WORD / MEANING / FAMILY / CONCEPT. */
    public String svgUserMessage(String germanWord, String gender, String meaning,
                                 GalerieFamily family, String visualConcept) {
        String word = (gender == null || gender.isBlank())
                ? nullSafe(germanWord) : gender.trim() + " " + nullSafe(germanWord);
        return "GERMAN WORD: \"" + word + "\""
                + "\nMEANING (vi): " + nullSafe(meaning)
                + "\nSEMANTIC FAMILY: " + (family == null ? "" : family.name())
                + "\nVISUAL CONCEPT: " + oneLine(visualConcept)
                + "\n\nCreate the SVG artwork now. Output ONLY the SVG markup.";
    }

    private static String loadAnchorsBlock() {
        StringBuilder block = new StringBuilder(
                "Reference artworks from the approved collection — match their style, "
                        + "not their subjects:\n");
        for (String name : ANCHOR_RESOURCES) {
            try (var in = GaleriePromptFactory.class.getResourceAsStream("/galerie/anchors/" + name)) {
                if (in == null) {
                    throw new IllegalStateException("Thiếu resource anchor Galerie: " + name);
                }
                block.append('\n').append(new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).trim()).append('\n');
            } catch (java.io.IOException e) {
                throw new IllegalStateException("Không đọc được anchor Galerie: " + name, e);
            }
        }
        return block.toString();
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value.trim();
    }

    private static String oneLine(String value) {
        return nullSafe(value).replaceAll("\\s+", " ");
    }
}
