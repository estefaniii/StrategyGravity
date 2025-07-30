import { NextResponse } from "next/server"

// Mock data for when database is not available
let mockHistory: Array<{
  id: string
  income: number
  tax: number
  calculation_date: string
}> = []

// Check if we have database connection
const hasDatabase = () => {
  return process.env.POSTGRES_URL && process.env.POSTGRES_URL.length > 0
}

// Initialize database table if it doesn't exist
const initializeDatabase = async () => {
  try {
    const { sql } = await import("@vercel/postgres")

    // Create table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS tax_calculations (
        id SERIAL PRIMARY KEY,
        income DECIMAL(12, 2) NOT NULL,
        tax DECIMAL(12, 2) NOT NULL,
        calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create index if it doesn't exist
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tax_calculations_date 
      ON tax_calculations(calculation_date DESC)
    `

    return true
  } catch (error) {
    console.error("Error initializing database:", error)
    return false
  }
}

// GET - Obtener historial
export async function GET() {
  try {
    if (hasDatabase()) {
      // Initialize database first
      const dbInitialized = await initializeDatabase()

      if (dbInitialized) {
        const { sql } = await import("@vercel/postgres")
        const { rows } = await sql`
          SELECT id, income, tax, calculation_date 
          FROM tax_calculations 
          ORDER BY calculation_date DESC 
          LIMIT 20
        `
        return NextResponse.json(rows)
      } else {
        // Fall back to mock data if DB initialization failed
        return NextResponse.json(mockHistory.slice(0, 20))
      }
    } else {
      // Use mock data when database is not available
      return NextResponse.json(mockHistory.slice(0, 20))
    }
  } catch (error) {
    console.error("Error fetching history:", error)
    // Fallback to mock data on any database error
    return NextResponse.json(mockHistory.slice(0, 20))
  }
}

// POST - Guardar nuevo cálculo
export async function POST(request: Request) {
  try {
    const { income, tax } = await request.json()

    if (hasDatabase()) {
      // Initialize database first
      const dbInitialized = await initializeDatabase()

      if (dbInitialized) {
        const { sql } = await import("@vercel/postgres")
        const { rows } = await sql`
          INSERT INTO tax_calculations (income, tax, calculation_date)
          VALUES (${income}, ${tax}, NOW())
          RETURNING id, income, tax, calculation_date
        `
        return NextResponse.json(rows[0], { status: 201 })
      } else {
        // Fall back to mock data if DB initialization failed
        const newCalculation = {
          id: Date.now().toString(),
          income: income, // Declare income variable
          tax: tax, // Declare tax variable
          calculation_date: new Date().toISOString(),
        }
        mockHistory.unshift(newCalculation)
        return NextResponse.json(newCalculation, { status: 201 })
      }
    } else {
      // Use mock data when database is not available
      const newCalculation = {
        id: Date.now().toString(),
        income: income, // Declare income variable
        tax: tax, // Declare tax variable
        calculation_date: new Date().toISOString(),
      }
      mockHistory.unshift(newCalculation)
      return NextResponse.json(newCalculation, { status: 201 })
    }
  } catch (error) {
    console.error("Error saving calculation:", error)
    // Fallback to mock data on any database error
    const newCalculation = {
      id: Date.now().toString(),
      income: income, // Declare income variable
      tax: tax, // Declare tax variable
      calculation_date: new Date().toISOString(),
    }
    mockHistory.unshift(newCalculation)
    return NextResponse.json(newCalculation, { status: 201 })
  }
}

// DELETE - Limpiar historial
export async function DELETE() {
  try {
    if (hasDatabase()) {
      // Initialize database first
      const dbInitialized = await initializeDatabase()

      if (dbInitialized) {
        const { sql } = await import("@vercel/postgres")
        await sql`DELETE FROM tax_calculations`
        return NextResponse.json({ message: "History cleared" })
      } else {
        // Clear mock data if DB initialization failed
        mockHistory = []
        return NextResponse.json({ message: "History cleared" })
      }
    } else {
      // Clear mock data when database is not available
      mockHistory = []
      return NextResponse.json({ message: "History cleared" })
    }
  } catch (error) {
    console.error("Error clearing history:", error)
    // Fallback to clearing mock data
    mockHistory = []
    return NextResponse.json({ message: "History cleared" })
  }
}
