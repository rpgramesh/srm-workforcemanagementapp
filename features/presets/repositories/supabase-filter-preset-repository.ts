/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FilterPreset, FilterPresetRepository } from "@/types/preset";
import { createSupabaseServerClient } from "@/lib/supabase";

function mapRow(row: any): FilterPreset {
  return {
    id: row.id,
    userId: row.user_id,
    module: row.module,
    name: row.name,
    filters: (row.filters ?? {}) as FilterPreset["filters"],
    sortOrder: Number(row.sort_order ?? 0),
    isDefault: Boolean(row.is_default),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SupabaseFilterPresetRepository implements FilterPresetRepository {
  private readonly client = createSupabaseServerClient();

  async list(userId: string, module: string): Promise<FilterPreset[]> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(userId)) return [];
    const { data, error } = await this.client
      .from("filter_presets")
      .select("*")
      .eq("user_id", userId)
      .eq("module", module)
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data as any[] ?? []).map(mapRow);
  }

  async upsert(
    userId: string,
    module: string,
    name: string,
    filters: FilterPreset["filters"],
    isDefault: boolean = false,
  ): Promise<string> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(userId)) throw new Error("Unable to save preset: current user is not database-backed.");
    const { data, error } = await this.client.rpc("upsert_filter_preset", {
      p_user_id: userId,
      p_module: module,
      p_name: name,
      p_filters: filters as any,
      p_is_default: isDefault,
    });
    if (error) throw new Error(error.message ?? String(error));
    if (!data) throw new Error("upsert_filter_preset returned no id");
    return data as string;
  }

  async remove(userId: string, module: string, presetId: string): Promise<void> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(userId)) return;
    const { error } = await this.client.rpc("delete_filter_preset", {
      p_user_id: userId,
      p_module: module,
      p_preset_id: presetId,
    });
    if (error) throw new Error(error.message ?? String(error));
  }
}

export const filterPresetRepository: FilterPresetRepository = new SupabaseFilterPresetRepository();
