"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History, Trash2, Calendar, DollarSign, RefreshCw } from "lucide-react"

interface Calculation {
  id: string
  income: number
  tax: number
  calculation_date: string
}

export function HistoryList() {
  const [history, setHistory] = useState<Calculation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/history")
      if (response.ok) {
        const data = await response.json()
        setHistory(Array.isArray(data) ? data : [])
      } else {
        console.warn("Could not fetch history")
        setHistory([])
      }
    } catch (error) {
      console.warn("History feature unavailable:", error)
      setHistory([])
      setError("No se pudo cargar el historial. La aplicación funciona en modo temporal.")
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = async () => {
    try {
      const response = await fetch("/api/history", {
        method: "DELETE",
      })
      if (response.ok) {
        setHistory([])
        setError(null)
      } else {
        console.warn("Could not clear history")
        setError("No se pudo limpiar el historial.")
      }
    } catch (error) {
      console.warn("Could not clear history:", error)
      setError("No se pudo limpiar el historial.")
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("es-PA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Fecha inválida"
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Historial de Cálculos
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              className="text-blue-600 hover:text-blue-700 bg-transparent"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearHistory}
                className="text-red-600 hover:text-red-700 bg-transparent"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            {error}
          </div>
        )}

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay cálculos guardados aún</p>
            <p className="text-sm">Los cálculos aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-medium">Ingreso: {formatCurrency(item.income)}</span>
                    </div>
                    <div className="text-red-600 font-semibold">Impuesto: {formatCurrency(item.tax)}</div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {formatDate(item.calculation_date)}
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  Tasa efectiva: {item.income > 0 ? ((item.tax / item.income) * 100).toFixed(2) : "0.00"}%
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
