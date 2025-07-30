-- Crear tabla para almacenar los cálculos de impuestos
CREATE TABLE IF NOT EXISTS tax_calculations (
  id SERIAL PRIMARY KEY,
  income DECIMAL(12, 2) NOT NULL,
  tax DECIMAL(12, 2) NOT NULL,
  calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para mejorar las consultas por fecha
CREATE INDEX IF NOT EXISTS idx_tax_calculations_date 
ON tax_calculations(calculation_date DESC);
