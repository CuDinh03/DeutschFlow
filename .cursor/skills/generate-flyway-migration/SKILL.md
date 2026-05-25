---
name: generate-flyway-migration
description: Generate a new PostgreSQL Flyway migration file by detecting the next sequential version and following the repository's naming conventions. Use when the user asks to create or draft a database migration file.
---

# Generate Flyway Migration

## Purpose

Create a new PostgreSQL Flyway migration file in the project's migration directory.

## Instructions

1. Find the current migration directory.
   - Prefer the project's backend Flyway path, typically `backend/src/main/resources/db/migration/`.
   - If the project uses a different migration path, use that path instead.

2. Inspect existing migration filenames and identify the highest version number.
   - Example: if the latest file is `V140__...sql`, the next file must use `V141`.

3. Create the new file with this format:

```text
V{next_version}__mo_ta_tinh_nang.sql
```

4. Write PostgreSQL SQL only.
   - Keep the migration executable and aligned with Flyway naming rules.
   - Use `JSONB` for flexible or semi-structured data when the schema needs it.

5. If the change affects application models or schema tracking, remind the user to update related code.
   - Mention the changelog if the project uses one.
   - Mention matching Java entities, repositories, or services when needed.

## Output expectations

- Create the migration file in the correct directory.
- Use the next sequential Flyway version.
- Use a descriptive filename consistent with the project's existing style.
- End by reminding the user to update any related changelog or Java entity files if necessary.
