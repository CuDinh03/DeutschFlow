package com.deutschflow.video.service;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.video.dto.VideoSceneDto;
import com.deutschflow.video.dto.VideoTimelineDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Phase B — renders a vocab {@link VideoTimelineDto} to a real .mp4 with ffmpeg and
 * stores it on S3. Each scene becomes a still image held for its narration's length
 * (or {@code durationMs} when silent); segments are concatenated into the final video.
 *
 * <p>Runs off the request thread on {@code taskExecutor}; progress is tracked through
 * the shared {@link AsyncJobService} (poll {@code GET /api/video-lessons/render/{jobId}}).
 *
 * <p><b>Ops:</b> requires the {@code ffmpeg} binary on the host (set {@code FFMPEG_PATH}
 * to override). When absent, {@link #isFfmpegAvailable()} is false and the controller
 * returns 503 before starting a job.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VideoRenderService {

    private static final String FFMPEG = System.getenv().getOrDefault("FFMPEG_PATH", "ffmpeg");
    private static final int WIDTH = 1280;
    private static final int HEIGHT = 720;
    private static final long FFMPEG_TIMEOUT_SEC = 180;
    private static final double MIN_SCENE_SEC = 2.5;

    private final VideoLessonService videoLessonService;
    private final S3StorageService s3StorageService;
    private final AsyncJobService asyncJobService;

    private volatile Boolean ffmpegAvailable;

    /** Lazily probe once for the ffmpeg binary. */
    public boolean isFfmpegAvailable() {
        Boolean cached = ffmpegAvailable;
        if (cached != null) {
            return cached;
        }
        boolean ok;
        try {
            Process p = new ProcessBuilder(FFMPEG, "-version")
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            ok = p.waitFor(10, TimeUnit.SECONDS) && p.exitValue() == 0;
            if (p.isAlive()) {
                p.destroyForcibly();
            }
        } catch (Exception e) {
            ok = false;
        }
        ffmpegAvailable = ok;
        return ok;
    }

    @Async("taskExecutor")
    public void renderVocabAsync(UUID jobId, String level, int limit) {
        asyncJobService.updateStatus(jobId, AsyncJob.Status.PROCESSING);
        Path workDir = null;
        try {
            VideoTimelineDto timeline = videoLessonService.buildVocabTimeline(level, limit);
            if (timeline.scenes().isEmpty()) {
                asyncJobService.failJob(jobId, "No vocab scenes with images to render for level " + level);
                return;
            }
            workDir = Files.createTempDirectory("vidrender-" + jobId);
            byte[] mp4 = renderTimeline(timeline, workDir);
            String key = "video-lessons/vocab-" + level + "-" + UUID.randomUUID() + ".mp4";
            String url = s3StorageService.uploadBytes(mp4, key, "video/mp4").getUrl();
            asyncJobService.completeJob(jobId, url);
            log.info("[VideoRender] job {} done: {} scene(s) -> {}", jobId, timeline.totalScenes(), url);
        } catch (Exception e) {
            log.error("[VideoRender] job {} failed", jobId, e);
            asyncJobService.failJob(jobId, e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        } finally {
            if (workDir != null) {
                deleteRecursivelyQuietly(workDir);
            }
        }
    }

    private byte[] renderTimeline(VideoTimelineDto timeline, Path dir) throws IOException, InterruptedException {
        List<Path> segments = new ArrayList<>();
        int i = 0;
        for (VideoSceneDto scene : timeline.scenes()) {
            Path image = download(scene.imageUrl(), dir.resolve("img-" + i + imageExt(scene.imageUrl())));
            Path audio = (scene.narrationAudioUrl() != null && !scene.narrationAudioUrl().isBlank())
                    ? download(scene.narrationAudioUrl(), dir.resolve("aud-" + i + ".mp3"))
                    : null;
            Path segment = dir.resolve("seg-" + i + ".mp4");
            double seconds = Math.max(MIN_SCENE_SEC, scene.durationMs() / 1000.0);
            runFfmpeg(buildSegmentCommand(image, audio, segment, seconds));
            segments.add(segment);
            i++;
        }

        Path listFile = dir.resolve("concat.txt");
        StringBuilder sb = new StringBuilder();
        for (Path seg : segments) {
            sb.append("file '").append(seg.toAbsolutePath()).append("'\n");
        }
        Files.writeString(listFile, sb.toString());

        Path out = dir.resolve("out.mp4");
        runFfmpeg(buildConcatCommand(listFile, out));
        return Files.readAllBytes(out);
    }

    /** One scene: a still image padded to 1280x720, held for the narration length (or durationSec when silent). */
    List<String> buildSegmentCommand(Path image, Path audio, Path out, double durationSec) {
        List<String> cmd = new ArrayList<>();
        cmd.add(FFMPEG);
        cmd.add("-y");
        cmd.add("-loop");
        cmd.add("1");
        cmd.add("-i");
        cmd.add(image.toAbsolutePath().toString());
        if (audio != null) {
            cmd.add("-i");
            cmd.add(audio.toAbsolutePath().toString());
            cmd.add("-shortest"); // end the segment when narration ends
        } else {
            cmd.add("-f");
            cmd.add("lavfi");
            cmd.add("-i");
            cmd.add("anullsrc=channel_layout=stereo:sample_rate=44100");
            cmd.add("-t");
            cmd.add(String.format(Locale.US, "%.2f", durationSec));
        }
        cmd.add("-vf");
        cmd.add("scale=" + WIDTH + ":" + HEIGHT + ":force_original_aspect_ratio=decrease,"
                + "pad=" + WIDTH + ":" + HEIGHT + ":(ow-iw)/2:(oh-ih)/2:black,setsar=1");
        cmd.add("-c:v");
        cmd.add("libx264");
        cmd.add("-tune");
        cmd.add("stillimage");
        cmd.add("-pix_fmt");
        cmd.add("yuv420p");
        cmd.add("-r");
        cmd.add("25");
        cmd.add("-c:a");
        cmd.add("aac");
        cmd.add("-b:a");
        cmd.add("128k");
        cmd.add("-ar");
        cmd.add("44100");
        cmd.add(out.toAbsolutePath().toString());
        return cmd;
    }

    /** Concatenate per-scene segments into the final video (re-encoded for robustness). */
    List<String> buildConcatCommand(Path listFile, Path out) {
        List<String> cmd = new ArrayList<>();
        cmd.add(FFMPEG);
        cmd.add("-y");
        cmd.add("-f");
        cmd.add("concat");
        cmd.add("-safe");
        cmd.add("0");
        cmd.add("-i");
        cmd.add(listFile.toAbsolutePath().toString());
        cmd.add("-c:v");
        cmd.add("libx264");
        cmd.add("-pix_fmt");
        cmd.add("yuv420p");
        cmd.add("-c:a");
        cmd.add("aac");
        cmd.add("-movflags");
        cmd.add("+faststart");
        cmd.add(out.toAbsolutePath().toString());
        return cmd;
    }

    private void runFfmpeg(List<String> command) throws IOException, InterruptedException {
        Path logFile = Files.createTempFile("ffmpeg-", ".log");
        try {
            Process process = new ProcessBuilder(command)
                    .redirectErrorStream(true)
                    .redirectOutput(logFile.toFile())
                    .start();
            boolean finished = process.waitFor(FFMPEG_TIMEOUT_SEC, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IOException("ffmpeg timed out after " + FFMPEG_TIMEOUT_SEC + "s");
            }
            if (process.exitValue() != 0) {
                String out = Files.exists(logFile) ? Files.readString(logFile) : "";
                String tail = out.length() > 600 ? out.substring(out.length() - 600) : out;
                throw new IOException("ffmpeg exited " + process.exitValue() + ": " + tail);
            }
        } finally {
            Files.deleteIfExists(logFile);
        }
    }

    private Path download(String url, Path dest) throws IOException {
        try (InputStream in = URI.create(url).toURL().openStream()) {
            Files.copy(in, dest);
        }
        return dest;
    }

    private String imageExt(String url) {
        String lower = url.toLowerCase(Locale.US);
        if (lower.contains(".png")) return ".png";
        if (lower.contains(".webp")) return ".webp";
        return ".jpg";
    }

    private void deleteRecursivelyQuietly(Path dir) {
        try (var paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // best-effort cleanup
                }
            });
        } catch (IOException ignored) {
            // best-effort cleanup
        }
    }
}
