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
      date_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          session_id: string
          speaker_id: string
          turn: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          session_id: string
          speaker_id: string
          turn: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          session_id?: string
          speaker_id?: string
          turn?: number
        }
        Relationships: [
          {
            foreignKeyName: "date_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "date_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_messages_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      date_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          model: string | null
          participant_a: string
          participant_b: string
          status: string
          turns_planned: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          model?: string | null
          participant_a: string
          participant_b: string
          status?: string
          turns_planned?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          model?: string | null
          participant_a?: string
          participant_b?: string
          status?: string
          turns_planned?: number
        }
        Relationships: [
          {
            foreignKeyName: "date_sessions_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_sessions_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          candidate_id: string
          confidence: string
          conflicts: Json
          created_at: string
          criteria_evidence: Json | null
          evaluator_id: string
          explanation: string
          id: string
          model: string
          rubric: Json
          score: number | null
          session_id: string
          shared_interests: Json
          unknowns: Json
        }
        Insert: {
          candidate_id: string
          confidence: string
          conflicts?: Json
          created_at?: string
          criteria_evidence?: Json | null
          evaluator_id: string
          explanation: string
          id?: string
          model: string
          rubric: Json
          score?: number | null
          session_id: string
          shared_interests?: Json
          unknowns?: Json
        }
        Update: {
          candidate_id?: string
          confidence?: string
          conflicts?: Json
          created_at?: string
          criteria_evidence?: Json | null
          evaluator_id?: string
          explanation?: string
          id?: string
          model?: string
          rubric?: Json
          score?: number | null
          session_id?: string
          shared_interests?: Json
          unknowns?: Json
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "date_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          consent_at: string | null
          consent_confirmed: boolean
          consent_statement: string | null
          created_at: string
          display_name: string
          error: string | null
          id: string
          instagram_url: string
          is_demo: boolean
          is_test: boolean
          linkedin_url: string
          status: string
          updated_at: string
        }
        Insert: {
          consent_at?: string | null
          consent_confirmed?: boolean
          consent_statement?: string | null
          created_at?: string
          display_name: string
          error?: string | null
          id?: string
          instagram_url: string
          is_demo?: boolean
          is_test?: boolean
          linkedin_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          consent_at?: string | null
          consent_confirmed?: boolean
          consent_statement?: string | null
          created_at?: string
          display_name?: string
          error?: string | null
          id?: string
          instagram_url?: string
          is_demo?: boolean
          is_test?: boolean
          linkedin_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles_analysis: {
        Row: {
          coverage: string
          created_at: string
          data: Json
          input_hash: string | null
          model: string
          participant_id: string
          summary: string
        }
        Insert: {
          coverage: string
          created_at?: string
          data: Json
          input_hash?: string | null
          model: string
          participant_id: string
          summary: string
        }
        Update: {
          coverage?: string
          created_at?: string
          data?: Json
          input_hash?: string | null
          model?: string
          participant_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_analysis_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      source_records: {
        Row: {
          actor_id: string
          actor_run_id: string | null
          created_at: string
          dataset_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          normalized: Json | null
          participant_id: string
          raw: Json | null
          source: string
          source_url: string
          started_at: string | null
          status: string
        }
        Insert: {
          actor_id: string
          actor_run_id?: string | null
          created_at?: string
          dataset_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          normalized?: Json | null
          participant_id: string
          raw?: Json | null
          source: string
          source_url: string
          started_at?: string | null
          status?: string
        }
        Update: {
          actor_id?: string
          actor_run_id?: string | null
          created_at?: string
          dataset_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          normalized?: Json | null
          participant_id?: string
          raw?: Json | null
          source?: string
          source_url?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
