import postgres from "postgres";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL não definida no ambiente.");
  process.exit(1);
}

const migrationsDir = join(__dir, "../supabase/migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

try {
  for (const file of files) {
    console.log(`Aplicando migration ${file}...`);
    const migration = readFileSync(join(migrationsDir, file), "utf-8");
    await sql.unsafe(migration);
  }
  console.log("✓ Schema aplicado com sucesso.");
} catch (err) {
  console.error("Erro ao aplicar migration:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
