-- 0004_domain_config_v3_survey_revisions.sql — CR-004
-- Append-only Survey configuration: USD/month + edit-and-resend revision semantics.
-- Existing v1/v2 rows and survey_result history are deliberately left untouched.

insert into public.domain_config (project_id, version, config)
select p.id, 3,
'{
  "schema_note": "CR-004; rent is USD/month; editing creates a new survey_result and never overwrites history",
  "currency": {"rent": "USD", "period": "month"},
  "revision_policy": {
    "mode": "append_only",
    "identity": "site_id",
    "supersedes_path": "raw.supersedes",
    "surveyed_at_path": "raw.surveyed_at",
    "current_projection": "latest surveyed_at per site_id; created_at is the database fallback",
    "retry_idempotency": "same survey_result.id is one submission retry; an edited resend receives a new id"
  },
  "groups": {"A": "调查员自选", "B": "领导推荐", "C": "本地同事推荐"},
  "photo_checklist": {
    "p1": "stand across the road: whole frontage AND the road in one shot",
    "p2": "at the doorway, shoot down the road LEFT",
    "p3": "at the doorway, shoot down the road RIGHT",
    "p4": "the OPPOSITE side of the road"
  },
  "tasks": {
    "survey": {"label": "Lead / 扫街", "fields": [
      {"name": "pname", "type": "text", "required": true, "label": "Point name"},
      {"name": "proad", "type": "text", "required": true, "label": "Road / area"},
      {"name": "pin", "type": "text", "label": "Location pin (Google Maps share link)"},
      {"name": "area", "type": "number", "label": "Space (sqm)"},
      {"name": "front", "type": "number", "label": "Frontage width (m)"},
      {"name": "rent", "type": "number", "required": true, "currency": "USD", "period": "month", "label": "RENT ASKED (USD per month)"},
      {"name": "refused", "type": "bool", "label": "Rent refused"},
      {"name": "ll", "type": "text", "label": "Landlord / agent name"},
      {"name": "llphone", "type": "text", "label": "Landlord / agent phone"},
      {"name": "p1", "type": "bool", "label": "P1 front + road"},
      {"name": "p2", "type": "bool", "label": "P2 doorway LEFT"},
      {"name": "p3", "type": "bool", "label": "P3 doorway RIGHT"},
      {"name": "p4", "type": "bool", "label": "P4 opposite side"},
      {"name": "notes", "type": "text", "label": "Notes"}]},
    "verify": {"label": "Verify / 核查", "fields": [
      {"name": "bld", "type": "text", "required": true, "label": "Building / shop name"},
      {"name": "road", "type": "text", "required": true, "label": "Road / street"},
      {"name": "area", "type": "number", "label": "Space (sqm)"},
      {"name": "rent", "type": "number", "currency": "USD", "period": "month", "label": "Rent asked (USD per month)"},
      {"name": "contact", "type": "text", "label": "Contact person"},
      {"name": "phone", "type": "text", "label": "Phone"},
      {"name": "pin", "type": "text", "label": "Location Pin"},
      {"name": "notes", "type": "text", "label": "Notes"}]}}}
'::jsonb
from public.project p
where p.code = 'uganda-showroom'
on conflict (project_id, version) do nothing;
