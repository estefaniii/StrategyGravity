import { PANAMA_TAX_BRACKETS } from "@/constants/taxBrackets"

export interface TaxCalculationResult {
  totalTax: number
  effectiveRate: number
  afterTaxIncome: number
  breakdown: Array<{
    bracket: {
      min: number
      max?: number
      rate: number
      fixedAmount?: number
    }
    taxableAmount: number
    tax: number
  }>
  income: number
}

export function calculateTax(annualIncome: number): TaxCalculationResult {
  let totalTax = 0
  let remainingIncome = annualIncome
  const breakdown = []

  for (const bracket of PANAMA_TAX_BRACKETS) {
    if (remainingIncome <= 0) break

    let taxableAmount = 0
    let tax = 0

    if (bracket.max) {
      // Tramo con límite superior
      const bracketRange = bracket.max - bracket.min
      taxableAmount = Math.min(remainingIncome, bracketRange)
    } else {
      // Último tramo (sin límite superior)
      taxableAmount = remainingIncome
    }

    if (taxableAmount > 0) {
      if (bracket.fixedAmount) {
        // Para el tramo más alto: cantidad fija + porcentaje sobre excedente
        tax = bracket.fixedAmount + taxableAmount * bracket.rate
      } else {
        // Para tramos normales: porcentaje sobre el monto gravable
        tax = taxableAmount * bracket.rate
      }

      totalTax += tax
      remainingIncome -= taxableAmount

      breakdown.push({
        bracket,
        taxableAmount,
        tax,
      })
    }
  }

  const effectiveRate = annualIncome > 0 ? totalTax / annualIncome : 0
  const afterTaxIncome = annualIncome - totalTax

  return {
    totalTax,
    effectiveRate,
    afterTaxIncome,
    breakdown,
    income: annualIncome,
  }
}
