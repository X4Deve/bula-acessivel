import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const MED_SELECT =
  "id,medicine_id,leaflet_version_id,is_saved,usage_state,first_accessed_at,last_accessed_at,started_at,stopped_at,personal_note,medicine:medicine_catalog(id,brand_name,strength,formulation,presentation,manufacturer,active_ingredient,therapeutic_group,therapeutic_group_verified),cats:user_medication_categories(category_id)";

export function useMyMedications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-meds", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_medications")
        .select(MED_SELECT)
        .order("last_accessed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-cats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function medName(m: { medicine: { brand_name: string; strength: string | null } | null }) {
  return m.medicine
    ? `${m.medicine.brand_name}${m.medicine.strength ? ` ${m.medicine.strength}` : ""}`
    : "Medicamento";
}
