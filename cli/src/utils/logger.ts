import chalk from "chalk";

export class Logger {
  info(message: string): void {
    console.log(chalk.cyan(message));
  }

  success(message: string): void {
    console.log(chalk.green(message));
  }

  warn(message: string): void {
    console.warn(chalk.yellow(message));
  }

  error(message: string, error?: unknown): void {
    console.error(chalk.red(message));
    if (error instanceof Error && error.stack) {
      console.error(chalk.dim(error.stack));
    } else if (error) {
      console.error(chalk.dim(String(error)));
    }
  }
}

export const logger = new Logger();
