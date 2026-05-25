package com.deutschflow.util;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Imports Goethe A1 vocab+examples from wordsDeutsch/A1_clean.tsv into DB.
 *
 * Storage:
 * - words.dtype = 'Word'
 * - words.base_form = vocab (as-is)
 * - words.cefr_level = 'A1'
 * - words.usage_note = example (German example sentence(s))
 *
 * Idempotent:
 * - If (base_form, cefr_level) exists, only fills usage_note when empty.
 */
public class ImportGoetheA1FromTsv {

    public static void main(String[] args) throws Exception {
        String filePath = args.length > 0 ? args[0] : "wordsDeutsch/A1_clean.tsv";

        String host = System.getenv().getOrDefault("DB_HOST", "localhost");
        String port = System.getenv().getOrDefault("DB_PORT", "5432");
        String dbName = System.getenv().getOrDefault("DB_NAME", "deutschflow");
        String user = System.getenv().getOrDefault("DB_USERNAME", "root");
        String password = System.getenv().getOrDefault("DB_PASSWORD", "");

        String url = String.format(
                "jdbc:postgresql://%s:%s/%s?stringtype=unspecified",
                host, port, dbName
        );

        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            conn.setAutoCommit(false);

            try (PreparedStatement selectStmt = conn.prepareStatement(
                    "SELECT id, usage_note FROM words WHERE base_form = ? AND cefr_level = ? LIMIT 1"
            );
                 PreparedStatement insertStmt = conn.prepareStatement(
                         "INSERT INTO words (dtype, base_form, cefr_level, usage_note, created_at, updated_at) " +
                                 "VALUES ('Word', ?, ?, ?, NOW(), NOW())"
                 );
                 PreparedStatement updateStmt = conn.prepareStatement(
                         "UPDATE words SET usage_note = ?, updated_at = NOW() WHERE id = ?"
                 );
                 BufferedReader reader = new BufferedReader(
                         new InputStreamReader(new FileInputStream(filePath), StandardCharsets.UTF_8)
                 )
            ) {
                String line;
                int lineNo = 0;
                while ((line = reader.readLine()) != null) {
                    lineNo++;
                    if (line.isBlank()) continue;

                    // TSV: level \t vocab \t example
                    // Some lines may have multiple spaces; prefer tab split with fallback.
                    String[] parts = line.split("\t", 3);
                    if (parts.length < 3) {
                        parts = line.split("\\s{2,}", 3);
                    }
                    if (parts.length < 3) {
                        skipped++;
                        continue;
                    }

                    String level = parts[0].trim().toUpperCase();
                    String vocab = parts[1].trim();
                    String example = parts[2].trim();

                    if (!"A1".equals(level) || vocab.isEmpty() || example.isEmpty()) {
                        skipped++;
                        continue;
                    }

                    selectStmt.setString(1, vocab);
                    selectStmt.setString(2, level);

                    try (ResultSet rs = selectStmt.executeQuery()) {
                        if (rs.next()) {
                            long id = rs.getLong("id");
                            String usage = rs.getString("usage_note");
                            if (usage == null || usage.isBlank()) {
                                updateStmt.setString(1, example);
                                updateStmt.setLong(2, id);
                                updateStmt.executeUpdate();
                                updated++;
                            } else {
                                skipped++;
                            }
                        } else {
                            insertStmt.setString(1, vocab);
                            insertStmt.setString(2, level);
                            insertStmt.setString(3, example);
                            insertStmt.executeUpdate();
                            inserted++;
                        }
                    } catch (Exception e) {
                        conn.rollback();
                        throw new RuntimeException("Failed at line " + lineNo + ": " + line, e);
                    }

                    if ((inserted + updated) % 200 == 0) {
                        conn.commit();
                    }
                }

                conn.commit();
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        }

        System.out.printf("Import complete. Inserted=%d Updated=%d Skipped=%d%n", inserted, updated, skipped);
    }
}

