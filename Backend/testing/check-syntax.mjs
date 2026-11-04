import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourceFiles = [];

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name === "node_modules") {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(fullPath);
    } else if (/\.(?:js|mjs)$/.test(entry.name)) {
      sourceFiles.push(fullPath);
    }
  }
};

await collectSourceFiles(backendRoot);

const failures = [];
for (const filePath of sourceFiles) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    failures.push({
      filePath: path.relative(backendRoot, filePath),
      output: result.stderr || result.stdout,
    });
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`Syntax error: ${failure.filePath}`);
    console.error(failure.output.trim());
  }
  process.exitCode = 1;
} else {
  console.log(`Syntax OK: ${sourceFiles.length} JavaScript files`);
}
