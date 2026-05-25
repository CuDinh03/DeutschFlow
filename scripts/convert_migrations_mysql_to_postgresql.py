#!/usr/bin/env python3
"""Convert Flyway migrations from MySQL to PostgreSQL. python3 scripts/convert_migrations_mysql_to_postgresql.py"""
from __future__ import annotations

import re
from pathlib import Path

MIGRATION_DIR = Path(__file__).resolve().parent.parent / "backend/src/main/resources/db/migration"

SET_WORD_RE = re.compile(
    r"^\s*SET\s+(?P<var>@\w+)\s*=\s*\(\s*"
    r"SELECT\s+id\s+FROM\s+words\s+WHERE\s+base_form\s*=\s*'(?P<bf>[^']*)'\s+AND\s+dtype\s*=\s*'(?P<dt>[^']+)'\s*"
    r"\)\s*;\s*$",
    re.I | re.M,
)


def replace_mysql_word_vars(sql: str) -> str:
    mapping: dict[str, str] = {}

    def repl_line(m: re.Match) -> str:
        var, bf, dt = m.group("var"), m.group("bf"), m.group("dt")
        sel = (
            "(SELECT id FROM words WHERE base_form = '"
            + bf.replace("'", "''")
            + "' AND dtype = '"
            + dt.replace("'", "''")
            + "')"
        )
        mapping[var] = sel
        return ""

    sql = SET_WORD_RE.sub(repl_line, sql)
    for var, sel in sorted(mapping.items(), key=lambda x: -len(x[0])):
        sql = sql.replace(var + ",", sel + ",").replace(var + ")", sel + ")")
    sql = re.sub(r"\n{3,}", "\n\n", sql)
    return sql


def strip_column_comments(sql: str) -> str:
    return re.sub(r"\s+(?:COLUMN\s+)?COMMENT\s+'(?:[^']|\\')*'", "", sql, flags=re.I)


def base_conversions(sql: str) -> str:
    sql = replace_mysql_word_vars(sql)
    sql = strip_column_comments(sql)
    sql = re.sub(r"\)\s*ENGINE=InnoDB\s*[^\n);]*;", ");", sql, flags=re.I)
    sql = re.sub(r"\)\s*ENGINE=InnoDB[^\n]*\n", ")\n", sql, flags=re.I)
    sql = sql.replace("JSON_OBJECT(", "json_build_object(")
    sql = sql.replace("JSON_ARRAY(", "json_build_array(")
    sql = re.sub(r"\s+FROM\s+DUAL\b", "", sql, flags=re.I)
    sql = re.sub(r"\s+AFTER\s+\w+", "", sql, flags=re.I)
    sql = re.sub(r"(\s)JSON(\s+(?:NOT\s+)?NULL\b)", r"\1JSONB\2", sql, flags=re.I)
    sql = re.sub(r"(\s)JSON(\s+NOT\s+NULL)", r"\1JSONB\2", sql, flags=re.I)
    sql = re.sub(r"\bENUM\s*\([^)]+\)", "VARCHAR(64)", sql, flags=re.I)
    sql = sql.replace("MEDIUMTEXT", "TEXT").replace("LONGTEXT", "TEXT")
    sql = re.sub(r"TINYINT\s*\(\s*1\s*\)", "BOOLEAN", sql, flags=re.I)
    sql = re.sub(r"\bTINYINT\b(?!\()", "SMALLINT", sql, flags=re.I)
    sql = re.sub(r"DATETIME\s*\(\s*6\s*\)", "TIMESTAMP(6)", sql, flags=re.I)
    sql = re.sub(r"\bDATETIME\b", "TIMESTAMP", sql, flags=re.I)
    sql = re.sub(r"\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP(?:\(\s*6\s*\))?", "", sql, flags=re.I)
    sql = re.sub(
        r"\bBIGINT\s+NOT\s+NULL\s+PRIMARY\s+KEY\s+AUTO_INCREMENT\b",
        "BIGSERIAL PRIMARY KEY",
        sql,
        flags=re.I,
    )
    sql = re.sub(
        r"\bBIGINT\s+PRIMARY\s+KEY\s+AUTO_INCREMENT\b",
        "BIGSERIAL PRIMARY KEY",
        sql,
        flags=re.I,
    )
    sql = re.sub(
        r"\bBIGINT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b",
        "BIGSERIAL PRIMARY KEY",
        sql,
        flags=re.I,
    )
    sql = re.sub(r"\bBIGINT\s+NOT\s+NULL\s+AUTO_INCREMENT\b", "BIGSERIAL", sql, flags=re.I)
    sql = re.sub(r"\bBIGINT\s+AUTO_INCREMENT\b", "BIGSERIAL", sql, flags=re.I)
    if re.search(r"AUTO_INCREMENT", sql, flags=re.I):
        raise RuntimeError("AUTO_INCREMENT still present after conversion")
    sql = re.sub(
        r"^\s*UNIQUE KEY\s+(\w+)\s*\(([^)]+)\)\s*,?\s*$",
        r"    CONSTRAINT \1 UNIQUE (\2),",
        sql,
        flags=re.I | re.M,
    )
    return sql


def hoist_indexes(create_body: str, table_name: str) -> tuple[str, list[str]]:
    indexes: list[str] = []
    kept: list[str] = []
    for raw in create_body.splitlines():
        mi = re.match(r"^\s*(?:KEY|INDEX)\s+(\w+)\s*\((.+)\)\s*,?$", raw.rstrip(), flags=re.I)
        if mi:
            iname, cols = mi.group(1), mi.group(2).strip()
            indexes.append(f"CREATE INDEX IF NOT EXISTS {iname} ON {table_name} ({cols});")
            continue
        kept.append(raw)
    inner = "\n".join(kept).rstrip().rstrip(",")
    return inner, indexes


def rewrite_create_tables(sql: str) -> str:
    cre = re.compile(
        r"(?P<head>^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?P<name>\w+)\s*)\(\s*\n(?P<body>[\s\S]*?)^\)\s*;",
        flags=re.MULTILINE,
    )

    def repl(match: re.Match) -> str:
        head = match.group("head")
        tbl = match.group("name")
        body = match.group("body")
        uniq_fix = ""
        body2 = body
        if tbl == "curated_resource_entries" and "canonical_url(255)" in body:
            body2 = re.sub(
                r",?\s*UNIQUE KEY\s+uk_cre_week_url\s*\([^)]*canonical_url\s*\([^)]*\)[^)]*\)\s*,?",
                "",
                body2,
                flags=re.I,
            )
            uniq_fix = (
                "\nCREATE UNIQUE INDEX IF NOT EXISTS uk_cre_week_url "
                "ON curated_resource_entries (digest_week_start, LEFT(canonical_url, 255));\n"
            )
        inner, ix = hoist_indexes(body2, tbl)
        inner_clean = inner.rstrip()
        if inner_clean.endswith(","):
            inner_clean = inner_clean[:-1]
        tail = uniq_fix + "\n".join(ix)
        return f"{head} (\n{inner_clean}\n);" + ("\n" + tail + "\n" if tail else "\n")

    return cre.sub(repl, sql)


def patch_v42_pg(_: str) -> str:
    return """-- Daily quota + wallets (PostgreSQL)
CREATE TABLE IF NOT EXISTS user_ai_token_wallets (
  user_id BIGINT NOT NULL PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  last_accrual_local_date DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS daily_token_grant BIGINT NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS wallet_cap_days SMALLINT NOT NULL DEFAULT 0;

INSERT INTO subscription_plans (code, name, monthly_token_limit, daily_token_grant, wallet_cap_days, features_json, is_active)
SELECT 'DEFAULT', 'Default', 0, 0, 0, json_build_object('streaming', false)::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'DEFAULT');

UPDATE subscription_plans SET daily_token_grant = 50000, wallet_cap_days = 0, monthly_token_limit = 50000 WHERE code = 'FREE';
UPDATE subscription_plans SET daily_token_grant = 400000, wallet_cap_days = 30, monthly_token_limit = 400000 WHERE code = 'PRO';
UPDATE subscription_plans SET daily_token_grant = 850000, wallet_cap_days = 30, monthly_token_limit = 850000 WHERE code = 'ULTRA';
UPDATE subscription_plans SET daily_token_grant = 0, wallet_cap_days = 0, monthly_token_limit = 0 WHERE code = 'DEFAULT';
UPDATE subscription_plans SET daily_token_grant = 0, wallet_cap_days = 0, monthly_token_limit = 999999999 WHERE code = 'INTERNAL';

UPDATE user_subscriptions us
SET ends_at = us.starts_at + INTERVAL '7 days',
    updated_at = CURRENT_TIMESTAMP()
FROM subscription_plans sp
WHERE sp.code = us.plan_code
  AND sp.code = 'FREE'
  AND us.status = 'ACTIVE'
  AND us.ends_at IS NULL;

INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
SELECT u.id, 'FREE', 'ACTIVE', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) + INTERVAL '7 days'
FROM users u
WHERE u.role = 'STUDENT'
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions s WHERE s.user_id = u.id AND s.status = 'ACTIVE'
  );
"""


def patch_v45_pg(_: str) -> str:
    return """-- Weekly speaking seed (PostgreSQL)
INSERT INTO weekly_speaking_prompts (
    week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, is_active
)
SELECT DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE,
       'B1',
       'Woche im Überblick',
       'Sprechen Sie etwa 1–2 Minuten auf Deutsch: Was haben Sie diese Woche gemacht? Nennen Sie mindestens eine Arbeitssache und eine Freizeitsache.',
       json_build_array('Arbeit oder Lernen nennen', 'Freizeit oder Hobby nennen', 'Zeitmarker wie „diese Woche“ verwenden')::jsonb,
       json_build_array('Kurz sagen, wie es war (gut/mühsam)')::jsonb,
       TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM weekly_speaking_prompts w
    WHERE w.week_start_date = DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE
      AND w.cefr_band = 'B1'
);

INSERT INTO weekly_speaking_prompts (
    week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, is_active
)
SELECT DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE,
       'A2',
       'Meine Woche (einfach)',
       'Erzählen Sie in sehr einfachen Sätzen: Was haben Sie diese Woche gemacht?',
       json_build_array('Mindestens zwei Aktivitäten nennen', 'Ein Satz über Montag oder Wochenende')::jsonb,
       json_build_array('Ein Adjektiv: gut, müde, interessant')::jsonb,
       TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM weekly_speaking_prompts w
    WHERE w.week_start_date = DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE
      AND w.cefr_band = 'A2'
);
"""


SPECIAL = {
    "V42__ai_quota_daily_vn_and_wallets.sql": patch_v42_pg,
    "V45__seed_weekly_speaking_prompts.sql": patch_v45_pg,
}


def convert_file(path: Path) -> None:
    original = path.read_text(encoding="utf-8")
    if path.name in SPECIAL:
        path.write_text(SPECIAL[path.name](original).strip() + "\n", encoding="utf-8")
        return
    sql = base_conversions(original)
    sql = rewrite_create_tables(sql)
    sql = re.sub(r"TIMESTAMPZ\b", "TIMESTAMP", sql, flags=re.I)
    sql = re.sub(r"CURRENT_TIMESTAMP\b(?!\()", "CURRENT_TIMESTAMP()", sql)
    sql = re.sub(r"NOW\b(?!\()", "NOW()", sql)
    path.write_text(sql.strip() + "\n", encoding="utf-8")


def main() -> None:
    paths = sorted(MIGRATION_DIR.glob("V*.sql"))
    if not paths:
        raise SystemExit("no migrations")
    for p in paths:
        convert_file(p)
        print("converted", p.name)


if __name__ == "__main__":
    main()
