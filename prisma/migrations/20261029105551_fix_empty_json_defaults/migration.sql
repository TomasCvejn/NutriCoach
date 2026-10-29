-- Prisma writes a Json `@default("[]")` unquoted for SQLite (DEFAULT []), which SQLite reads as an empty identifier:
-- rows that existed when such a column was added got '' instead of '[]', which Prisma can't parse. Repair them.
UPDATE "user" SET "mutedNotifications" = '[]' WHERE "mutedNotifications" = '';
UPDATE "Client" SET "allergens" = '[]' WHERE "allergens" = '';
UPDATE "PlanMeal" SET "recipeIds" = '[]' WHERE "recipeIds" = '';
