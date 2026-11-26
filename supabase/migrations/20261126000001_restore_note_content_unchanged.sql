-- Restore must give back exactly the note content that was backed up.
--
-- clean_note() rewrote every tag carrying an attribute into visible text, which damaged
-- legitimate formatting (for example paragraphs pasted from a word processor). Note HTML is
-- sanitised by the application at every point where it is displayed, edited or saved
-- (src/lib/note-html.ts), so the database stores it unchanged, as it already does for notes
-- written directly through the API.
create or replace function workspace_backup_private.clean_note(content text)
returns text language sql immutable strict set search_path = ''
as $$
  select content;
$$;
