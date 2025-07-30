"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { CalculatorForm } from "@/components/CalculatorForm"
import { ResultDisplay } from "@/components/ResultDisplay"
import { HistoryList } from "@/components/HistoryList"
import { calculateTax } from "@/lib/taxCalculations"
import { Calculator, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatabaseStatus } from "@/components/DatabaseStatus"

export default function Home() {
  const [result, setResult] = useState<any>(null)
  const [refreshHistory, setRefreshHistory] = useState(0)

  const handleCalculate = async (income: number) => {
    const taxResult = calculateTax(income)
    setResult(taxResult)

    // Guardar en la base de datos (con manejo de errores)
    try {
      const response = await fetch("/api/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          income,
          tax: taxResult.totalTax,
        }),
      })

      if (response.ok) {
        // Refresh history only if save was successful
        setRefreshHistory((prev) => prev + 1)
      } else {
        console.warn("Could not save calculation to history")
      }
    } catch (error) {
      console.warn("History feature unavailable:", error)
      // App continues to work without history
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Calculator className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Calculadora de Impuestos</h1>
          </div>
          <p className="text-lg text-gray-600">República de Panamá - Impuesto sobre la Renta Personal</p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="calculator" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="calculator" className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Calculadora
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Historial
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calculator">
              <div className="grid md:grid-cols-2 gap-8">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                  <CalculatorForm onCalculate={handleCalculate} />
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                  {result && <ResultDisplay result={result} />}
                </motion.div>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <HistoryList key={refreshHistory} />
            </TabsContent>
          </Tabs>
        </div>
        <DatabaseStatus />
      </div>
    </div>
  )
}
