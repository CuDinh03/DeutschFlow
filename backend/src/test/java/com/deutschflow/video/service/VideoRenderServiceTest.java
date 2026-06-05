package com.deutschflow.video.service;

import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.video.dto.VideoTimelineDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VideoRenderServiceTest {

    @Mock
    private VideoLessonService videoLessonService;
    @Mock
    private S3StorageService s3StorageService;
    @Mock
    private AsyncJobService asyncJobService;

    private VideoRenderService service;

    @BeforeEach
    void setUp() {
        service = new VideoRenderService(videoLessonService, s3StorageService, asyncJobService);
    }

    @Test
    @DisplayName("segment command with narration uses both inputs and -shortest")
    void segmentCommand_withAudio() {
        List<String> cmd = service.buildSegmentCommand(
                Path.of("/tmp/img.jpg"), Path.of("/tmp/a.mp3"), Path.of("/tmp/seg.mp4"), 4.0);

        assertThat(cmd).contains("-loop", "-shortest", "libx264", "yuv420p");
        assertThat(cmd).contains(Path.of("/tmp/a.mp3").toAbsolutePath().toString());
        assertThat(cmd).doesNotContain("anullsrc=channel_layout=stereo:sample_rate=44100");
    }

    @Test
    @DisplayName("segment command without narration uses silent audio + fixed duration")
    void segmentCommand_withoutAudio() {
        List<String> cmd = service.buildSegmentCommand(
                Path.of("/tmp/img.jpg"), null, Path.of("/tmp/seg.mp4"), 4.0);

        assertThat(cmd).contains("anullsrc=channel_layout=stereo:sample_rate=44100", "-t", "4.00");
        assertThat(cmd).doesNotContain("-shortest");
    }

    @Test
    @DisplayName("concat command uses the concat demuxer over the segment list")
    void concatCommand() {
        List<String> cmd = service.buildConcatCommand(Path.of("/tmp/list.txt"), Path.of("/tmp/out.mp4"));

        assertThat(cmd).contains("-f", "concat", "-safe", "0", "libx264");
        assertThat(cmd).contains(Path.of("/tmp/out.mp4").toAbsolutePath().toString());
    }

    @Test
    @DisplayName("empty timeline fails the job and never touches S3")
    void renderVocabAsync_emptyTimeline_failsJob() {
        UUID jobId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        when(videoLessonService.buildVocabTimeline("A1", 8))
                .thenReturn(new VideoTimelineDto("VOCAB", "A1", "LUKAS", 0, List.of()));

        service.renderVocabAsync(jobId, "A1", 8);

        verify(asyncJobService).updateStatus(eq(jobId), any());
        verify(asyncJobService).failJob(eq(jobId), contains("No vocab scenes"));
        verifyNoInteractions(s3StorageService);
    }
}
