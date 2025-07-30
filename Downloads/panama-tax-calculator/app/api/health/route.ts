import { NextResponse } from "next/server"

export async function GET() {
  try {
    if (process.env.POSTGRES_URL) {
      const { sql } = await import("@vercel/postgres")

      // Try to create table and test connection
      await sql`
        CREATE TABLE IF NOT EXISTS tax_calculations (
          id SERIAL PRIMARY KEY,
          income DECIMAL(12, 2) NOT NULL,
          tax DECIMAL(12, 2) NOT NULL,
          calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `

      // Test with a simple query
      await sql`SELECT 1`

      return NextResponse.json({
        status: "connected",
        database: "postgresql",
        message: "Database connected and initialized",
      })
    } else {
      return NextResponse.json(
        {
          status: "demo_mode",
          message: "No database configured - using temporary storage",
        },
        { status: 200 },
      )
    }
  } catch (error) {
    console.error("Database health check failed:", error)
    return NextResponse.json(
      {
        status: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Database connection failed - using temporary storage",
      },
      { status: 200 },
    ) // Return 200 so app continues to work
  }
}
