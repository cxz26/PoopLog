/**
 * TagRepository — typed access to tags table.
 */

import { dbExecute, dbSelect } from "../connection";
import { assertTagCategory } from "../../validators";
import type { Tag, TagCategory } from "../../types/entities";

function nowIso(): string {
  return new Date().toISOString();
}

export async function getAll(): Promise<Tag[]> {
  return dbSelect<Tag>("SELECT * FROM tags ORDER BY category, name");
}

export async function getByCategory(category: TagCategory): Promise<Tag[]> {
  assertTagCategory(category);
  return dbSelect<Tag>("SELECT * FROM tags WHERE category = $1 ORDER BY name", [category]);
}

export async function getById(id: number): Promise<Tag | null> {
  const rows = await dbSelect<Tag>("SELECT * FROM tags WHERE id = $1 LIMIT 1", [id]);
  return rows[0] ?? null;
}

export async function getByName(category: TagCategory, name: string): Promise<Tag | null> {
  assertTagCategory(category);
  const rows = await dbSelect<Tag>(
    "SELECT * FROM tags WHERE category = $1 AND name = $2 LIMIT 1",
    [category, name],
  );
  return rows[0] ?? null;
}

export async function create(input: {
  category: TagCategory;
  name: string;
  is_builtin?: 0 | 1;
}): Promise<Tag> {
  assertTagCategory(input.category);
  const name = input.name.trim();
  if (!name) throw new Error("Tag name cannot be empty");
  const ts = nowIso();
  await dbExecute(
    "INSERT INTO tags (category, name, is_builtin, created_at, updated_at) VALUES ($1,$2,$3,$4,$4)",
    [input.category, name, input.is_builtin ?? 0, ts],
  );
  const found = await getByName(input.category as TagCategory, name);
  if (!found) throw new Error("Failed to create tag");
  return found;
}

export async function update(
  id: number,
  patch: Partial<{ category: TagCategory; name: string }>,
): Promise<Tag> {
  const existing = await getById(id);
  if (!existing) throw new Error(`tag ${id} not found`);
  if (patch.category !== undefined) assertTagCategory(patch.category);
  if (patch.name !== undefined && !patch.name.trim()) throw new Error("Tag name cannot be empty");

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.category !== undefined) { sets.push(`category = $${idx++}`); params.push(patch.category); }
  if (patch.name !== undefined) { sets.push(`name = $${idx++}`); params.push(patch.name.trim()); }
  if (sets.length === 0) return existing;
  const ts = nowIso();
  sets.push(`updated_at = $${idx++}`); params.push(ts);
  params.push(id);
  await dbExecute(`UPDATE tags SET ${sets.join(", ")} WHERE id = $${idx}`, params);
  return (await getById(id))!;
}

export async function remove(id: number): Promise<void> {
  // bowel_record_tags will cascade via FK ON DELETE CASCADE
  await dbExecute("DELETE FROM tags WHERE id = $1", [id]);
}
