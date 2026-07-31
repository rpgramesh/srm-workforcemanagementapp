-- =====================================================================
-- ShiftMaster Pro — Migration 007
-- Messaging System: threads, messages, recipients, read receipts,
-- broadcast-to-department, and real-time RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. message_threads — top-level conversation containers
--    A thread is either:
--      kind='direct'       — 2-person (sender↔recipient)
--      kind='department'   — broadcast target (anyone in department can view)
--      kind='group'        — future expansion (N explicit recipients)
-- ---------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE thread_kind AS ENUM ('direct', 'department', 'group');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.message_threads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            thread_kind NOT NULL DEFAULT 'direct',
    title           TEXT,                                   -- optional override; otherwise inferred from participants
    department_id   UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS msg_threads_kind_idx        ON public.message_threads(kind);
CREATE INDEX IF NOT EXISTS msg_threads_dept_idx        ON public.message_threads(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS msg_threads_last_msg_idx    ON public.message_threads(last_message_at DESC);

DROP TRIGGER IF EXISTS msg_threads_set_updated_at ON public.message_threads;
CREATE TRIGGER msg_threads_set_updated_at
BEFORE UPDATE ON public.message_threads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 2. thread_participants — explicit membership for direct/group threads
--    (department threads use the users.department_id relation instead)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.thread_participants (
    thread_id       UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    added_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS tp_user_idx ON public.thread_participants(user_id);

-- ---------------------------------------------------------------------
-- 3. messages — individual pieces of content inside a thread
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
    body            TEXT NOT NULL CONSTRAINT messages_body_min CHECK (length(btrim(body)) > 0),
    metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,   -- delivery_status, attachments, etc
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS msg_thread_created_idx   ON public.messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS msg_sender_idx           ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS msg_created_desc_idx     ON public.messages(created_at DESC);

DROP TRIGGER IF EXISTS messages_set_updated_at ON public.messages;
CREATE TRIGGER messages_set_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 4. message_read_receipts — per-user, per-message timestamps
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.message_read_receipts (
    message_id      UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS mrr_user_idx ON public.message_read_receipts(user_id);

-- ---------------------------------------------------------------------
-- 5. trigger — update thread.last_message_at after INSERT on messages
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bump_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.message_threads t
       SET last_message_at = NOW() AT TIME ZONE 'UTC'
     WHERE t.id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS msg_bump_thread ON public.messages;
CREATE TRIGGER msg_bump_thread
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION bump_thread_last_message_at();

-- ---------------------------------------------------------------------
-- 6. RLS — authenticated users see only their own threads/messages
-- ---------------------------------------------------------------------

ALTER TABLE public.message_threads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts   ENABLE ROW LEVEL SECURITY;

-- message_threads: visible if user is a participant OR thread is broadcast to their dept
DROP POLICY IF EXISTS threads_visible_scope ON public.message_threads;
CREATE POLICY threads_visible_scope ON public.message_threads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.thread_participants tp
       WHERE tp.thread_id = message_threads.id AND tp.user_id = auth.uid()
    )
    OR (
      kind = 'department'
      AND EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.id = auth.uid()
           AND u.department_id = message_threads.department_id
      )
    )
  );

-- thread_participants — own-row + perms
DROP POLICY IF EXISTS tp_own_rows ON public.thread_participants;
CREATE POLICY tp_own_rows ON public.thread_participants
  FOR SELECT
  USING (user_id = auth.uid());

-- messages — visible if visible thread
DROP POLICY IF EXISTS messages_visible_thread ON public.messages;
CREATE POLICY messages_visible_thread ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.message_threads t
       WHERE t.id = messages.thread_id
         AND (
           EXISTS (SELECT 1 FROM public.thread_participants tp WHERE tp.thread_id = t.id AND tp.user_id = auth.uid())
           OR (t.kind = 'department' AND EXISTS (
                SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.department_id = t.department_id
           ))
         )
    )
  );

-- read receipts: own + other participants of same thread (to show "Seen" state)
DROP POLICY IF EXISTS mrr_scope ON public.message_read_receipts;
CREATE POLICY mrr_scope ON public.message_read_receipts
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
     WHERE m.id = message_read_receipts.message_id AND tp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 7. ensure_direct_thread SECURITY DEFINER RPC
--    Idempotently returns the direct-thread UUID between two users.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ensure_direct_thread(p_user_a UUID, p_user_b UUID)
RETURNS UUID AS $$
DECLARE
    existing UUID;
    new_id   UUID;
BEGIN
    IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
        RAISE EXCEPTION 'Both participant IDs must exist and must differ';
    END IF;

    SELECT t.id INTO existing
      FROM public.message_threads t
      JOIN public.thread_participants a ON a.thread_id = t.id AND a.user_id = p_user_a
      JOIN public.thread_participants b ON b.thread_id = t.id AND b.user_id = p_user_b
     WHERE t.kind = 'direct'
     LIMIT 1;

    IF existing IS NOT NULL THEN
        RETURN existing;
    END IF;

    INSERT INTO public.message_threads (kind, created_by)
    VALUES ('direct', p_user_a) RETURNING id INTO new_id;

    INSERT INTO public.thread_participants (thread_id, user_id, added_by) VALUES
        (new_id, p_user_a, p_user_a),
        (new_id, p_user_b, p_user_a);

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION ensure_direct_thread(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_direct_thread(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------
-- 8. ensure_department_thread SECURITY DEFINER RPC
--    Idempotently returns the broadcast thread for a department.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ensure_department_thread(p_department_id UUID, p_title TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    existing UUID;
    new_id   UUID;
BEGIN
    IF p_department_id IS NULL THEN
        RAISE EXCEPTION 'department_id is required';
    END IF;

    SELECT id INTO existing
      FROM public.message_threads t
     WHERE t.kind = 'department'
       AND t.department_id = p_department_id
     LIMIT 1;

    IF existing IS NOT NULL THEN
        RETURN existing;
    END IF;

    INSERT INTO public.message_threads (kind, department_id, title)
    VALUES ('department', p_department_id, COALESCE(NULLIF(btrim(p_title), ''), (
        SELECT '#' || d.name FROM public.departments d WHERE d.id = p_department_id
    ))) RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION ensure_department_thread(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_department_thread(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- 9. send_message SECURITY DEFINER RPC
--    Appends a message to a thread, optionally bumps it.
--    Returns the newly-inserted message id.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION send_message(
    p_thread_id UUID,
    p_sender_id UUID,
    p_body      TEXT
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    clean_body TEXT := btrim(p_body);
BEGIN
    IF clean_body IS NULL OR length(clean_body) = 0 THEN
        RAISE EXCEPTION 'Message body cannot be empty';
    END IF;
    IF p_thread_id IS NULL THEN
        RAISE EXCEPTION 'thread_id is required';
    END IF;
    IF p_sender_id IS NULL THEN
        RAISE EXCEPTION 'sender_id is required';
    END IF;
    -- Verify sender is allowed to post in this thread
    PERFORM 1
      FROM public.message_threads t
     WHERE t.id = p_thread_id
       AND (
         EXISTS (SELECT 1 FROM public.thread_participants tp WHERE tp.thread_id = t.id AND tp.user_id = p_sender_id)
         OR (t.kind = 'department' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_sender_id AND u.department_id = t.department_id))
       );
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sender is not a participant of this thread';
    END IF;

    INSERT INTO public.messages (thread_id, sender_id, body)
    VALUES (p_thread_id, p_sender_id, clean_body) RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION send_message(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION send_message(UUID, UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- 10. mark_thread_read_until SECURITY DEFINER RPC
--     Atomically writes (or upserts) read receipts for every message in
--     a thread up to and including p_message_id, for the given user.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mark_thread_read_until(p_thread_id UUID, p_user_id UUID, p_message_id UUID)
RETURNS INTEGER AS $$
DECLARE
    inserted INTEGER;
BEGIN
    INSERT INTO public.message_read_receipts (message_id, user_id)
    SELECT m.id, p_user_id
      FROM public.messages m
     WHERE m.thread_id = p_thread_id
       AND m.id <= p_message_id
       AND m.created_at <= (SELECT created_at FROM public.messages WHERE id = p_message_id)
    ON CONFLICT (message_id, user_id) DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION mark_thread_read_until(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_thread_read_until(UUID, UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------
-- 11. poll_new_messages SECURITY DEFINER RPC
--     Returns all messages for a user created strictly after a given timestamp.
--     Used for client-side polling (Realtime not guaranteed on all plans).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION poll_new_messages(p_user_id UUID, p_since TIMESTAMPTZ)
RETURNS TABLE (
    message_id    UUID,
    thread_id     UUID,
    sender_id     UUID,
    sender_name   TEXT,
    body          TEXT,
    created_at    TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.id,
           m.thread_id,
           m.sender_id,
           COALESCE(u.first_name || ' ' || u.last_name, 'Unknown')::TEXT,
           m.body,
           m.created_at
      FROM public.messages m
      JOIN public.message_threads t ON t.id = m.thread_id
      LEFT JOIN public.users u ON u.id = m.sender_id
     WHERE m.created_at > COALESCE(p_since, '-infinity'::TIMESTAMPTZ)
       AND (
         EXISTS (SELECT 1 FROM public.thread_participants tp WHERE tp.thread_id = t.id AND tp.user_id = p_user_id)
         OR (t.kind = 'department' AND EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = p_user_id AND u2.department_id = t.department_id))
       )
     ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION poll_new_messages(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION poll_new_messages(UUID, TIMESTAMPTZ) TO service_role;

-- ---------------------------------------------------------------------
-- 12. list_thread_summaries SECURITY DEFINER RPC
--     Returns one row per visible thread with unread-count + preview.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION list_thread_summaries(p_user_id UUID)
RETURNS TABLE (
    thread_id       UUID,
    kind            thread_kind,
    title           TEXT,
    last_preview    TEXT,
    last_created_at TIMESTAMPTZ,
    unread_count    BIGINT,
    last_sender_id  UUID,
    department_id   UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id,
           t.kind,
           COALESCE(NULLIF(btrim(t.title), ''), CASE
               WHEN t.kind = 'direct' THEN (
                   SELECT u.first_name || ' ' || u.last_name
                     FROM public.thread_participants tp2
                     JOIN public.users u ON u.id = tp2.user_id
                    WHERE tp2.thread_id = t.id AND tp2.user_id <> p_user_id
                    LIMIT 1
               )
               WHEN t.kind = 'department' THEN (
                   SELECT '#' || d.name FROM public.departments d WHERE d.id = t.department_id
               )
               ELSE NULL
           END)::TEXT AS title,
           (SELECT left(btrim(m2.body), 140)
              FROM public.messages m2
             WHERE m2.thread_id = t.id
             ORDER BY m2.created_at DESC LIMIT 1) AS last_preview,
           t.last_message_at AS last_created_at,
           (
               SELECT COUNT(*)
                 FROM public.messages m3
                 LEFT JOIN public.message_read_receipts r
                        ON r.message_id = m3.id AND r.user_id = p_user_id
                WHERE m3.thread_id = t.id
                  AND r.message_id IS NULL
                  AND m3.sender_id IS DISTINCT FROM p_user_id
           ) AS unread_count,
           (SELECT m4.sender_id
              FROM public.messages m4
             WHERE m4.thread_id = t.id ORDER BY m4.created_at DESC LIMIT 1) AS last_sender_id,
           t.department_id
      FROM public.message_threads t
     WHERE (
         EXISTS (SELECT 1 FROM public.thread_participants tp WHERE tp.thread_id = t.id AND tp.user_id = p_user_id)
         OR (t.kind = 'department' AND EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = p_user_id AND u2.department_id = t.department_id))
     )
     ORDER BY t.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION list_thread_summaries(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_thread_summaries(UUID) TO service_role;
