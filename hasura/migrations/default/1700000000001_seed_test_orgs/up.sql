-- Seed Organizations
INSERT INTO public.organizations (id, name, calls_used, calls_allowed)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp (Org A)', 0, 100),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta Labs (Org B)', 0, 50)
ON CONFLICT (id) DO NOTHING;

-- Seed Org Members (Organization A)
INSERT INTO public.org_members (id, user_id, org_id, role)
VALUES 
    ('a0000001-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
    ('a0000002-0000-0000-0000-000000000002', 'a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'editor'),
    ('a0000003-0000-0000-0000-000000000003', 'a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'viewer')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Seed Org Members (Organization B)
INSERT INTO public.org_members (id, user_id, org_id, role)
VALUES 
    ('b0000001-0000-0000-0000-000000000001', 'b1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner'),
    ('b0000002-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'editor'),
    ('b0000003-0000-0000-0000-000000000003', 'b3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'viewer')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Seed a sample Multi-Tenant user (belongs to both orgs for verification)
INSERT INTO public.org_members (id, user_id, org_id, role)
VALUES
    ('ab000001-0000-0000-0000-000000000001', 'ab111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'editor'),
    ('ab000002-0000-0000-0000-000000000002', 'ab111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'viewer')
ON CONFLICT (user_id, org_id) DO NOTHING;
