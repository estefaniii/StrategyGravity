#!/usr/bin/env node

import chalk from "chalk";
import { initDatabase, closeDatabase } from "./core/memory.js";
import { processInput, loadCurrentStrategy } from "./core/agent-loop.js";
import { getUserInput, closeChat } from "./core/chat.js";
import { listAvailableProviders } from "./llm/index.js";

const BANNER = `
${chalk.bold.magenta("  ╔═══════════════════════════════════════════════════╗")}
${chalk.bold.magenta("  ║")}${chalk.bold.white("        StrategyGravity v1.0                       ")}${chalk.bold.magenta("║")}
${chalk.bold.magenta("  ║")}${chalk.dim("        AI Marketing Strategy Agent                 ")}${chalk.bold.magenta("║")}
${chalk.bold.magenta("  ╚═══════════════════════════════════════════════════╝")}
`;

async function main() {
  console.clear();
  console.log(BANNER);

  // Initialize database
  try {
    initDatabase();
    console.log(chalk.green("  Base de datos inicializada."));
  } catch (err) {
    console.error(chalk.red(`  Error al inicializar base de datos: ${(err as Error).message}`));
    process.exit(1);
  }

  // Show available providers
  const providers = listAvailableProviders();
  console.log(chalk.cyan(`  LLMs disponibles: ${providers.join(", ")}`));

  // Check for existing strategy
  const existingStrategy = loadCurrentStrategy();
  if (existingStrategy) {
    console.log(chalk.yellow(`  Estrategia activa: "${existingStrategy.companyName}" (ID: ${existingStrategy.id})`));
  } else {
    console.log(chalk.dim("  No hay estrategia cargada. Proporciona una URL, @instagram, o descripcion para comenzar."));
  }

  console.log(chalk.dim("  Escribe 'ayuda' para ver los comandos disponibles.\n"));

  // Main loop
  let running = true;
  while (running) {
    try {
      const input = await getUserInput(chalk.bold.white("Tu"));

      if (!input) continue;

      const response = await processInput(input);

      if (response === "__EXIT__") {
        console.log(chalk.magenta("\n  Hasta luego. Tu estrategia esta guardada.\n"));
        running = false;
        continue;
      }

      console.log(chalk.white(`\n${response}\n`));
    } catch (err) {
      const error = err as Error;
      if (error.message?.includes("readline was closed")) {
        running = false;
      } else {
        console.error(chalk.red(`\n  Error: ${error.message}\n`));
      }
    }
  }

  // Cleanup
  closeChat();
  closeDatabase();
  process.exit(0);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.magenta("\n\n  Cerrando StrategyGravity...\n"));
  closeChat();
  closeDatabase();
  process.exit(0);
});

process.on("unhandledRejection", (err) => {
  console.error(chalk.red(`\n  Error no manejado: ${err}\n`));
});

main().catch((err) => {
  console.error(chalk.red(`Fatal: ${err.message}`));
  process.exit(1);
});
