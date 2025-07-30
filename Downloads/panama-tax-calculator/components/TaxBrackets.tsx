"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BarChart3 } from "lucide-react"

interface TaxBracketsProps {
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
}

export function TaxBrackets({ breakdown }: TaxBracketsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(0)}%`
  }

  const getBracketDescription = (bracket: any) => {
    if (bracket.max) {
      return `${formatCurrency(bracket.min)} - ${formatCurrency(bracket.max)}`
    }
    return `Más de ${formatCurrency(bracket.min)}`
  }

  const totalTax = breakdown.reduce((sum, item) => sum + item.tax, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Desglose por Tramos Fiscales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.map((item, index) => {
          if (item.taxableAmount === 0) return null

          const percentage = totalTax > 0 ? (item.tax / totalTax) * 100 : 0

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 border rounded-lg bg-gray-50"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold text-gray-800">
                    Tramo {index + 1}: {getBracketDescription(item.bracket)}
                  </div>
                  <div className="text-sm text-gray-600">Tasa: {formatPercentage(item.bracket.rate)}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-red-600">{formatCurrency(item.tax)}</div>
                  <div className="text-sm text-gray-600">sobre {formatCurrency(item.taxableAmount)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Contribución al total</span>
                  <span>{percentage.toFixed(1)}%</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            </motion.div>
          )
        })}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: breakdown.length * 0.1 }}
          className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200"
        >
          <div className="flex justify-between items-center">
            <span className="font-semibold text-blue-800">Total a Pagar:</span>
            <span className="text-xl font-bold text-blue-600">{formatCurrency(totalTax)}</span>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  )
}
