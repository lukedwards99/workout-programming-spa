CREATE TRIGGER trg_workspaces_legal_hold_delete
BEFORE DELETE ON workspaces
FOR EACH ROW
WHEN OLD.legal_hold_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'workspace_legal_hold_active');
END;
