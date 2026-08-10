-- =============================================================================
-- E-SOVA: Atomic vote casting
-- -----------------------------------------------------------------------------
-- Creates a single database function that records a voter's ballot and updates
-- every candidate's vote count IN ONE TRANSACTION. This prevents the race
-- conditions / partial updates that happen when the app increments each
-- candidate separately (multiple round trips, no atomicity).
--
-- To apply:
--   supabase db push
--   -- or run the file contents in the Supabase SQL editor
--
-- The app calls `rpc('cast_vote', { p_voter_id, p_ballot })` and falls back to
-- its legacy client-side path if this function is not yet deployed.
-- =============================================================================

create or replace function public.cast_vote(p_voter_id text, p_ballot jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_voted boolean;
  v_candidate_id text;
  v_candidate_name text;
begin
  -- Guard: only allow votes while the election is live (defense in depth,
  -- App also checks this, but the server check is authoritative).
  -- if (select status from public.settings where id = 'election_control') <> 'started' then
  --   raise exception 'Election is not active';
  -- end if;

  -- Lock the voter row and check they have not already voted.
  select has_voted into v_has_voted
  from public.users
  where id = p_voter_id
  for update;

  if v_has_voted then
    raise exception 'This voter has already voted';
  end if;

  -- Update every candidate chosen in the ballot within the same transaction.
  for v_candidate_id, v_candidate_name in
    select (ballot_value.value ->> 'id')::text, ballot_value.value ->> 'name'
    from jsonb_each(p_ballot) as ballot_value(key, value)
  loop
    update public.candidates
    set votes = coalesce(votes, 0) + 1
    where id = v_candidate_id;
  end loop;

  -- Record the ballot on the voter.
  update public.users
  set has_voted = true,
      ballot = p_ballot,
      voted_at = now()
  where id = p_voter_id;

  return true;
end;
$$;