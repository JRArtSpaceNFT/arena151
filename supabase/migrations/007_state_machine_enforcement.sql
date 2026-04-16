-- State Machine Transition Enforcement
-- Ensures matches can only transition through valid states

-- Create status history tracking
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- Create function to validate and track state transitions
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
    -- From forming
    WHEN old_status = 'forming' AND new_status IN ('ready', 'abandoned', 'voided', 'expired') THEN TRUE
    -- From ready
    WHEN old_status = 'ready' AND new_status IN ('settlement_pending', 'abandoned', 'voided') THEN TRUE
    -- From settlement_pending
    WHEN old_status = 'settlement_pending' AND new_status IN ('settling', 'settlement_failed') THEN TRUE
    -- From settling
    WHEN old_status = 'settling' AND new_status IN ('settled', 'settlement_failed') THEN TRUE
    -- From settlement_failed
    WHEN old_status = 'settlement_failed' AND new_status IN ('settlement_pending', 'manual_review') THEN TRUE
    -- Allow manual_review from any non-final state
    WHEN new_status = 'manual_review' AND old_status NOT IN ('settled', 'voided') THEN TRUE
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

-- Create trigger
DROP TRIGGER IF EXISTS enforce_match_status_transition ON matches;
CREATE TRIGGER enforce_match_status_transition
  BEFORE UPDATE OF status ON matches
  FOR EACH ROW
  EXECUTE FUNCTION validate_match_status_transition();

COMMENT ON FUNCTION validate_match_status_transition IS
'Enforces valid match status transitions and tracks history';

COMMENT ON COLUMN matches.status_history IS
'JSONB array tracking all status transitions with timestamps';
