-- V115: Phase 2 Vocabulary Quality — Fix Noun gender via German suffix rules
-- Estimated impact: ~718 nouns will get gender assigned automatically
-- Strategy: German has predictable gender patterns for common suffixes
-- Coverage: ~25% of nouns missing gender (remaining 75% need Wiktionary)

-- ─── DIE (feminine) suffixes ───────────────────────────────────────────────
UPDATE nouns SET gender = 'DIE'
WHERE gender IS NULL AND id IN (
  SELECT id FROM words WHERE dtype = 'Noun'
    AND (
      base_form ILIKE '%ung'    -- Bildung, Wohnung, Meinung
   OR base_form ILIKE '%heit'   -- Freiheit, Gesundheit, Schönheit
   OR base_form ILIKE '%keit'   -- Möglichkeit, Fähigkeit, Ehrlichkeit
   OR base_form ILIKE '%schaft' -- Freundschaft, Gesellschaft, Mannschaft
   OR base_form ILIKE '%tion'   -- Nation, Station, Produktion
   OR base_form ILIKE '%sion'   -- Pension, Version, Mission
   OR base_form ILIKE '%tät'    -- Qualität, Universität, Identität
   OR base_form ILIKE '%ur'     -- Natur, Kultur, Figur
   OR base_form ILIKE '%ik'     -- Musik, Physik, Technik
   OR base_form ILIKE '%ei'     -- Bäckerei, Metzgerei, Bücherei
   OR base_form ILIKE '%ie'     -- Energie, Demokratie, Kategorie
   OR base_form ILIKE '%enz'    -- Konferenz, Intelligenz, Tendenz
   OR base_form ILIKE '%anz'    -- Toleranz, Bilanz, Substanz
   OR base_form ILIKE '%age'    -- Etage, Passage, Garage
   OR base_form ILIKE '%isse'   -- Finsternis (die/das), Erlaubnis
   OR base_form ILIKE '%sis'    -- Basis, Thesis, Analysis
   OR base_form ILIKE '%se'     -- Analyse, Phrase, Bluse
   OR base_form ILIKE '%tur'    -- Kultur, Natur, Architektur
    )
);

-- ─── DAS (neuter) suffixes ─────────────────────────────────────────────────
UPDATE nouns SET gender = 'DAS'
WHERE gender IS NULL AND id IN (
  SELECT id FROM words WHERE dtype = 'Noun'
    AND (
      base_form ILIKE '%chen'   -- Mädchen, Brötchen, Häuschen
   OR base_form ILIKE '%lein'   -- Fräulein, Büchlein
   OR base_form ILIKE '%ment'   -- Moment, Instrument, Argument
   OR base_form ILIKE '%tum'    -- Datum, Zentrum, Eigentum
   OR base_form ILIKE '%tel'    -- Viertel, Drittel, Mittel (mixed, but mostly das)
   OR base_form ILIKE '%um'     -- Museum, Aquarium, Stadium
    )
    -- Exclude -tum forms that are der (Reichtum → der)
    AND base_form NOT ILIKE '%reichtum'
    AND base_form NOT ILIKE '%irrtum'
);

-- ─── DER (masculine) suffixes ─────────────────────────────────────────────
UPDATE nouns SET gender = 'DER'
WHERE gender IS NULL AND id IN (
  SELECT id FROM words WHERE dtype = 'Noun'
    AND (
      base_form ILIKE '%ling'   -- Frühling, Lehrling, Liebling
   OR base_form ILIKE '%ismus'  -- Tourismus, Realismus, Sozialismus
   OR base_form ILIKE '%ant'    -- Student, Assistent, Praktikant
   OR base_form ILIKE '%ist'    -- Artist, Tourist, Journalist
   OR base_form ILIKE '%eur'    --Ateur, Ingenieur, Friseur
   OR base_form ILIKE '%ner'    -- Rentner, Gärtner, Partner
   OR base_form ILIKE '%ler'    -- Künstler, Schüler, Händler
   OR base_form ILIKE '%er'     -- Lehrer, Arbeiter, Computer (strong masculine signal)
    )
    -- Avoid over-applying -er (some are feminine: Mutter, Schwester, Butter)
    AND base_form NOT ILIKE '%mutter'
    AND base_form NOT ILIKE '%tochter'
    AND base_form NOT ILIKE '%schwester'
    AND base_form NOT ILIKE '%butter'
    AND base_form NOT ILIKE '%leiter%'  -- some are die (Leiter = ladder = die)
);

-- Log results
DO $$
DECLARE
  die_count INT;
  das_count INT;
  der_count INT;
  still_null INT;
BEGIN
  SELECT COUNT(*) INTO die_count FROM nouns WHERE gender = 'DIE';
  SELECT COUNT(*) INTO das_count FROM nouns WHERE gender = 'DAS';
  SELECT COUNT(*) INTO der_count FROM nouns WHERE gender = 'DER';
  SELECT COUNT(*) INTO still_null FROM nouns WHERE gender IS NULL;
  RAISE NOTICE 'V115 gender fix: DIE=%, DAS=%, DER=%, still_null=%',
    die_count, das_count, der_count, still_null;
END $$;
