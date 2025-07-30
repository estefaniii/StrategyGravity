"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TaxBrackets } from "./TaxBrackets"
import { Receipt, TrendingUp, Percent } from "lucide-react"

interface ResultDisplayProps {
  result: {
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
}

export function ResultDisplay({ result }: ResultDisplayProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Resumen Principal */}
      <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Receipt className="w-5 h-5" />
            Resultado del Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center p-4 bg-white rounded-lg shadow-sm"
            >
              <div className="text-sm text-gray-600 mb-1">Ingreso Anual</div>
              <div className="text-2xl font-bold text-gray-800">{formatCurrency(result.income)}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center p-4 bg-red-50 rounded-lg shadow-sm"
            >
              <div className="text-sm text-red-600 mb-1 flex items-center justify-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Impuesto a Pagar
              </div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(result.totalTax)}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center p-4 bg-green-50 rounded-lg shadow-sm"
            >
              <div className="text-sm text-green-600 mb-1">Ingreso Neto</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(result.afterTaxIncome)}</div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-lg"
          >
            <Percent className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800">
              Tasa Efectiva: <strong>{formatPercentage(result.effectiveRate)}</strong>
            </span>
          </motion.div>
        </CardContent>
      </Card>

      {/* Desglose por Tramos */}
      <TaxBrackets breakdown={result.breakdown} />
    </motion.div>
  )
}
