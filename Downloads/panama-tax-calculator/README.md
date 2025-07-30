# 🧮 Calculadora de Impuestos - Panamá

Una aplicación web moderna y responsiva para calcular el impuesto sobre la renta personal en Panamá, desarrollada con Next.js 14, TypeScript, Tailwind CSS y PostgreSQL.

## ✨ Características

- **Cálculo preciso** basado en la tabla oficial de la DGI Panamá
- **Interfaz moderna** con animaciones suaves usando Framer Motion
- **Totalmente responsiva** - funciona en móviles, tablets y escritorio
- **Desglose detallado** por tramos fiscales
- **Historial de cálculos** con persistencia en PostgreSQL
- **Validaciones robustas** con mensajes de error amigables
- **Diseño atractivo** con gradientes y componentes modernos

## 🏗️ Tecnologías Utilizadas

- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Animaciones**: Framer Motion
- **Base de datos**: PostgreSQL (Neon)
- **Componentes**: shadcn/ui + Radix UI
- **Iconos**: Lucide React
- **Deploy**: Vercel

## 📊 Tabla de Impuestos (Panamá)

| Ingreso Anual (USD) | Tasa de Impuesto |
|---------------------|------------------|
| Hasta $11,000 | 0% |
| $11,000.01 – $50,000 | 15% sobre el excedente de $11,000 |
| Más de $50,000 | $5,850 + 25% sobre el excedente de $50,000 |

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Cuenta en Neon (para PostgreSQL)

### Pasos de instalación

1. **Clonar el repositorio**
   \`\`\`bash
   git clone https://github.com/tu-usuario/panama-tax-calculator.git
   cd panama-tax-calculator
   \`\`\`

2. **Instalar dependencias**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configurar variables de entorno**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`
   
   Edita \`.env.local\` y agrega tu URL de conexión a Neon:
   \`\`\`
   POSTGRES_URL="tu-connection-string-de-neon"
   \`\`\`

4. **Crear las tablas en la base de datos**
   
   Ejecuta el script SQL en tu consola de Neon o usando el cliente de PostgreSQL:
   \`\`\`sql
   CREATE TABLE IF NOT EXISTS tax_calculations (
     id SERIAL PRIMARY KEY,
     income DECIMAL(12, 2) NOT NULL,
     tax DECIMAL(12, 2) NOT NULL,
     calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   \`\`\`

5. **Ejecutar en desarrollo**
   \`\`\`bash
   npm run dev
   \`\`\`

6. **Abrir en el navegador**
   
   Visita [http://localhost:3000](http://localhost:3000)

## 📱 Funcionalidades

### Calculadora Principal
- Ingreso de salario anual con formato de moneda
- Validación en tiempo real
- Cálculo instantáneo con animaciones
- Desglose visual por tramos fiscales

### Resultados Detallados
- Impuesto total a pagar
- Tasa efectiva de impuestos
- Ingreso neto después de impuestos
- Contribución de cada tramo fiscal

### Historial
- Almacenamiento automático de cálculos
- Visualización de cálculos anteriores
- Opción para limpiar historial
- Ordenado por fecha (más reciente primero)

## 🎨 Diseño Responsivo

La aplicación está optimizada para:

- **📱 Móviles**: Layout vertical, componentes apilados
- **📱 Tablets**: Grid adaptativo, mejor uso del espacio
- **💻 Escritorio**: Layout de dos columnas, máximo aprovechamiento

## 🔧 Estructura del Proyecto

\`\`\`
panama-tax-calculator/
├── app/
│   ├── api/history/          # API routes para historial
│   ├── globals.css           # Estilos globales
│   ├── layout.tsx            # Layout principal
│   └── page.tsx              # Página principal
├── components/
│   ├── ui/                   # Componentes base (shadcn/ui)
│   ├── CalculatorForm.tsx    # Formulario de ingreso
│   ├── ResultDisplay.tsx     # Mostrar resultados
│   ├── TaxBrackets.tsx       # Desglose por tramos
│   └── HistoryList.tsx       # Lista de historial
├── constants/
│   └── taxBrackets.ts        # Tabla de impuestos
├── lib/
│   └── taxCalculations.ts    # Lógica de cálculo
└── scripts/
    └── create-tables.sql     # Script de base de datos
\`\`\`

## 🧪 Testing

Para probar la aplicación:

1. **Casos de prueba sugeridos:**
   - Ingreso: $0 → Impuesto: $0
   - Ingreso: $10,000 → Impuesto: $0
   - Ingreso: $25,000 → Impuesto: $2,100
   - Ingreso: $75,000 → Impuesto: $12,100

2. **Validaciones a probar:**
   - Números negativos
   - Texto en lugar de números
   - Números muy grandes
   - Campos vacíos

## 🚀 Deploy en Vercel

1. **Conectar repositorio**
   - Importa el proyecto desde GitHub en Vercel

2. **Configurar variables de entorno**
   - Agrega \`POSTGRES_URL\` en la configuración de Vercel

3. **Deploy automático**
   - Vercel detectará Next.js y hará el build automáticamente

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (\`git checkout -b feature/AmazingFeature\`)
3. Commit tus cambios (\`git commit -m 'Add some AmazingFeature'\`)
4. Push a la rama (\`git push origin feature/AmazingFeature\`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo \`LICENSE\` para más detalles.

## 👨‍💻 Autor

Desarrollado como prueba técnica para demostrar habilidades en:
- Next.js y React
- TypeScript
- Tailwind CSS
- PostgreSQL
- Diseño responsivo
- Animaciones web

---

**¿Preguntas o sugerencias?** Abre un issue en GitHub o contacta al desarrollador.
