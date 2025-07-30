"use client"

import { useEffect, useState } from "react"
import { Database, DatabaseZap, AlertCircle } from "lucide-react"

interface DatabaseHealth {
  status: "connected" | "demo_mode" | "disconnected"
  message?: string
  database?: string
}

export function DatabaseStatus() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch("/api/health")
        const data = await response.json()
        setHealth(data)

        // Auto-hide after 5 seconds if connected
        if (data.status === "connected") {
          setTimeout(() => setIsVisible(false), 5000)
        }
      } catch {
        setHealth({
          status: "disconnected",
          message: "Could not check database status",
        })
      }
    }

    checkConnection()
  }, [])

  if (!health || !isVisible) return null

  const getStatusConfig = () => {
    switch (health.status) {
      case "connected":
        return {
          icon: <DatabaseZap className="w-4 h-4" />,
          text: "Base de datos conectada",
          className: "bg-green-100 text-green-800 border border-green-200",
        }
      case "demo_mode":
        return {
          icon: <Database className="w-4 h-4" />,
          text: "Modo demo (sin persistencia)",
          className: "bg-blue-100 text-blue-800 border border-blue-200",
        }
      case "disconnected":
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: "Modo temporal",
          className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg cursor-pointer transition-opacity hover:opacity-80 ${config.className}`}
        onClick={() => setIsVisible(false)}
        title={health.message || "Click to hide"}
      >
        {config.icon}
        {config.text}
      </div>
    </div>
  )
}
