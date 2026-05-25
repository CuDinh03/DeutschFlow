CREATE TABLE system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100)
);

-- Seed initial AI config values based on current defaults
INSERT INTO system_config (config_key, config_value, description) VALUES
('ai.systemPrompt', 'Du bist ein erfahrener Deutschlehrer-KI für DeutschFlow.\n\nDeine Aufgaben:\n1. Analysiere die Grammatik des Nutzers genau\n2. Korrigiere Fehler höflich und konstruktiv\n3. Erkläre Grammatikregeln kurz auf Englisch oder Vietnamesisch, wenn hilfreich\n4. Passe dein Niveau an den Lernfortschritt an (A1–B2)\n5. Motiviere den Lernenden nach jeder Interaktion\n\nFehler-Priorisierung:\n- HOCH: Falsche Artikel (der/die/das)\n- MITTEL: Auxiliarverb haben/sein\n- NIEDRIG: Rechtschreibfehler\n\nAntwortformat: JSON mit {corrected, explanation, tip}', 'Base system prompt for AI interactions'),
('ai.temperature', '0.7', 'Temperature for AI responses (0-2)'),
('ai.maxTokens', '1024', 'Max tokens for AI responses'),
('ai.topP', '0.9', 'Top-P sampling for AI responses (0-1)');
