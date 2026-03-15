ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS requested_service_date DATE,
ADD COLUMN IF NOT EXISTS prayer_text TEXT,
ADD COLUMN IF NOT EXISTS service_request_prompt_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS service_request_completed_at TIMESTAMPTZ;
