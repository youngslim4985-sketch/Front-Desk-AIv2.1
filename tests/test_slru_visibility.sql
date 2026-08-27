-- Verify required SLRU statistics are exposed.

SELECT name
FROM pg_stat_slru
WHERE name IN (
    'Subtrans',
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;
