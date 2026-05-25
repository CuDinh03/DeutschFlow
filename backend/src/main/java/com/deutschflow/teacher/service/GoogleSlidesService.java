package com.deutschflow.teacher.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.slides.v1.Slides;
import com.google.api.services.slides.v1.model.*;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * Tạo Google Slides presentation chuyên nghiệp qua Google Slides API,
 * sau đó export về PPTX bytes để trả về cho giáo viên download.
 *
 * Flow:
 *   1. Tạo Presentation mới trên Google Drive
 *   2. Xây dựng slides từ JSON cấu trúc (Gemini output) qua batchUpdate
 *   3. Export PPTX bytes qua Drive API
 *   4. Xóa file trên Drive (không lưu lại)
 */
@Service
@Slf4j
public class GoogleSlidesService {

    @Value("${app.ai.google.service-account-json:}")
    private String serviceAccountJsonPath;

    @Value("${app.ai.google.slides.drive-folder-id:}")
    private String driveFolderId;

    private Slides slidesService;
    private Drive driveService;
    private boolean available = false;

    private static final String APP_NAME = "DeutschFlow";
    private static final java.util.List<String> SCOPES = java.util.List.of(
            "https://www.googleapis.com/auth/presentations",
            "https://www.googleapis.com/auth/drive"
    );

    // ── Brand colors (RGB 0.0–1.0) ────────────────────────────────────────────
    private static final RgbColor INDIGO_900 = rgb(0.192f, 0.180f, 0.506f);
    private static final RgbColor INDIGO_700 = rgb(0.263f, 0.220f, 0.796f);
    private static final RgbColor INDIGO_600 = rgb(0.310f, 0.275f, 0.898f);
    private static final RgbColor INDIGO_500 = rgb(0.388f, 0.400f, 0.945f);
    private static final RgbColor INDIGO_100 = rgb(0.878f, 0.906f, 1.000f);
    private static final RgbColor INDIGO_50  = rgb(0.937f, 0.949f, 1.000f);
    private static final RgbColor VIOLET_600 = rgb(0.486f, 0.231f, 0.929f);
    private static final RgbColor VIOLET_400 = rgb(0.655f, 0.545f, 0.980f);
    private static final RgbColor WHITE      = rgb(1f, 1f, 1f);
    private static final RgbColor SLATE_900  = rgb(0.059f, 0.090f, 0.165f);
    private static final RgbColor SLATE_700  = rgb(0.200f, 0.255f, 0.345f);
    private static final RgbColor SLATE_500  = rgb(0.392f, 0.455f, 0.545f);
    private static final RgbColor SLATE_50   = rgb(0.973f, 0.980f, 0.988f);
    private static final RgbColor GREEN_600  = rgb(0.086f, 0.639f, 0.290f);
    private static final RgbColor GREEN_50   = rgb(0.941f, 0.992f, 0.957f);
    private static final RgbColor AMBER_600  = rgb(0.851f, 0.467f, 0.024f);
    private static final RgbColor AMBER_50   = rgb(1.000f, 0.984f, 0.922f);

    // Alignment constants
    private static final String ALIGN_LEFT   = "START";
    private static final String ALIGN_CENTER = "CENTER";
    private static final String ALIGN_RIGHT  = "END";


    @PostConstruct
    void init() {
        if (serviceAccountJsonPath == null || serviceAccountJsonPath.isBlank()) {
            log.warn("[GoogleSlides] GOOGLE_SERVICE_ACCOUNT_JSON not configured — falling back to POI");
            return;
        }
        try {
            InputStream credStream;
            if (serviceAccountJsonPath.trim().startsWith("{")) {
                credStream = new ByteArrayInputStream(serviceAccountJsonPath.getBytes());
            } else {
                credStream = Files.newInputStream(Paths.get(serviceAccountJsonPath));
            }
            GoogleCredentials credentials = ServiceAccountCredentials
                    .fromStream(credStream).createScoped(SCOPES);
            var transport = GoogleNetHttpTransport.newTrustedTransport();
            var jsonFactory = GsonFactory.getDefaultInstance();
            var adapter = new HttpCredentialsAdapter(credentials);
            slidesService = new Slides.Builder(transport, jsonFactory, adapter)
                    .setApplicationName(APP_NAME).build();
            driveService = new Drive.Builder(transport, jsonFactory, adapter)
                    .setApplicationName(APP_NAME).build();
            available = true;
            log.info("[GoogleSlides] Service initialized successfully");
        } catch (Exception e) {
            log.error("[GoogleSlides] Failed to initialize: {} — falling back to POI", e.getMessage());
        }
    }

    public boolean isAvailable() { return available; }

    /**
     * Tạo presentation từ JSON, export PPTX bytes, xóa file trên Drive.
     */
    public byte[] createPptx(JsonNode root) throws Exception {
        String title = root.path("title").asText("Bài Giảng");

        // 1. Tạo presentation trống
        Presentation presentation = new Presentation().setTitle(title);
        presentation = slidesService.presentations().create(presentation).execute();
        String presId = presentation.getPresentationId();
        log.info("[GoogleSlides] Created presentation: {}", presId);

        try {
            // 2. Di chuyển vào Drive folder
            if (driveFolderId != null && !driveFolderId.isBlank()) {
                var file = driveService.files().get(presId).setFields("parents").execute();
                String prevParents = String.join(",", file.getParents());
                driveService.files().update(presId, null)
                        .setAddParents(driveFolderId)
                        .setRemoveParents(prevParents)
                        .setFields("id,parents").execute();
            }

            // 3. Xóa slide mặc định + build tất cả slides
            List<Request> requests = new ArrayList<>();
            String defaultSlideId = presentation.getSlides().get(0).getObjectId();
            requests.add(new Request().setDeleteObject(
                    new DeleteObjectRequest().setObjectId(defaultSlideId)));

            JsonNode slides = root.path("slides");
            for (int i = 0; i < slides.size(); i++) {
                JsonNode slideNode = slides.get(i);
                String type = slideNode.path("type").asText("CONTENT").toUpperCase();
                String slideId = "slide_" + i + "_" + System.nanoTime();
                // CreateSlideRequest — đúng tên class
                requests.add(new Request().setCreateSlide(new CreateSlideRequest()
                        .setObjectId(slideId)
                        .setInsertionIndex(i)));
                requests.addAll(buildSlideRequests(slideId, type, slideNode));
            }

            // 4. Execute batch
            slidesService.presentations().batchUpdate(presId,
                    new BatchUpdatePresentationRequest().setRequests(requests)).execute();

            // 5. Export PPTX
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            driveService.files().export(presId,
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation")
                    .executeMediaAndDownloadTo(out);
            log.info("[GoogleSlides] Exported {} bytes for '{}'", out.size(), title);
            return out.toByteArray();

        } finally {
            try {
                driveService.files().delete(presId).execute();
                log.info("[GoogleSlides] Deleted presentation {} from Drive", presId);
            } catch (Exception e) {
                log.warn("[GoogleSlides] Could not delete {}: {}", presId, e.getMessage());
            }
        }
    }


    // ── Slide dispatch ────────────────────────────────────────────────────────

    private List<Request> buildSlideRequests(String sid, String type, JsonNode n) {
        return switch (type) {
            case "TITLE"             -> buildTitleSlide(sid, n);
            case "AGENDA"            -> buildAgendaSlide(sid, n);
            case "SECTION"           -> buildSectionSlide(sid, n);
            case "EXAMPLE",
                 "TWO_COLUMN"        -> buildTwoColumnSlide(sid, n, type);
            case "SUMMARY"           -> buildSummarySlide(sid, n);
            default                  -> buildContentSlide(sid, n);
        };
    }

    // ── TITLE slide ───────────────────────────────────────────────────────────
    private List<Request> buildTitleSlide(String sid, JsonNode n) {
        List<Request> r = new ArrayList<>();
        r.add(setSlideBackground(sid, INDIGO_700));
        r.addAll(addShape(sid, sid+"_topbar",   0, 0, 9144000, 114300, VIOLET_400));
        r.addAll(addShape(sid, sid+"_botbar",   0, 5029200, 9144000, 114300, INDIGO_900));
        r.addAll(addShape(sid, sid+"_rbar",     9029700, 0, 114300, 5143500, VIOLET_600));

        r.addAll(addTextBox(sid, sid+"_title",  685800, 1200000, 7772400, 1200000,
                n.path("title").asText("Bài Giảng"), 40, true, WHITE, ALIGN_CENTER));

        String sub = n.path("subtitle").asText("");
        if (!sub.isBlank()) {
            r.addAll(addTextBox(sid, sid+"_sub", 685800, 2514000, 7772400, 457200,
                    sub, 18, false, VIOLET_400, ALIGN_CENTER));
        }

        JsonNode objs = n.path("objectives");
        if (objs.isArray() && objs.size() > 0) {
            int cnt = Math.min(objs.size(), 4);
            long chipW = 2000000L;
            long gap = 100000L;
            long totalW = cnt * chipW + (cnt - 1) * gap;
            long startX = (9144000L - totalW) / 2;
            for (int i = 0; i < cnt; i++) {
                long cx = startX + i * (chipW + gap);
                r.addAll(addShape(sid, sid+"_chip"+i, cx, 3200000, chipW, 400000,
                        new RgbColor().setRed(0.216f).setGreen(0.188f).setBlue(0.639f)));
                r.addAll(addTextBox(sid, sid+"_chipt"+i, cx+57150, 3228000, chipW-114300, 342900,
                        objs.get(i).asText(), 11, false, INDIGO_100, ALIGN_CENTER));
            }
        }
        r.addAll(addTextBox(sid, sid+"_brand", 0, 4800000, 9144000, 228600,
                "DeutschFlow · AI Lesson", 9, false, VIOLET_400, ALIGN_CENTER));
        return r;
    }

    // ── AGENDA slide ──────────────────────────────────────────────────────────
    private List<Request> buildAgendaSlide(String sid, JsonNode n) {
        List<Request> r = new ArrayList<>();
        r.add(setSlideBackground(sid, SLATE_50));
        r.addAll(addShape(sid, sid+"_hdr",  0, 0, 9144000, 1028700, INDIGO_600));
        r.addAll(addShape(sid, sid+"_lbar", 0, 0, 152400, 5143500, VIOLET_600));
        r.addAll(addTextBox(sid, sid+"_title", 228600, 228600, 8686800, 571500,
                n.path("title").asText("Nội dung bài học"), 24, true, WHITE, ALIGN_LEFT));

        JsonNode items = n.path("items");
        if (!items.isArray()) return r;
        int cnt = Math.min(items.size(), 7);
        long itemH = (5143500L - 1028700L - 114300L) / cnt;
        RgbColor[] numColors = {INDIGO_600, VIOLET_600};
        RgbColor[] rowBg = {WHITE, INDIGO_50};

        for (int i = 0; i < cnt; i++) {
            long y = 1028700L + i * itemH;
            r.addAll(addShape(sid, sid+"_row"+i, 152400, y, 8991600, itemH-28575, rowBg[i%2]));
            r.addAll(addShape(sid, sid+"_num"+i, 228600, y+114300, 457200, 457200, numColors[i%2]));
            r.addAll(addTextBox(sid, sid+"_numt"+i, 228600, y+114300, 457200, 457200,
                    String.valueOf(i+1), 12, true, WHITE, ALIGN_CENTER));
            r.addAll(addTextBox(sid, sid+"_item"+i, 800100, y+142875, 8200000, 400000,
                    items.get(i).asText(), 14, false, SLATE_700, ALIGN_LEFT));
        }
        r.addAll(addFooter(sid));
        return r;
    }

    // ── SECTION slide ─────────────────────────────────────────────────────────
    private List<Request> buildSectionSlide(String sid, JsonNode n) {
        List<Request> r = new ArrayList<>();
        r.add(setSlideBackground(sid, WHITE));
        r.addAll(addShape(sid, sid+"_left",  0, 0, 3657600, 5143500, INDIGO_600));
        r.addAll(addShape(sid, sid+"_ltop",  0, 0, 3657600, 114300, VIOLET_400));
        r.addAll(addTextBox(sid, sid+"_lbl", 228600, 1714500, 3200400, 342900,
                "PHẦN", 11, false, INDIGO_100, ALIGN_CENTER));
        r.addAll(addTextBox(sid, sid+"_title", 228600, 2057400, 3200400, 1371600,
                n.path("title").asText(), 28, true, WHITE, ALIGN_CENTER));
        r.addAll(addShape(sid, sid+"_rline", 3771900, 1714500, 57150, 1714500, INDIGO_500));
        String sub = n.path("subtitle").asText("");
        if (!sub.isBlank()) {
            r.addAll(addTextBox(sid, sid+"_sub", 3886200, 1828800, 5029200, 1371600,
                    sub, 18, false, SLATE_700, ALIGN_LEFT));
        }
        r.addAll(addFooter(sid));
        return r;
    }

    // ── CONTENT slide ─────────────────────────────────────────────────────────
    private List<Request> buildContentSlide(String sid, JsonNode n) {
        List<Request> r = new ArrayList<>();
        r.add(setSlideBackground(sid, SLATE_50));
        r.addAll(addShape(sid, sid+"_hdr",   0, 0, 9144000, 914400, INDIGO_600));
        r.addAll(addShape(sid, sid+"_lbar",  0, 0, 114300, 5143500, INDIGO_500));
        r.addAll(addShape(sid, sid+"_hline", 0, 885825, 9144000, 57150, VIOLET_400));
        r.addAll(addTextBox(sid, sid+"_title", 228600, 171450, 8686800, 571500,
                n.path("title").asText("Nội dung"), 22, true, WHITE, ALIGN_LEFT));

        JsonNode bullets = n.path("content");
        if (!bullets.isArray()) { r.addAll(addFooter(sid)); return r; }
        int cnt = Math.min(bullets.size(), 6);
        long availH = 5143500L - 914400L - 228600L;
        long bH = availH / cnt;

        for (int i = 0; i < cnt; i++) {
            long y = 914400L + i * bH + 28575L;
            r.addAll(addShape(sid, sid+"_card"+i, 228600, y, 8686800, bH-57150, WHITE));
            r.addAll(addShape(sid, sid+"_dot"+i,  228600, y, 57150, bH-57150, INDIGO_500));
            r.addAll(addTextBox(sid, sid+"_bt"+i, 342900, y+57150, 8457600, bH-171450,
                    bullets.get(i).asText(), 13, false, SLATE_700, ALIGN_LEFT));
        }
        r.addAll(addFooter(sid));
        return r;
    }

    // ── TWO_COLUMN / EXAMPLE slide ────────────────────────────────────────────
    private List<Request> buildTwoColumnSlide(String sid, JsonNode n, String type) {
        List<Request> r = new ArrayList<>();
        r.add(setSlideBackground(sid, SLATE_50));
        r.addAll(addShape(sid, sid+"_hdr",   0, 0, 9144000, 857250, INDIGO_600));
        r.addAll(addShape(sid, sid+"_hline", 0, 828675, 9144000, 57150, VIOLET_400));
        r.addAll(addTextBox(sid, sid+"_title", 228600, 142875, 8686800, 571500,
                n.path("title").asText("So sánh"), 22, true, WHITE, ALIGN_LEFT));

        boolean isExample = "EXAMPLE".equals(type);
        long colW = 4400000L;
        long lx = 171450L, rx = 4743000L;
        long colHdrH = 514350L, colY = 914400L;

        RgbColor rightHdr = isExample ? GREEN_600 : VIOLET_600;
        r.addAll(addShape(sid, sid+"_lhdr", lx, colY, colW, colHdrH, INDIGO_600));
        r.addAll(addTextBox(sid, sid+"_lhdrt", lx+114300, colY+85725, colW-228600, 342900,
                n.path("left_title").asText("Links"), 13, true, WHITE, ALIGN_LEFT));
        r.addAll(addShape(sid, sid+"_rhdr", rx, colY, colW, colHdrH, rightHdr));
        r.addAll(addTextBox(sid, sid+"_rhdrt", rx+114300, colY+85725, colW-228600, 342900,
                n.path("right_title").asText("Rechts"), 13, true, WHITE, ALIGN_LEFT));

        JsonNode li = n.path("left_items"), ri = n.path("right_items");
        int maxRows = Math.max(li.isArray()?li.size():0, ri.isArray()?ri.size():0);
        maxRows = Math.min(maxRows, 6);
        long availH = 5143500L - colY - colHdrH - 114300L;
        long rowH = availH / Math.max(maxRows, 1);
        RgbColor[] lBg = {WHITE, INDIGO_50};
        RgbColor[] rBg = {WHITE, isExample ? GREEN_50 : new RgbColor().setRed(0.961f).setGreen(0.953f).setBlue(1f)};

        for (int i = 0; i < maxRows; i++) {
            long ry = colY + colHdrH + i * rowH;
            r.addAll(addShape(sid, sid+"_lr"+i, lx, ry, colW, rowH-14288, lBg[i%2]));
            if (li.isArray() && i < li.size())
                r.addAll(addTextBox(sid, sid+"_lt"+i, lx+114300, ry+57150, colW-228600, rowH-171450,
                        li.get(i).asText(), 12, false, SLATE_700, ALIGN_LEFT));
            r.addAll(addShape(sid, sid+"_rr"+i, rx, ry, colW, rowH-14288, rBg[i%2]));
            if (ri.isArray() && i < ri.size())
                r.addAll(addTextBox(sid, sid+"_rt"+i, rx+114300, ry+57150, colW-228600, rowH-171450,
                        ri.get(i).asText(), 12, false, SLATE_700, ALIGN_LEFT));
        }
        r.addAll(addFooter(sid));
        return r;
    }

    // ── SUMMARY slide ─────────────────────────────────────────────────────────
    private List<Request> buildSummarySlide(String sid, JsonNode n) {
        List<Request> r = new ArrayList<>();
        r.add(setSlideBackground(sid, SLATE_50));
        r.addAll(addShape(sid, sid+"_hdr",   0, 0, 9144000, 857250, INDIGO_900));
        r.addAll(addShape(sid, sid+"_hline", 0, 828675, 9144000, 57150, VIOLET_400));
        r.addAll(addTextBox(sid, sid+"_title", 228600, 142875, 8686800, 571500,
                n.path("title").asText("Tổng kết"), 22, true, WHITE, ALIGN_LEFT));
        r.addAll(addTextBox(sid, sid+"_kplbl", 228600, 971550, 4000000, 285750,
                "✓  Điểm chính cần nhớ", 10, true, INDIGO_600, ALIGN_LEFT));

        JsonNode kp = n.path("key_points");
        long y = 1257300L;
        long kpH = 514350L;
        if (kp.isArray()) {
            int cnt = Math.min(kp.size(), 5);
            for (int i = 0; i < cnt; i++) {
                r.addAll(addShape(sid, sid+"_kpc"+i, 228600, y, 8686800, kpH-28575, WHITE));
                r.addAll(addShape(sid, sid+"_kpd"+i, 228600, y, 57150, kpH-28575, GREEN_600));
                r.addAll(addTextBox(sid, sid+"_kpt"+i, 342900, y+85725, 8457600, kpH-171450,
                        kp.get(i).asText(), 13, false, SLATE_700, ALIGN_LEFT));
                y += kpH;
            }
        }
        String hw = n.path("homework").asText("");
        if (!hw.isBlank()) {
            long hwY = Math.max(y + 114300L, 4400000L);
            r.addAll(addShape(sid, sid+"_hwbg",  228600, hwY, 8686800, 628650, AMBER_50));
            r.addAll(addShape(sid, sid+"_hwbar", 228600, hwY, 57150, 628650, AMBER_600));
            r.addAll(addTextBox(sid, sid+"_hwlbl", 342900, hwY+57150, 3000000, 228600,
                    "📝  Bài tập về nhà", 10, true, AMBER_600, ALIGN_LEFT));
            r.addAll(addTextBox(sid, sid+"_hwt", 342900, hwY+285750, 8457600, 342900,
                    hw, 12, false, SLATE_700, ALIGN_LEFT));
        }
        r.addAll(addFooter(sid));
        return r;
    }


    // ── Primitive helpers ─────────────────────────────────────────────────────

    /** Đặt màu nền cho slide. */
    private Request setSlideBackground(String slideId, RgbColor color) {
        return new Request().setUpdatePageProperties(new UpdatePagePropertiesRequest()
                .setObjectId(slideId)
                .setPageProperties(new PageProperties()
                        .setPageBackgroundFill(new PageBackgroundFill()
                                .setSolidFill(new SolidFill()
                                        .setColor(new OpaqueColor().setRgbColor(color)))))
                .setFields("pageBackgroundFill"));
    }

    /** Tạo hình chữ nhật màu đặc (không có border). */
    private List<Request> addShape(String slideId, String objId,
                                   long x, long y, long w, long h, RgbColor fillColor) {
        List<Request> r = new ArrayList<>();
        r.add(new Request().setCreateShape(new CreateShapeRequest()
                .setObjectId(objId)
                .setShapeType("RECTANGLE")
                .setElementProperties(elemProps(slideId, x, y, w, h))));

        r.add(new Request().setUpdateShapeProperties(new UpdateShapePropertiesRequest()
                .setObjectId(objId)
                .setShapeProperties(new ShapeProperties()
                        .setShapeBackgroundFill(new ShapeBackgroundFill()
                                .setSolidFill(new SolidFill()
                                        .setColor(new OpaqueColor().setRgbColor(fillColor))))
                        .setOutline(new Outline().setPropertyState("NOT_RENDERED")))
                .setFields("shapeBackgroundFill,outline")));
        return r;
    }

    /** Tạo text box với font, size, màu, alignment. */
    private List<Request> addTextBox(String slideId, String objId,
                                     long x, long y, long w, long h,
                                     String text, int fontSize, boolean bold,
                                     RgbColor color, String align) {
        List<Request> r = new ArrayList<>();
        r.add(new Request().setCreateShape(new CreateShapeRequest()
                .setObjectId(objId)
                .setShapeType("TEXT_BOX")
                .setElementProperties(elemProps(slideId, x, y, w, h))));

        r.add(new Request().setInsertText(new InsertTextRequest()
                .setObjectId(objId)
                .setInsertionIndex(0)
                .setText(text)));

        r.add(new Request().setUpdateTextStyle(new UpdateTextStyleRequest()
                .setObjectId(objId)
                .setStyle(new TextStyle()
                        .setFontSize(pt(fontSize))
                        .setBold(bold)
                        .setForegroundColor(new OptionalColor()
                                .setOpaqueColor(new OpaqueColor().setRgbColor(color)))
                        .setFontFamily("Google Sans"))
                .setFields("fontSize,bold,foregroundColor,fontFamily")));

        r.add(new Request().setUpdateParagraphStyle(new UpdateParagraphStyleRequest()
                .setObjectId(objId)
                .setStyle(new ParagraphStyle()
                        .setAlignment(align)
                        .setSpaceAbove(emu(0))
                        .setSpaceBelow(emu(0)))
                .setFields("alignment,spaceAbove,spaceBelow")));

        // Xóa border text box
        r.add(new Request().setUpdateShapeProperties(new UpdateShapePropertiesRequest()
                .setObjectId(objId)
                .setShapeProperties(new ShapeProperties()
                        .setOutline(new Outline().setPropertyState("NOT_RENDERED")))
                .setFields("outline")));
        return r;
    }

    /** Footer nhỏ ở cuối slide. */
    private List<Request> addFooter(String slideId) {
        List<Request> r = new ArrayList<>();
        r.addAll(addShape(slideId, slideId+"_fbar", 0, 5086350, 9144000, 57150, INDIGO_100));
        r.addAll(addTextBox(slideId, slideId+"_fbrand", 7315200, 4971900, 1714500, 228600,
                "DeutschFlow", 8, false, SLATE_500, ALIGN_RIGHT));
        return r;
    }

    // ── Dimension helpers ─────────────────────────────────────────────────────

    private PageElementProperties elemProps(String slideId, long x, long y, long w, long h) {
        return new PageElementProperties()
                .setPageObjectId(slideId)
                .setSize(new Size()
                        .setWidth(emu(w))
                        .setHeight(emu(h)))
                .setTransform(new AffineTransform()
                        .setScaleX(1.0).setScaleY(1.0)
                        .setTranslateX((double) x)
                        .setTranslateY((double) y)
                        .setUnit("EMU"));
    }

    private Dimension emu(long val) {
        return new Dimension().setMagnitude((double) val).setUnit("EMU");
    }

    private Dimension pt(int val) {
        return new Dimension().setMagnitude((double) val).setUnit("PT");
    }

    private static RgbColor rgb(float r, float g, float b) {
        return new RgbColor().setRed(r).setGreen(g).setBlue(b);
    }
}
