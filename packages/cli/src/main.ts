#!/usr/bin/env -S npx tsx
import { parseArgs } from "node:util";
import { runCommand, suggestCommand } from "./commands";

const USAGE = `Usage:
  dedupe suggest --input contacts.csv --out config.json [--entity person|company]
  dedupe run     --input contacts.csv --config config.json --out clean.csv [--report report.json]

CSV files need the columns: id, createdAt, updatedAt. Multi-value cells use ";".`;

function required(values: Record<string, string | undefined>, name: string): string {
  const value = values[name];
  if (!value) throw new Error(`Missing --${name}\n\n${USAGE}`);
  return value;
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      input: { type: "string" },
      config: { type: "string" },
      out: { type: "string" },
      report: { type: "string" },
      entity: { type: "string" },
    },
  });
  if (command === "suggest") {
    const entity = values.entity === "company" ? "company" : "person";
    const rows = await suggestCommand({
      input: required(values, "input"),
      out: required(values, "out"),
      entity,
    });
    console.table(rows);
    console.log(
      `\nDraft config written to ${values.out}. Review the tags, add channels, then run.`,
    );
    return;
  }
  if (command === "run") {
    const stats = await runCommand({
      input: required(values, "input"),
      config: required(values, "config"),
      out: required(values, "out"),
      ...(values.report && { report: values.report }),
    });
    console.table(stats);
    console.log(`\nClean records written to ${values.out}. Nothing was changed in any CRM.`);
    return;
  }
  console.log(USAGE);
  if (command) process.exitCode = 1;
}

main(process.argv.slice(2)).catch((error: Error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
