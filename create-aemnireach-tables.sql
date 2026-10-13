-- POTENT OS: Aemnireach — SMS + Email marketing add-on
-- Run this in Supabase SQL Editor. Safe to run multiple times.

-- ── Schema ──────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS aemnireach;

-- ── Contacts: who you can message ────────────────────────────────────
CREATE TABLE IF NOT EXISTS aemnireach.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    company TEXT,
    tags TEXT[] DEFAULT '{}',
    is_voip BOOLEAN DEFAULT false,
    sms_opted_out BOOLEAN DEFAULT false,
    email_opted_out BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, phone),
    UNIQUE(user_id, email)
);
CREATE INDEX IF NOT EXISTS idx_aem_contacts_user ON aemnireach.contacts(user_id);

-- ── Messages: every SMS/email sent or received ───────────────────────
CREATE TABLE IF NOT EXISTS aemnireach.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    contact_id UUID REFERENCES aemnireach.contacts(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms','email')),
    direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
    to_address TEXT,
    from_address TEXT,
    subject TEXT,
    body TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('queued','sent','delivered','failed','bounced','replied','opted_out')),
    provider_id TEXT,
    cost_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aem_messages_user ON aemnireach.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_aem_messages_created ON aemnireach.messages(created_at DESC);

-- ── Campaigns: grouped broadcasts ───────────────────────────────────
CREATE TABLE IF NOT EXISTS aemnireach.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms','email')),
    subject TEXT,
    body TEXT NOT NULL,
    audience_tag TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sending','sent')),
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Subscriptions: who pays for the add-on ───────────────────────────
CREATE TABLE IF NOT EXISTS aemnireach.subscriptions (
    user_id UUID PRIMARY KEY,
    tier TEXT DEFAULT 'base' CHECK (tier IN ('base','pro')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active','canceled','past_due')),
    stripe_subscription_id TEXT,
    sms_credits INTEGER DEFAULT 1000,
    email_credits INTEGER DEFAULT 5000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS: users only see their own data ───────────────────────────────
ALTER TABLE aemnireach.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aemnireach.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE aemnireach.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE aemnireach.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own contacts" ON aemnireach.contacts;
CREATE POLICY "own contacts" ON aemnireach.contacts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own messages" ON aemnireach.messages;
CREATE POLICY "own messages" ON aemnireach.messages FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own campaigns" ON aemnireach.campaigns;
CREATE POLICY "own campaigns" ON aemnireach.campaigns FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own subscription" ON aemnireach.subscriptions;
CREATE POLICY "own subscription" ON aemnireach.subscriptions FOR ALL USING (auth.uid() = user_id);
