-- AI Agent Creator Platform - Sample Seed Data
-- This file contains sample data for development and testing

-- Note: This seed data assumes you have created test users through Supabase Auth
-- The UUIDs below should be replaced with actual user IDs from your auth.users table

-- Sample agent configurations
-- Replace 'your-user-id-here' with actual user IDs from auth.users
INSERT INTO public.agents (id, user_id, name, description, personality_tone, personality_style, personality_instructions, response_time, max_conversation_length, escalation_triggers) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  'your-user-id-here', -- Replace with actual user ID
  'Customer Support Agent',
  'A helpful customer support agent for e-commerce inquiries',
  'professional',
  'Helpful and solution-oriented',
  'You are a professional customer support agent. Always be polite, helpful, and try to resolve customer issues efficiently. If you cannot help with something, offer to escalate to a human agent.',
  1500,
  30,
  ARRAY['speak to human', 'escalate', 'manager', 'complaint']
),
(
  '550e8400-e29b-41d4-a716-446655440002',
  'your-user-id-here', -- Replace with actual user ID
  'Sales Assistant',
  'A friendly sales assistant to help with product inquiries',
  'friendly',
  'Enthusiastic and knowledgeable',
  'You are a friendly sales assistant. Help customers find the right products, answer questions about features and pricing, and guide them through the purchase process.',
  1000,
  50,
  ARRAY['technical support', 'refund', 'return']
);

-- Sample knowledge base documents
INSERT INTO public.knowledge_base_documents (agent_id, title, content, file_type) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  'Return Policy',
  'Our return policy allows customers to return items within 30 days of purchase. Items must be in original condition with tags attached. Refunds are processed within 5-7 business days.',
  'text'
),
(
  '550e8400-e29b-41d4-a716-446655440001',
  'Shipping Information',
  'We offer free shipping on orders over $50. Standard shipping takes 3-5 business days. Express shipping is available for an additional fee and takes 1-2 business days.',
  'text'
),
(
  '550e8400-e29b-41d4-a716-446655440002',
  'Product Catalog',
  'We offer a wide range of products including electronics, clothing, home goods, and accessories. All products come with a manufacturer warranty.',
  'text'
);

-- Sample knowledge base FAQs
INSERT INTO public.knowledge_base_faqs (agent_id, question, answer) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  'How do I track my order?',
  'You can track your order by logging into your account and viewing the order status, or by using the tracking number sent to your email.'
),
(
  '550e8400-e29b-41d4-a716-446655440001',
  'What payment methods do you accept?',
  'We accept all major credit cards, PayPal, Apple Pay, and Google Pay.'
),
(
  '550e8400-e29b-41d4-a716-446655440002',
  'Do you offer bulk discounts?',
  'Yes, we offer bulk discounts for orders over 10 items. Please contact our sales team for pricing details.'
);

-- Sample widget configurations
INSERT INTO public.widget_configs (agent_id, theme, primary_color, position, size, auto_open, greeting, placeholder, voice_enabled, push_to_talk, company_name, show_powered_by) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  'light',
  '#007bff',
  'bottom-right',
  'medium',
  false,
  'Hi! I''m here to help with any questions about your order or our products.',
  'Ask me anything...',
  true,
  false,
  'Demo Store',
  true
),
(
  '550e8400-e29b-41d4-a716-446655440002',
  'dark',
  '#28a745',
  'bottom-left',
  'large',
  true,
  'Welcome! I''m your sales assistant. How can I help you find the perfect product today?',
  'What are you looking for?',
  true,
  true,
  'Demo Store',
  false
);

-- Sample SIP configurations (with placeholder encrypted passwords)
INSERT INTO public.sip_configs (agent_id, provider_host, provider_port, username, password_encrypted, realm, inbound_numbers, outbound_number, record_calls, max_call_duration, transfer_enabled, transfer_number) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  'sip.example.com',
  5060,
  'support_agent',
  'encrypted_password_placeholder', -- This should be properly encrypted in production
  'example.com',
  ARRAY['+1234567890', '+1234567891'],
  '+1234567892',
  true,
  1800,
  true,
  '+1234567893'
);

-- Sample conversation (for demonstration)
INSERT INTO public.conversations (id, agent_id, channel, status, context, metadata, started_at) VALUES
(
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440001',
  'widget',
  'ended',
  '{"user_intent": "order_inquiry", "order_id": "ORD-12345"}',
  '{"user_agent": "Mozilla/5.0", "ip_address": "192.168.1.1"}',
  NOW() - INTERVAL '1 hour'
);

-- Sample messages for the conversation
INSERT INTO public.messages (conversation_id, role, content, type, created_at) VALUES
(
  '660e8400-e29b-41d4-a716-446655440001',
  'user',
  'Hi, I need help with my order ORD-12345',
  'text',
  NOW() - INTERVAL '1 hour'
),
(
  '660e8400-e29b-41d4-a716-446655440001',
  'agent',
  'Hello! I''d be happy to help you with your order. Let me look up the details for order ORD-12345.',
  'text',
  NOW() - INTERVAL '59 minutes'
),
(
  '660e8400-e29b-41d4-a716-446655440001',
  'user',
  'When will it be delivered?',
  'text',
  NOW() - INTERVAL '58 minutes'
),
(
  '660e8400-e29b-41d4-a716-446655440001',
  'agent',
  'Your order is currently being processed and should be shipped within 1-2 business days. You''ll receive a tracking number via email once it ships.',
  'text',
  NOW() - INTERVAL '57 minutes'
);

-- Update conversation end time
UPDATE public.conversations 
SET ended_at = NOW() - INTERVAL '55 minutes', updated_at = NOW() - INTERVAL '55 minutes'
WHERE id = '660e8400-e29b-41d4-a716-446655440001';