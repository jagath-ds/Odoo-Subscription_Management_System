import type {
  DiscountRule,
  Plan,
  Product,
  ProductVariant,
  ProductWithVariants,
  QuotationTemplate,
  QuotationTemplateDetail,
  QuotationTemplateLine,
  TaxRule,
} from '@/types/contracts'
import type {
  DiscountRuleInput,
  PlanInput,
  ProductInput,
  ProductVariantInput,
  QuotationTemplateInput,
  TaxRuleInput,
} from '@/services/types'
import {
  SEED_DISCOUNT_RULES,
  SEED_PLANS,
  SEED_PRODUCTS,
  SEED_QUOTATION_TEMPLATE_LINES,
  SEED_QUOTATION_TEMPLATES,
  SEED_TAX_RULES,
  SEED_VARIANTS,
} from './catalog.fixtures'

/**
 * In-memory catalog store. The mock adapter validates every payload before
 * calling these helpers, so the functions here only mutate state.
 */

let products: Product[] = SEED_PRODUCTS.map((product) => ({ ...product }))
let variants: ProductVariant[] = SEED_VARIANTS.map((variant) => ({ ...variant }))
let plans: Plan[] = SEED_PLANS.map((plan) => ({ ...plan }))
let taxRules: TaxRule[] = SEED_TAX_RULES.map((rule) => ({ ...rule }))
let discountRules: DiscountRule[] = SEED_DISCOUNT_RULES.map((rule) => ({ ...rule }))
let templates: QuotationTemplate[] = SEED_QUOTATION_TEMPLATES.map((template) => ({ ...template }))
let templateLines: QuotationTemplateLine[] = SEED_QUOTATION_TEMPLATE_LINES.map((line) => ({
  ...line,
}))

let nextProductId = 100
let nextVariantId = 100
let nextPlanId = 100
let nextTaxRuleId = 100
let nextDiscountRuleId = 100
let nextTemplateId = 100
let nextTemplateLineId = 100

export function resetCatalogDb(): void {
  products = SEED_PRODUCTS.map((product) => ({ ...product }))
  variants = SEED_VARIANTS.map((variant) => ({ ...variant }))
  plans = SEED_PLANS.map((plan) => ({ ...plan }))
  taxRules = SEED_TAX_RULES.map((rule) => ({ ...rule }))
  discountRules = SEED_DISCOUNT_RULES.map((rule) => ({ ...rule }))
  templates = SEED_QUOTATION_TEMPLATES.map((template) => ({ ...template }))
  templateLines = SEED_QUOTATION_TEMPLATE_LINES.map((line) => ({ ...line }))
  nextProductId = 100
  nextVariantId = 100
  nextPlanId = 100
  nextTaxRuleId = 100
  nextDiscountRuleId = 100
  nextTemplateId = 100
  nextTemplateLineId = 100
}

/* ------------------------------------------------------------------ */
/* Products & variants                                                 */
/* ------------------------------------------------------------------ */

export function listProducts(): ProductWithVariants[] {
  return products.map((product) => ({
    ...product,
    variants: variants
      .filter((variant) => variant.product_id === product.id)
      .map((variant) => ({ ...variant })),
  }))
}

export function getProduct(id: number): ProductWithVariants | undefined {
  return listProducts().find((product) => product.id === id)
}

export function insertProduct(input: ProductInput): Product {
  const product: Product = { id: nextProductId++, ...input }
  products = [...products, product]
  return { ...product }
}

export function updateProduct(id: number, input: ProductInput): Product | undefined {
  const existing = products.find((product) => product.id === id)
  if (!existing) return undefined
  const updated: Product = { ...existing, ...input, id }
  products = products.map((product) => (product.id === id ? updated : product))
  return { ...updated }
}

export function deleteProduct(id: number): boolean {
  const exists = products.some((product) => product.id === id)
  if (!exists) return false
  products = products.filter((product) => product.id !== id)
  variants = variants.filter((variant) => variant.product_id !== id)
  return true
}

export function insertVariant(productId: number, input: ProductVariantInput): ProductVariant {
  const variant: ProductVariant = { id: nextVariantId++, product_id: productId, ...input }
  variants = [...variants, variant]
  return { ...variant }
}

export function updateVariant(
  id: number,
  input: ProductVariantInput,
): ProductVariant | undefined {
  const existing = variants.find((variant) => variant.id === id)
  if (!existing) return undefined
  const updated: ProductVariant = { ...existing, ...input, id }
  variants = variants.map((variant) => (variant.id === id ? updated : variant))
  return { ...updated }
}

export function deleteVariant(id: number): boolean {
  const exists = variants.some((variant) => variant.id === id)
  if (!exists) return false
  variants = variants.filter((variant) => variant.id !== id)
  return true
}

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

export function listPlans(): Plan[] {
  return plans.map((plan) => ({ ...plan }))
}

export function insertPlan(input: PlanInput): Plan {
  const plan: Plan = { id: nextPlanId++, ...input }
  plans = [...plans, plan]
  return { ...plan }
}

export function updatePlan(id: number, input: PlanInput): Plan | undefined {
  const existing = plans.find((plan) => plan.id === id)
  if (!existing) return undefined
  const updated: Plan = { ...existing, ...input, id }
  plans = plans.map((plan) => (plan.id === id ? updated : plan))
  return { ...updated }
}

export function deletePlan(id: number): boolean {
  const exists = plans.some((plan) => plan.id === id)
  if (!exists) return false
  plans = plans.filter((plan) => plan.id !== id)
  return true
}

/* ------------------------------------------------------------------ */
/* Tax rules                                                           */
/* ------------------------------------------------------------------ */

export function listTaxRules(): TaxRule[] {
  return taxRules.map((rule) => ({ ...rule }))
}

export function insertTaxRule(input: TaxRuleInput): TaxRule {
  const rule: TaxRule = { id: nextTaxRuleId++, ...input }
  taxRules = [...taxRules, rule]
  return { ...rule }
}

export function updateTaxRule(id: number, input: TaxRuleInput): TaxRule | undefined {
  const existing = taxRules.find((rule) => rule.id === id)
  if (!existing) return undefined
  const updated: TaxRule = { ...existing, ...input, id }
  taxRules = taxRules.map((rule) => (rule.id === id ? updated : rule))
  return { ...updated }
}

export function deleteTaxRule(id: number): boolean {
  const exists = taxRules.some((rule) => rule.id === id)
  if (!exists) return false
  taxRules = taxRules.filter((rule) => rule.id !== id)
  return true
}

/* ------------------------------------------------------------------ */
/* Discount rules                                                      */
/* ------------------------------------------------------------------ */

export function listDiscountRules(): DiscountRule[] {
  return discountRules.map((rule) => ({ ...rule }))
}

export function insertDiscountRule(input: DiscountRuleInput): DiscountRule {
  const rule: DiscountRule = { id: nextDiscountRuleId++, ...input, current_uses: 0 }
  discountRules = [...discountRules, rule]
  return { ...rule }
}

export function updateDiscountRule(
  id: number,
  input: DiscountRuleInput,
): DiscountRule | undefined {
  const existing = discountRules.find((rule) => rule.id === id)
  if (!existing) return undefined
  const updated: DiscountRule = { ...existing, ...input, id }
  discountRules = discountRules.map((rule) => (rule.id === id ? updated : rule))
  return { ...updated }
}

export function deleteDiscountRule(id: number): boolean {
  const exists = discountRules.some((rule) => rule.id === id)
  if (!exists) return false
  discountRules = discountRules.filter((rule) => rule.id !== id)
  return true
}

/* ------------------------------------------------------------------ */
/* Quotation templates                                                 */
/* ------------------------------------------------------------------ */

export function listQuotationTemplates(): QuotationTemplateDetail[] {
  return templates.map((template) => {
    const plan = plans.find((candidate) => candidate.id === template.plan_id)
    return {
      ...template,
      plan_name: plan?.name ?? 'Unknown plan',
      lines: templateLines
        .filter((line) => line.template_id === template.id)
        .map((line) => {
          const product = products.find((candidate) => candidate.id === line.product_id)
          const variant =
            line.variant_id === null
              ? undefined
              : variants.find((candidate) => candidate.id === line.variant_id)
          return {
            ...line,
            product_name: product?.name ?? 'Unknown product',
            variant_name: variant
              ? `${variant.attribute_name}: ${variant.attribute_value}`
              : null,
          }
        }),
    }
  })
}

export function insertQuotationTemplate(input: QuotationTemplateInput): QuotationTemplate {
  const template: QuotationTemplate = {
    id: nextTemplateId++,
    name: input.name,
    plan_id: input.plan_id,
    validity_days: input.validity_days,
  }
  const lines: QuotationTemplateLine[] = input.lines.map((line) => ({
    id: nextTemplateLineId++,
    template_id: template.id,
    ...line,
  }))
  templates = [...templates, template]
  templateLines = [...templateLines, ...lines]
  return { ...template }
}

export function updateQuotationTemplate(
  id: number,
  input: QuotationTemplateInput,
): QuotationTemplate | undefined {
  const existing = templates.find((template) => template.id === id)
  if (!existing) return undefined
  const updated: QuotationTemplate = {
    ...existing,
    name: input.name,
    plan_id: input.plan_id,
    validity_days: input.validity_days,
    id,
  }
  const lines: QuotationTemplateLine[] = input.lines.map((line) => ({
    id: nextTemplateLineId++,
    template_id: id,
    ...line,
  }))
  templates = templates.map((template) => (template.id === id ? updated : template))
  templateLines = [...templateLines.filter((line) => line.template_id !== id), ...lines]
  return { ...updated }
}

export function deleteQuotationTemplate(id: number): boolean {
  const exists = templates.some((template) => template.id === id)
  if (!exists) return false
  templates = templates.filter((template) => template.id !== id)
  templateLines = templateLines.filter((line) => line.template_id !== id)
  return true
}

export function templateUsageForProduct(productId: number): number {
  return templateLines.filter((line) => line.product_id === productId).length
}

export function templateUsageForPlan(planId: number): number {
  return templates.filter((template) => template.plan_id === planId).length
}
