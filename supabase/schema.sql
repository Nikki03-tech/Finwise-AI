-- FinWise AI: private conversation history
-- Run this entire script in the Supabase SQL Editor for your project.
-- Authentication is provided by Supabase Auth. No service-role key is needed.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_title_length check (char_length(title) between 1 and 120),
  constraint conversations_messages_array check (
    case
      when jsonb_typeof(messages) = 'array' then jsonb_array_length(messages) <= 500
      else false
    end
  )
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;

drop policy if exists "Users can view their own conversations" on public.conversations;
create policy "Users can view their own conversations"
  on public.conversations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own conversations" on public.conversations;
create policy "Users can create their own conversations"
  on public.conversations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own conversations" on public.conversations;
create policy "Users can update their own conversations"
  on public.conversations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own conversations" on public.conversations;
create policy "Users can delete their own conversations"
  on public.conversations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.conversations to authenticated;
