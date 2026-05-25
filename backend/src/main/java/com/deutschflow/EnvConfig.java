package com.deutschflow;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public class EnvConfig implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String workingDir = System.getProperty("user.dir");

        // Tìm file .env: thử thư mục hiện tại, rồi thư mục cha
        String envDir = workingDir;
        if (!Files.exists(Path.of(workingDir, ".env"))) {
            Path parent = Path.of(workingDir).getParent();
            if (parent != null && Files.exists(parent.resolve(".env"))) {
                envDir = parent.toString();
            }
        }

        Dotenv dotenv = Dotenv.configure()
                .directory(envDir)
                .ignoreIfMissing()
                .load();

        Map<String, Object> map = new HashMap<>();
        dotenv.entries().forEach(entry -> map.put(entry.getKey(), entry.getValue()));

        if (!map.isEmpty()) {
            environment.getPropertySources().addFirst(new MapPropertySource("dotenvProperties", map));
        }
    }
}
