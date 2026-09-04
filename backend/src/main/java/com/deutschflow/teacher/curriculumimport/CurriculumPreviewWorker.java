package com.deutschflow.teacher.curriculumimport;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * The asynchronous seam for preview jobs: its only job is to move a task onto the executor.
 *
 * <p>It exists as its own bean because Spring's {@code @Async} works through a proxy, and a method a
 * bean calls on itself never crosses that proxy — it would run inline on the request thread and
 * block the teacher for the whole OCR pass.
 *
 * <p>It deliberately holds NO dependencies. Injecting {@link CurriculumImportService} back here
 * would form a constructor cycle, which Spring Boot rejects at startup by default; and {@code @Lazy}
 * on a Lombok-generated constructor parameter would not break it either, because Lombok only copies
 * annotations listed in {@code lombok.copyableAnnotations} and this project ships no
 * {@code lombok.config}. Taking the work as a task keeps the dependency one-way.
 */
@Component
public class CurriculumPreviewWorker {

    @Async("taskExecutor")
    public void submit(Runnable task) {
        task.run();
    }
}
