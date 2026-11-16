export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      leaflet_versions: {
        Row: {
          approved_at: string | null
          created_at: string
          created_by: string | null
          full_text: string | null
          id: string
          leaflet_kind: string
          medicine_id: string
          review_note: string | null
          sections_json: Json
          source_checked_at: string
          source_type: Database["public"]["Enums"]["source_type"]
          source_url: string
          status: Database["public"]["Enums"]["leaflet_status"]
          updated_at: string
          verified_by: string | null
          version_label: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          full_text?: string | null
          id?: string
          leaflet_kind?: string
          medicine_id: string
          review_note?: string | null
          sections_json?: Json
          source_checked_at: string
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url: string
          status?: Database["public"]["Enums"]["leaflet_status"]
          updated_at?: string
          verified_by?: string | null
          version_label: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          full_text?: string | null
          id?: string
          leaflet_kind?: string
          medicine_id?: string
          review_note?: string | null
          sections_json?: Json
          source_checked_at?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url?: string
          status?: Database["public"]["Enums"]["leaflet_status"]
          updated_at?: string
          verified_by?: string | null
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaflet_versions_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_catalog: {
        Row: {
          active_ingredient: string | null
          brand_name: string
          created_at: string
          created_by: string | null
          formulation: string | null
          id: string
          manufacturer: string | null
          presentation: string | null
          registration_code: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          source_url: string
          status: Database["public"]["Enums"]["catalog_status"]
          strength: string | null
          therapeutic_group: string | null
          therapeutic_group_verified: boolean
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          active_ingredient?: string | null
          brand_name: string
          created_at?: string
          created_by?: string | null
          formulation?: string | null
          id?: string
          manufacturer?: string | null
          presentation?: string | null
          registration_code?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url: string
          status?: Database["public"]["Enums"]["catalog_status"]
          strength?: string | null
          therapeutic_group?: string | null
          therapeutic_group_verified?: boolean
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          active_ingredient?: string | null
          brand_name?: string
          created_at?: string
          created_by?: string | null
          formulation?: string | null
          id?: string
          manufacturer?: string | null
          presentation?: string | null
          registration_code?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          strength?: string | null
          therapeutic_group?: string | null
          therapeutic_group_verified?: boolean
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          created_at: string
          due_at: string
          error: string | null
          id: string
          reminder_id: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at: string
          error?: string | null
          id?: string
          reminder_id: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string
          error?: string | null
          id?: string
          reminder_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminder_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          health_tracking_consent: boolean
          health_tracking_consent_at: string | null
          id: string
          preferences: Json
          save_search_history: boolean
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          health_tracking_consent?: boolean
          health_tracking_consent_at?: string | null
          id: string
          preferences?: Json
          save_search_history?: boolean
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          health_tracking_consent?: boolean
          health_tracking_consent_at?: string | null
          id?: string
          preferences?: Json
          save_search_history?: boolean
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reminder_schedules: {
        Row: {
          active: boolean
          created_at: string
          delivery_channel: string
          end_date: string | null
          id: string
          label: string | null
          local_times: string[]
          start_date: string
          timezone: string
          updated_at: string
          user_id: string
          user_medication_id: string
          weekdays: number[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          delivery_channel?: string
          end_date?: string | null
          id?: string
          label?: string | null
          local_times: string[]
          start_date: string
          timezone?: string
          updated_at?: string
          user_id: string
          user_medication_id: string
          weekdays: number[]
        }
        Update: {
          active?: boolean
          created_at?: string
          delivery_channel?: string
          end_date?: string | null
          id?: string
          label?: string | null
          local_times?: string[]
          start_date?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          user_medication_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "reminder_schedules_user_medication_id_fkey"
            columns: ["user_medication_id"]
            isOneToOne: false
            referencedRelation: "user_medications"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          created_at: string
          id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_entitlements: {
        Row: {
          approved_request_id: string | null
          is_payment_confirmed: boolean
          status: string
          tier: Database["public"]["Enums"]["tier"]
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          approved_request_id?: string | null
          is_payment_confirmed?: boolean
          status?: string
          tier?: Database["public"]["Enums"]["tier"]
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          approved_request_id?: string | null
          is_payment_confirmed?: boolean
          status?: string
          tier?: Database["public"]["Enums"]["tier"]
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_entitlements_approved_request_id_fkey"
            columns: ["approved_request_id"]
            isOneToOne: false
            referencedRelation: "subscription_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_requests: {
        Row: {
          admin_note: string | null
          admin_reviewed_by: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          type: string
          user_id: string
          user_note: string | null
        }
        Insert: {
          admin_note?: string | null
          admin_reviewed_by?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          type?: string
          user_id: string
          user_note?: string | null
        }
        Update: {
          admin_note?: string | null
          admin_reviewed_by?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          type?: string
          user_id?: string
          user_note?: string | null
        }
        Relationships: []
      }
      symptom_checkins: {
        Row: {
          created_at: string
          id: string
          mood: Database["public"]["Enums"]["mood"]
          notes: string | null
          user_id: string
          user_medication_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: Database["public"]["Enums"]["mood"]
          notes?: string | null
          user_id: string
          user_medication_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: Database["public"]["Enums"]["mood"]
          notes?: string | null
          user_id?: string
          user_medication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_checkins_user_medication_id_fkey"
            columns: ["user_medication_id"]
            isOneToOne: false
            referencedRelation: "user_medications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medication_categories: {
        Row: {
          category_id: string
          user_id: string
          user_medication_id: string
        }
        Insert: {
          category_id: string
          user_id: string
          user_medication_id: string
        }
        Update: {
          category_id?: string
          user_id?: string
          user_medication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medication_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_medication_categories_user_medication_id_fkey"
            columns: ["user_medication_id"]
            isOneToOne: false
            referencedRelation: "user_medications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medication_history: {
        Row: {
          created_at: string
          event: string
          id: string
          user_id: string
          user_medication_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          user_id: string
          user_medication_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          user_id?: string
          user_medication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medication_history_user_medication_id_fkey"
            columns: ["user_medication_id"]
            isOneToOne: false
            referencedRelation: "user_medications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medications: {
        Row: {
          created_at: string
          first_accessed_at: string
          id: string
          is_saved: boolean
          last_accessed_at: string
          leaflet_version_id: string | null
          medicine_id: string
          personal_note: string | null
          started_at: string | null
          stopped_at: string | null
          updated_at: string
          usage_state: Database["public"]["Enums"]["usage_state"]
          user_id: string
        }
        Insert: {
          created_at?: string
          first_accessed_at?: string
          id?: string
          is_saved?: boolean
          last_accessed_at?: string
          leaflet_version_id?: string | null
          medicine_id: string
          personal_note?: string | null
          started_at?: string | null
          stopped_at?: string | null
          updated_at?: string
          usage_state?: Database["public"]["Enums"]["usage_state"]
          user_id: string
        }
        Update: {
          created_at?: string
          first_accessed_at?: string
          id?: string
          is_saved?: boolean
          last_accessed_at?: string
          leaflet_version_id?: string | null
          medicine_id?: string
          personal_note?: string | null
          started_at?: string | null
          stopped_at?: string | null
          updated_at?: string
          usage_state?: Database["public"]["Enums"]["usage_state"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medications_leaflet_version_id_fkey"
            columns: ["leaflet_version_id"]
            isOneToOne: false
            referencedRelation: "leaflet_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_medications_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_subscription_requests: {
        Args: never
        Returns: {
          admin_note: string
          created_at: string
          display_name: string
          email: string
          id: string
          reviewed_at: string
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
          user_note: string
        }[]
      }
      admin_stats: { Args: never; Returns: Json }
      archive_medicine: { Args: { _id: string }; Returns: undefined }
      delete_my_personal_data: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_official_anvisa_url: { Args: { _url: string }; Returns: boolean }
      is_premium: { Args: { _user_id: string }; Returns: boolean }
      publish_leaflet_version: { Args: { _id: string }; Returns: undefined }
      reject_leaflet_version: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      review_subscription_request: {
        Args: {
          _approve: boolean
          _id: string
          _note: string
          _valid_until?: string
        }
        Returns: undefined
      }
      revoke_entitlement: {
        Args: { _note: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin"
      catalog_status: "draft" | "published" | "archived"
      leaflet_status:
        | "draft"
        | "in_review"
        | "published"
        | "superseded"
        | "rejected"
      mood: "melhor" | "igual" | "pior" | "prefiro_nao_responder"
      request_status: "pending" | "approved" | "rejected"
      source_type: "anvisa_bulario" | "fabricante" | "fornecedor_autorizado"
      tier: "free" | "premium"
      usage_state: "none" | "taking" | "stopped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
      catalog_status: ["draft", "published", "archived"],
      leaflet_status: [
        "draft",
        "in_review",
        "published",
        "superseded",
        "rejected",
      ],
      mood: ["melhor", "igual", "pior", "prefiro_nao_responder"],
      request_status: ["pending", "approved", "rejected"],
      source_type: ["anvisa_bulario", "fabricante", "fornecedor_autorizado"],
      tier: ["free", "premium"],
      usage_state: ["none", "taking", "stopped"],
    },
  },
} as const
