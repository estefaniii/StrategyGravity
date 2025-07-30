"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, AlertCircle } from "lucide-react"

interface CalculatorFormProps {
  onCalculate: (income: number) => void
}

export function CalculatorForm({ onCalculate }: CalculatorFormProps) {
  const [income, setIncome] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const num = Number.parseFloat(income.replace(/,/g, ""))

    if (isNaN(num) || num < 0) {
      setError("Por favor ingrese un número válido mayor o igual a 0")
      setIsLoading(false)
      return
    }

    if (num > 10000000) {
      setError("El ingreso no puede ser mayor a $10,000,000")
      setIsLoading(false)
      return
    }

    setError("")

    // Simular un pequeño delay para mostrar el loading
    setTimeout(() => {
      onCalculate(num)
      setIsLoading(false)
    }, 500)
  }

  const formatNumber = (value: string) => {
    const num = value.replace(/,/g, "")
    if (isNaN(Number.parseFloat(num))) return value
    return Number.parseFloat(num).toLocaleString("en-US")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "")
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setIncome(value)
      setError("")
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Ingreso Anual
        </CardTitle>
        <CardDescription>Ingrese su ingreso anual bruto en dólares estadounidenses (USD)</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="income">Ingreso Anual (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="income"
                type="text"
                value={formatNumber(income)}
                onChange={handleInputChange}
                placeholder="0.00"
                className="pl-10 text-lg"
                disabled={isLoading}
              />
            </div>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-red-600 text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </div>

          <Button type="submit" className="w-full text-lg py-6" disabled={!income || isLoading}>
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              "Calcular Impuesto"
            )}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Tabla de Impuestos - Panamá</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <div>• Hasta $11,000: 0%</div>
            <div>• $11,000.01 - $50,000: 15% sobre el excedente</div>
            <div>• Más de $50,000: $5,850 + 25% sobre el excedente</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
