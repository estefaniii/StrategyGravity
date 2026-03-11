import * as readline from "readline";

let rl: readline.Interface | null = null;

function getInterface(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

export function askUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const iface = getInterface();
    iface.question(`\n  > ${question}\n  >> `, (answer) => {
      resolve(answer.trim());
    });
  });
}

export function getUserInput(prompt = "Tu"): Promise<string> {
  return new Promise((resolve) => {
    const iface = getInterface();
    iface.question(`\n${prompt} > `, (answer) => {
      resolve(answer.trim());
    });
  });
}

export function closeChat(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}
