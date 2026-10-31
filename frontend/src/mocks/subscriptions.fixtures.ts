import type { Subscription, SubscriptionLine } from '@/types/contracts'

export interface CustomerUser {
  id: number
  full_name: string
  email: string
  company: string
}

export const SEED_CUSTOMERS: CustomerUser[] = [
  { id: 3, full_name: 'Priya Nair', email: 'customer@brightloop.in', company: 'Nair Technologies' },
  { id: 10, full_name: 'Vikram Joshi', email: 'vikram@meridianlabs.in', company: 'Meridian Labs' },
  { id: 11, full_name: 'Deepa Shah', email: 'deepa@novaretail.com', company: 'Nova Retail' },
  { id: 12, full_name: 'Rohit Verma', email: 'rohit@zenithlogistics.in', company: 'Zenith Logistics' },
  { id: 13, full_name: 'Sunil Kapoor', email: 'sunil@nexuscorp.io', company: 'Nexus Corp' },
  { id: 14, full_name: 'Meera Iyer', email: 'meera@apexhealth.org', company: 'Apex Health' },
  { id: 15, full_name: 'Arjun Das', email: 'arjun@solarissys.in', company: 'Solaris Systems' },
]

export const SEED_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 1,
    sub_number: 'SUB-2026-0001',
    customer_id: 10,
    plan_id: 2, // Growth Monthly
    discount_id: 1, // 10% Off 10+ Seats
    status: 'ACTIVE',
    start_date: '2026-08-01',
    next_billing_date: '2026-11-01',
    expiry_date: '2027-08-01',
    paused_at: null,
    payment_terms_days: 15,
  },
  {
    id: 2,
    sub_number: 'SUB-2026-0002',
    customer_id: 11,
    plan_id: 3, // Business Annual (can_close_early: false, can_pause: false)
    discount_id: 1,
    status: 'ACTIVE',
    start_date: '2026-01-15',
    next_billing_date: '2027-01-15',
    expiry_date: '2027-01-15',
    paused_at: null,
    payment_terms_days: 30,
  },
  {
    id: 3,
    sub_number: 'SUB-2026-0003',
    customer_id: 12,
    plan_id: 1, // Starter Monthly (can_pause: true)
    discount_id: null,
    status: 'PAUSED',
    start_date: '2026-05-10',
    next_billing_date: '2026-11-10',
    expiry_date: '2027-05-10',
    paused_at: '2026-10-21', // 10 days before DEMO_TODAY 2026-10-31
    payment_terms_days: 15,
  },
  {
    id: 4,
    sub_number: 'SUB-2026-0004',
    customer_id: 13,
    plan_id: 6, // Enterprise Custom
    discount_id: null,
    status: 'CONFIRMED',
    start_date: '2026-11-01',
    next_billing_date: '2026-11-01',
    expiry_date: '2027-11-01',
    paused_at: null,
    payment_terms_days: 30,
  },
  {
    id: 5,
    sub_number: 'SUB-2026-0005',
    customer_id: 14,
    plan_id: 1, // Starter Monthly
    discount_id: null,
    status: 'DRAFT',
    start_date: '2026-11-05',
    next_billing_date: '2026-11-05',
    expiry_date: '2027-11-05',
    paused_at: null,
    payment_terms_days: 15,
  },
  {
    id: 6,
    sub_number: 'SUB-2026-0006',
    customer_id: 15,
    plan_id: 4, // Daily Trial (auto_close: true)
    discount_id: null,
    status: 'CLOSED',
    start_date: '2026-10-01',
    next_billing_date: '2026-10-15',
    expiry_date: '2026-10-15',
    paused_at: null,
    payment_terms_days: 7,
  },
  {
    id: 7,
    sub_number: 'SUB-2026-0007',
    customer_id: 3, // Priya Nair (Demo Customer)
    plan_id: 2, // Growth Monthly
    discount_id: null,
    status: 'ACTIVE',
    start_date: '2026-03-02',
    next_billing_date: '2026-11-02',
    expiry_date: '2027-03-02',
    paused_at: null,
    payment_terms_days: 15,
  },
  {
    id: 8,
    sub_number: 'SUB-2026-0008',
    customer_id: 3, // Priya Nair (Demo Customer)
    plan_id: 5, // Weekly Sprint
    discount_id: null,
    status: 'CONFIRMED',
    start_date: '2026-10-25',
    next_billing_date: '2026-11-01',
    expiry_date: '2026-12-25',
    paused_at: null,
    payment_terms_days: 7,
  },
]

export const SEED_SUBSCRIPTION_LINES: SubscriptionLine[] = [
  // SUB 1 - Meridian Labs
  {
    id: 1,
    subscription_id: 1,
    product_id: 1, // Core Platform
    variant_id: null,
    tax_id: 1, // GST 18%
    discount_id: 1,
    quantity: 10,
    unit_price: 4500,
  },
  {
    id: 2,
    subscription_id: 1,
    product_id: 3, // WhatsApp Notification Pack
    variant_id: 5, // 10k messages (+2400)
    tax_id: 1,
    discount_id: null,
    quantity: 2,
    unit_price: 3600,
  },

  // SUB 2 - Nova Retail (Business Annual - Early Close: false)
  {
    id: 3,
    subscription_id: 2,
    product_id: 2, // Odoo ERP License
    variant_id: 2, // Enterprise (+560)
    tax_id: 1,
    discount_id: 1,
    quantity: 12,
    unit_price: 9060,
  },
  {
    id: 4,
    subscription_id: 2,
    product_id: 4, // Priority Support
    variant_id: null,
    tax_id: 1,
    discount_id: null,
    quantity: 1,
    unit_price: 2400,
  },

  // SUB 3 - Zenith Logistics (Paused)
  {
    id: 5,
    subscription_id: 3,
    product_id: 1,
    variant_id: null,
    tax_id: 1,
    discount_id: null,
    quantity: 3,
    unit_price: 4500,
  },

  // SUB 4 - Nexus Corp (Confirmed)
  {
    id: 6,
    subscription_id: 4,
    product_id: 2,
    variant_id: 2,
    tax_id: 1,
    discount_id: null,
    quantity: 15,
    unit_price: 9060,
  },

  // SUB 5 - Apex Health (Draft)
  {
    id: 7,
    subscription_id: 5,
    product_id: 1,
    variant_id: null,
    tax_id: 1,
    discount_id: null,
    quantity: 2,
    unit_price: 4500,
  },

  // SUB 6 - Solaris Systems (Closed)
  {
    id: 8,
    subscription_id: 6,
    product_id: 1,
    variant_id: null,
    tax_id: 1,
    discount_id: null,
    quantity: 1,
    unit_price: 4500,
  },

  // SUB 7 - Priya Nair (Active)
  {
    id: 9,
    subscription_id: 7,
    product_id: 1,
    variant_id: null,
    tax_id: 1,
    discount_id: null,
    quantity: 5,
    unit_price: 4500,
  },
  {
    id: 10,
    subscription_id: 7,
    product_id: 4,
    variant_id: null,
    tax_id: 1,
    discount_id: null,
    quantity: 1,
    unit_price: 2400,
  },

  // SUB 8 - Priya Nair (Confirmed)
  {
    id: 11,
    subscription_id: 8,
    product_id: 3,
    variant_id: 4,
    tax_id: 1,
    discount_id: null,
    quantity: 1,
    unit_price: 1200,
  },
]
