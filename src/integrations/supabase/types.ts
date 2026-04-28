/**
 * Supabase database types — MyPrepaPro
 *
 * Regenerate with:
 *   npx supabase gen types typescript \
 *     --project-id mxbfnkkbtmbrauvqplrt \
 *     > src/integrations/supabase/types.ts
 *
 * Last manual sync: 2026-04-27
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_data: {
        Row: {
          athlete_id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          athlete_id: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          athlete_id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          { foreignKeyName: "app_data_athlete_id_fkey"; columns: ["athlete_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      competitions: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          planning_block_id: string | null
          season_id: string | null
          name: string
          type: string
          date: string
          location: string | null
          notes: string | null
          priority: string
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          planning_block_id?: string | null
          season_id?: string | null
          name: string
          type?: string
          date: string
          location?: string | null
          notes?: string | null
          priority?: string
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          planning_block_id?: string | null
          season_id?: string | null
          name?: string
          type?: string
          date?: string
          location?: string | null
          notes?: string | null
          priority?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "competitions_coach_id_fkey"; columns: ["coach_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "competitions_athlete_id_fkey"; columns: ["athlete_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "competitions_planning_block_id_fkey"; columns: ["planning_block_id"]; referencedRelation: "planning_blocks"; referencedColumns: ["id"] },
          { foreignKeyName: "competitions_season_id_fkey"; columns: ["season_id"]; referencedRelation: "seasons"; referencedColumns: ["id"] }
        ]
      }
      exercises: {
        Row: {
          id: string
          name: string
          bloc: string | null
          target: string | null
          ex_type: string | null
          tier: string | null
          is_verified: boolean
          created_by: string | null
          youtube_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          bloc?: string | null
          target?: string | null
          ex_type?: string | null
          tier?: string | null
          is_verified?: boolean
          created_by?: string | null
          youtube_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          bloc?: string | null
          target?: string | null
          ex_type?: string | null
          tier?: string | null
          is_verified?: boolean
          created_by?: string | null
          youtube_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          id: string
          athlete_id: string
          name: string
          emoji: string
          color: string
          sort_order: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          name: string
          emoji?: string
          color?: string
          sort_order?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string
          name?: string
          emoji?: string
          color?: string
          sort_order?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "habits_athlete_id_fkey"; columns: ["athlete_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      habit_logs: {
        Row: {
          id: string
          habit_id: string
          athlete_id: string
          date: string
        }
        Insert: {
          id?: string
          habit_id: string
          athlete_id: string
          date: string
        }
        Update: {
          id?: string
          habit_id?: string
          athlete_id?: string
          date?: string
        }
        Relationships: [
          { foreignKeyName: "habit_logs_habit_id_fkey"; columns: ["habit_id"]; referencedRelation: "habits"; referencedColumns: ["id"] },
          { foreignKeyName: "habit_logs_athlete_id_fkey"; columns: ["athlete_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      invitations: {
        Row: {
          id: string
          coach_id: string
          token: string
          email: string | null
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          token?: string
          email?: string | null
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          token?: string
          email?: string | null
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      nutrition_daily_log: {
        Row: {
          id: string
          athlete_id: string
          date: string
          active_calories: number | null
          total_calories_consumed: number | null
          glucides_consumed: number | null
          lipides_consumed: number | null
          proteines_consumed: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          date?: string
          active_calories?: number | null
          total_calories_consumed?: number | null
          glucides_consumed?: number | null
          lipides_consumed?: number | null
          proteines_consumed?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          date?: string
          active_calories?: number | null
          total_calories_consumed?: number | null
          glucides_consumed?: number | null
          lipides_consumed?: number | null
          proteines_consumed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      nutrition_strategy: {
        Row: {
          id: string
          athlete_id: string
          coach_id: string
          strategy: "maintenance" | "seche" | "prise_de_masse"
          can_track_calories: boolean
          total_calories_coach: number | null
          target_weight: number | null
          surplus_deficit_min: number | null
          surplus_deficit_max: number | null
          macros_glucides: number | null
          macros_lipides: number | null
          macros_proteines: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          coach_id: string
          strategy: "maintenance" | "seche" | "prise_de_masse"
          can_track_calories?: boolean
          total_calories_coach?: number | null
          target_weight?: number | null
          surplus_deficit_min?: number | null
          surplus_deficit_max?: number | null
          macros_glucides?: number | null
          macros_lipides?: number | null
          macros_proteines?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          strategy?: "maintenance" | "seche" | "prise_de_masse"
          can_track_calories?: boolean
          total_calories_coach?: number | null
          target_weight?: number | null
          surplus_deficit_min?: number | null
          surplus_deficit_max?: number | null
          macros_glucides?: number | null
          macros_lipides?: number | null
          macros_proteines?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      performance_logs: {
        Row: {
          id: string
          athlete_id: string
          metric_type: string
          metric_name: string
          value: number
          unit: string
          custom_unit: string | null
          date: string
          test_session_id: string | null
          is_active_reference: boolean
          coach_validated: boolean | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          metric_type: string
          metric_name: string
          value: number
          unit: string
          custom_unit?: string | null
          date?: string
          test_session_id?: string | null
          is_active_reference?: boolean
          coach_validated?: boolean | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          metric_type?: string
          metric_name?: string
          value?: number
          unit?: string
          date?: string
          is_active_reference?: boolean
          coach_validated?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      planning_blocks: {
        Row: {
          id: string
          season_id: string
          coach_id: string
          athlete_id: string
          name: string
          description: string | null
          type: string
          start_week: number
          end_week: number
          color: string
          parent_block_id: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          season_id: string
          coach_id: string
          athlete_id: string
          name: string
          description?: string | null
          type?: string
          start_week: number
          end_week: number
          color?: string
          parent_block_id?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          type?: string
          start_week?: number
          end_week?: number
          color?: string
          parent_block_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: "coach" | "athlete" | "coach_athlete"
          full_name: string
          coach_id: string | null
          coach_code: string | null
          first_name: string | null
          last_name: string | null
          age: number | null
          height_cm: number | null
          gender: "male" | "female" | null
          weight_kg: number | null
          body_fat_pct: number | null
          base_metabolism: number | null
          birth_date: string | null
          is_admin: boolean
          habit_tracker_enabled: boolean
          created_at: string
        }
        Insert: {
          id: string
          role: "coach" | "athlete" | "coach_athlete"
          full_name: string
          coach_id?: string | null
          coach_code?: string | null
          first_name?: string | null
          last_name?: string | null
          age?: number | null
          height_cm?: number | null
          gender?: "male" | "female" | null
          weight_kg?: number | null
          body_fat_pct?: number | null
          base_metabolism?: number | null
          birth_date?: string | null
          is_admin?: boolean
          habit_tracker_enabled?: boolean
          created_at?: string
        }
        Update: {
          role?: "coach" | "athlete" | "coach_athlete"
          full_name?: string
          coach_id?: string | null
          coach_code?: string | null
          first_name?: string | null
          last_name?: string | null
          age?: number | null
          height_cm?: number | null
          gender?: "male" | "female" | null
          weight_kg?: number | null
          body_fat_pct?: number | null
          base_metabolism?: number | null
          birth_date?: string | null
          is_admin?: boolean
          habit_tracker_enabled?: boolean
        }
        Relationships: []
      }
      retours: {
        Row: {
          id: string
          athlete_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          content: string
          created_at?: string
        }
        Update: {
          content?: string
        }
        Relationships: [
          { foreignKeyName: "retours_athlete_id_fkey"; columns: ["athlete_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      seasons: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          name: string
          start_date: string
          end_date: string
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          name: string
          start_date: string
          end_date: string
          created_at?: string
        }
        Update: {
          name?: string
          start_date?: string
          end_date?: string
        }
        Relationships: []
      }
      test_sessions: {
        Row: {
          id: string
          athlete_id: string
          coach_id: string | null
          type: string
          custom_type: string | null
          title: string
          description: string | null
          reference_file_url: string | null
          reference_file_type: string | null
          date: string
          completed: boolean
          results_structured: Json
          results_note: string | null
          planning_block_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          coach_id?: string | null
          type?: string
          title: string
          date?: string
          completed?: boolean
          results_structured?: Json
          planning_block_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: string
          title?: string
          date?: string
          completed?: boolean
          results_structured?: Json
          results_note?: string | null
          planning_block_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          id: string
          athlete_id: string
          coach_id: string | null
          session_id: string
          session_name: string
          scheduled_date: string
          status: "planned" | "in_progress" | "completed" | "missed" | "skipped"
          started_at: string | null
          completed_at: string | null
          duration_s: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          coach_id?: string | null
          session_id: string
          session_name: string
          scheduled_date?: string
          status?: "planned" | "in_progress" | "completed" | "missed" | "skipped"
          started_at?: string | null
          completed_at?: string | null
          duration_s?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: "planned" | "in_progress" | "completed" | "missed" | "skipped"
          started_at?: string | null
          completed_at?: string | null
          duration_s?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "workout_logs_athlete_id_fkey"; columns: ["athlete_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_coach_overview: {
        Args: { coach_uuid: string }
        Returns: Json
      }
      mark_missed_workouts: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      unlink_athlete: {
        Args: { athlete_id: string }
        Returns: undefined
      }
      set_active_performance_reference: {
        Args: { p_performance_log_id: string; p_athlete_id: string; p_metric_name: string }
        Returns: undefined
      }
      is_coach_of: {
        Args: { athlete_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
