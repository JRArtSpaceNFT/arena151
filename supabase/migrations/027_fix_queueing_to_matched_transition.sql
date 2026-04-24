-- Fix: Allow queueing → matched transition for matchmaking
-- The atomic matchmaking function changes status from queueing to matched when player_b joins

CREATE OR REPLACE FUNCTION validate_match_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  old_status TEXT;
  new_status TEXT;
  valid_transition BOOLEAN := FALSE;
BEGIN
  old_status := OLD.status;
  new_status := NEW.status;
  
  -- If status unchanged, allow
  IF old_status = new_status THEN
    RETURN NEW;
  END IF;
  
  -- Define valid transitions
  valid_transition := CASE
    -- From queueing (new matchmaking flow)
    WHEN old_status = 'queueing' AND new_status IN ('matched', 'abandoned', 'expired', 'cancelled') THEN TRUE
    -- From matched (new matchmaking flow)
    WHEN old_status = 'matched' AND new_status IN ('arena_reveal', 'battle_ready', 'settlement_pending', 'abandoned') THEN TRUE
    -- From arena_reveal
    WHEN old_status = 'arena_reveal' AND new_status IN ('battle_ready', 'settlement_pending', 'abandoned') THEN TRUE
    -- From battle_ready
    WHEN old_status = 'battle_ready' AND new_status IN ('settlement_pending', 'abandoned') THEN TRUE
    -- From forming (legacy)
    WHEN old_status = 'forming' AND new_status IN ('ready', 'abandoned', 'voided', 'expired') THEN TRUE
    -- From ready (legacy)
    WHEN old_status = 'ready' AND new_status IN ('settlement_pending', 'abandoned', 'voided') THEN TRUE
    -- From settlement_pending
    WHEN old_status = 'settlement_pending' AND new_status IN ('settling', 'settlement_failed', 'settled') THEN TRUE
    -- From settling
    WHEN old_status = 'settling' AND new_status IN ('settled', 'settlement_failed') THEN TRUE
    -- From settlement_failed
    WHEN old_status = 'settlement_failed' AND new_status IN ('settlement_pending', 'manual_review') THEN TRUE
    -- Allow manual_review from any non-final state
    WHEN new_status = 'manual_review' AND old_status NOT IN ('settled', 'voided') THEN TRUE
    -- Allow cancelled from most states
    WHEN new_status = 'cancelled' AND old_status NOT IN ('settled', 'settling') THEN TRUE
    ELSE FALSE
  END;
  
  -- Reject invalid transitions
  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', old_status, new_status
      USING ERRCODE = 'check_violation';
  END IF;
  
  -- Append to status history
  NEW.status_history := COALESCE(OLD.status_history, '[]'::jsonb) || 
    jsonb_build_object(
      'from', old_status,
      'to', new_status,
      'at', NOW()
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
