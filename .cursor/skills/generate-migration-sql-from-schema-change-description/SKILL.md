---
name: generate-migration-sql-from-schema-change-description
description: Draft PostgreSQL Flyway migration SQL from a schema change description. Use when the user provides a database change request and wants the migration SQL written.
---

# Generate Migration SQL from Schema Change Description

## Purpose

Turn a schema change request into a PostgreSQL Flyway migration draft.

## Instructions

1. Read the user's schema change description carefully.
   - Identify tables, columns, indexes, constraints, enums, and any data backfill requirements.

2. Follow the project's Flyway conventions.
   - Place the SQL in the migration directory used by the project, typically `backend/src/main/resources/db/migration/`.
   - Use the next available version number when a file is being created.
   - Use the filename format `V{version}__{description}.sql`.

3. Write PostgreSQL SQL.
   - Prefer explicit DDL statements.
   - Add `JSONB` when the schema needs flexible or semi-structured data.
   - Include backfill or migration-safe steps when needed.

4. Keep the output practical.
   - Make the SQL ready to paste into a Flyway migration file.
   - If the schema change seems incomplete, ask a focused follow-up question before finalizing.

5. Remind the user about follow-up work.
   - Mention matching Java entities, DTOs, repositories, services, or changelog updates if the change affects them.

## Output expectations

- Provide PostgreSQL migration SQL tailored to the requested change.
- Match the repository's naming and Flyway style.
- End with a reminder about any related code or changelog updates.
