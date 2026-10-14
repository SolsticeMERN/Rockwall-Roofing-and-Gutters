-- Safe to rerun for this application's schema; existing leads are preserved.
-- Only the server service-role can access these tables.
begin;
create table if not exists public.roofing_leads (
 id uuid primary key, name text not null, phone text not null, zip text not null,
 service text not null, message text not null default '', placement text not null,
 attribution jsonb not null default '{}', status text not null default 'new',
 notes text not null default '', created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), follow_up_at timestamptz default now(),
 inspection_at timestamptz, version integer not null default 1
);
create table if not exists public.roofing_notifications (
 id text primary key, lead_id uuid references public.roofing_leads(id) on delete cascade,
 kind text not null, snapshot jsonb not null, created_at timestamptz not null default now(), sent_at timestamptz
);
create table if not exists public.roofing_rate_limits (fingerprint text not null, created_at timestamptz not null default now());
create index if not exists roofing_rate_limits_fingerprint_created_idx on public.roofing_rate_limits(fingerprint,created_at);
alter table public.roofing_leads enable row level security;
alter table public.roofing_notifications enable row level security;
alter table public.roofing_rate_limits enable row level security;
revoke all on public.roofing_leads, public.roofing_notifications, public.roofing_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.roofing_leads, public.roofing_notifications, public.roofing_rate_limits to service_role;

create or replace function public.capture_roofing_lead(payload jsonb, fingerprint text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare added uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(fingerprint,0));
 if exists(select 1 from roofing_leads where id=(payload->>'id')::uuid) then return '{"duplicate":true}'::jsonb; end if;
 delete from roofing_rate_limits where created_at < now()-interval '1 hour';
 if (select count(*) from roofing_rate_limits r where r.fingerprint=capture_roofing_lead.fingerprint) >= 10 then return '{"limited":true}'::jsonb; end if;
 insert into roofing_rate_limits(fingerprint) values(capture_roofing_lead.fingerprint);
 insert into roofing_leads(id,name,phone,zip,service,message,placement,attribution)
 values((payload->>'id')::uuid,payload->>'name',payload->>'phone',payload->>'zip',payload->>'service',payload->>'message',payload->>'placement',payload->'attribution') on conflict do nothing returning id into added;
 if added is not null then insert into roofing_notifications(id,lead_id,kind,snapshot) values('new:'||added,added,'new',payload||jsonb_build_object('status','new')); end if;
 return '{"duplicate":false}'::jsonb;
end $$;

create or replace function public.update_roofing_lead(lead_id uuid, expected_version integer, changes jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare item roofing_leads;
begin
 select * into item from roofing_leads where id=lead_id for update;
 if not found then return '{"missing":true}'::jsonb; end if;
 if item.version <> expected_version then return '{"conflict":true}'::jsonb; end if;
 update roofing_leads set status=changes->>'status',notes=changes->>'notes',follow_up_at=(changes->>'follow_up_at')::timestamptz,inspection_at=(changes->>'inspection_at')::timestamptz,updated_at=now(),version=version+1 where id=lead_id returning * into item;
 delete from roofing_notifications where roofing_notifications.lead_id=update_roofing_lead.lead_id and kind='followup' and sent_at is null;
 if item.follow_up_at is not null then insert into roofing_notifications(id,lead_id,kind,snapshot,created_at) values('followup:'||item.id||':'||item.version,item.id,'followup',to_jsonb(item),item.follow_up_at); end if;
 return jsonb_build_object('lead',to_jsonb(item));
end $$;
revoke all on function public.capture_roofing_lead(jsonb,text), public.update_roofing_lead(uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.capture_roofing_lead(jsonb,text), public.update_roofing_lead(uuid,integer,jsonb) to service_role;
commit;
