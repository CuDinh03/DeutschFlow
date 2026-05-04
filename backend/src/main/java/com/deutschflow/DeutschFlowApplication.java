package com.deutschflow;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class DeutschFlowApplication {
    public static void main(String[] args) {
        // // Load file .env
        // Dotenv dotenv = Dotenv.configure()
        //         .directory("./") 
        //         .ignoreIfMissing() 
        //         .load();

        // // Đẩy biến vào System Properties
        // dotenv.entries().forEach(entry -> {
        //     System.setProperty(entry.getKey(), entry.getValue());
        // });

        SpringApplication.run(DeutschFlowApplication.class, args);
    }
}