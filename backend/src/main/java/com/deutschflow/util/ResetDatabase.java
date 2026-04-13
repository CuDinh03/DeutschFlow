package com.deutschflow.util;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class ResetDatabase {
    public static void main(String[] args) {
        String host = System.getenv().getOrDefault("DB_HOST", "localhost");
        String port = System.getenv().getOrDefault("DB_PORT", "3306");
        String adminUser = System.getenv().getOrDefault("DB_ADMIN_USERNAME", "root");
        String adminPassword = System.getenv().getOrDefault("DB_ADMIN_PASSWORD", "");
        String dbName = System.getenv().getOrDefault("DB_NAME", "deutschflow");
        if (!dbName.matches("[a-zA-Z0-9_]+")) {
            throw new IllegalArgumentException("Invalid DB_NAME. Use only letters, numbers, underscore.");
        }

        String url = String.format(
                "jdbc:mysql://%s:%s/?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC",
                host, port
        );

        try (Connection conn = DriverManager.getConnection(url, adminUser, adminPassword);
             Statement stmt = conn.createStatement()) {

            System.out.printf("Dropping database %s...%n", dbName);
            stmt.execute("DROP DATABASE IF EXISTS " + dbName);

            System.out.printf("Creating database %s...%n", dbName);
            stmt.execute("CREATE DATABASE " + dbName + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

            System.out.println("✅ Database reset successfully!");

        } catch (Exception e) {
            System.err.println("❌ Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
