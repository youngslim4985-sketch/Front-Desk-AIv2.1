-- Standby availability experiment
-- Purpose: determine whether an overflowed transaction delays
-- hot-standby snapshot availability.

-- Requires a dedicated primary/standby environment.

-- TODO:
-- 1. Start controlled overflow transaction on primary.
-- 2. Start/restart standby.
-- 3. Monitor recovery state.
-- 4. Record first successful read-only query.
-- 5. Record relevant WAL/recovery events.
