-- TASK-CR-005 phase 1: commit the enum value before functions reference it.
-- archived remains visible to authenticated users and on the map; hidden is the
-- manager's rejection/hide state and is excluded from default views.

alter type public.site_status add value if not exists 'hidden';
