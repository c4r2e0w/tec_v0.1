// export_schema.js
// Скрипт для выгрузки структуры всех таблиц Supabase в один JSON-файл.

import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Подхватываем переменные из .env.local (приоритет) и .env
dotenv.config({ path: ".env.local" });
dotenv.config();

// -------------------------------
// 1. Укажи свои ключи
// -------------------------------

// ⚠️ Вставь сюда настройки проекта:
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://YOUR-PROJECT.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "YOUR-SERVICE-ROLE-KEY" 
// Только service_role даёт право читать metadata!

// -------------------------------
// 2. Функция запроса
// -------------------------------
async function getSchema() {
  const url = `${SUPABASE_URL}/rest/v1/columns?select=schema,table,name,data_type,format,default_value,is_nullable,ordinal_position&order=schema.asc,table.asc,ordinal_position.asc`
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Accept-Profile": "pg_meta",
      "Content-Profile": "pg_meta",
    },
  })
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Meta API error ${response.status}: ${errText}`)
  }
  return response.json()
}

// -------------------------------
// 3. Преобразуем в удобную структуру
// -------------------------------
function buildSchema(rows) {
  const schema = {};

  for (const row of rows) {
    const table = `${row.schema}.${row.table}`;

    if (!schema[table]) {
      schema[table] = {
        table: row.table,
        schema: row.schema,
        columns: []
      };
    }

    schema[table].columns.push({
      name: row.name,
      type: row.data_type || row.format,
      nullable: row.is_nullable,
      default: row.default_value
    });
  }

  return Object.values(schema);
}

// -------------------------------
// 4. Главная функция
// -------------------------------
async function main() {
  console.log("⏳ Загружаю структуру всех таблиц Supabase...");

  try {
    const rows = await getSchema();
    const schema = buildSchema(rows);

    fs.writeFileSync("schema.json", JSON.stringify(schema, null, 2));

    console.log("✅ Готово! Файл schema.json создан.");
    console.log("📄 Структура таблиц также выведена ниже:\n");

    console.log(JSON.stringify(schema, null, 2));
  } catch (err) {
    console.error("❌ Ошибка:", err);
  }
}

main();
/* eslint-env node */
/* global process */
