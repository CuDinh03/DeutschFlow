---
name: validate-existing-migration-files
description: Validate existing PostgreSQL Flyway migration files for naming, version order, SQL structure, and repository conventions. Use when the user wants to review, check, or audit migration files.
---

# Validate Existing Migration Files

## Purpose

Check existing Flyway migration files for correctness and consistency before they are merged or deployed.

## Instructions

1. Find the project's migration directory.
   - Prefer `backend/src/main/resources/db/migration/` unless the repository uses a different Flyway path.

2. Inspect the migration files in version order.
   - Verify version numbers are sequential.
   - Confirm there are no duplicates, gaps that matter to the project, or out-of-order filenames.

3. Validate filenames and conventions.
   - File names should follow `V{version}__{description}.sql`.
   - Descriptions should be lowercase, descriptive, and use underscores.
   - Keep naming consistent with the existing project style.

4. Review SQL quality.
   - Ensure the file contains PostgreSQL-compatible SQL.
   - Check for unsafe or unsupported statements for the project's database.
   - Confirm schema changes are explicit and reversible when appropriate.

5. Check for related application changes.
   - If a migration adds or changes columns, tables, or enums, remind the user to update matching Java entities, DTOs, repositories, services, or changelog notes if the project uses them.

## Output expectations

- Report any naming, ordering, or SQL issues found.
- Call out missing follow-up code changes if the database schema changed.
- Keep the feedback concise and actionable.
