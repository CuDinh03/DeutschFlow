package com.deutschflow.ai.queue;

import java.util.Map;

/**
 * Handler cắm được cho {@link AiJobWorker}: module mới đăng ký bean implement interface này thay vì sửa
 * switch trong worker. {@code jobType()} phải là hằng duy nhất.
 */
public interface AiJobHandler {

    String jobType();

    Map<String, Object> handle(AiJob job) throws Exception;
}
