export interface TaxBracket {
  min: number
  max?: number
  rate: number
  fixedAmount?: number
}

export const PANAMA_TAX_BRACKETS: TaxBracket[] = [
  {
    min: 0,
    max: 11000,
    rate: 0,
  },
  {
    min: 11000,
    max: 50000,
    rate: 0.15,
  },
  {
    min: 50000,
    rate: 0.25,
    fixedAmount: 5850, // $5,850 fijo + 25% sobre excedente
  },
]
