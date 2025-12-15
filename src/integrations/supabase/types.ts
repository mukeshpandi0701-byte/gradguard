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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          assignment_name: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          max_marks: number
          platform: string | null
          staff_user_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          assignment_name: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          max_marks?: number
          platform?: string | null
          staff_user_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          assignment_name?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          max_marks?: number
          platform?: string | null
          staff_user_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "branch_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          max_sessions: number
          sessions_attended: number
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          id?: string
          max_sessions?: number
          sessions_attended?: number
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          max_sessions?: number
          sessions_attended?: number
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      branch_subjects: {
        Row: {
          branch: string
          created_at: string
          created_by: string
          department: string
          id: string
          subject_code: string
          subject_name: string | null
          updated_at: string
        }
        Insert: {
          branch: string
          created_at?: string
          created_by: string
          department: string
          id?: string
          subject_code: string
          subject_name?: string | null
          updated_at?: string
        }
        Update: {
          branch?: string
          created_at?: string
          created_by?: string
          department?: string
          id?: string
          subject_code?: string
          subject_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      download_history: {
        Row: {
          created_at: string
          download_date: string
          file_size: number | null
          id: string
          metadata: Json | null
          report_name: string
          report_type: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          download_date?: string
          file_size?: number | null
          id?: string
          metadata?: Json | null
          report_name: string
          report_type: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          download_date?: string
          file_size?: number | null
          id?: string
          metadata?: Json | null
          report_name?: string
          report_type?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dropout_criteria: {
        Row: {
          attendance_weightage: number
          created_at: string
          fees_weightage: number
          id: string
          internal_weightage: number
          max_internal_marks: number
          max_pending_fees: number
          max_sessions_per_day: number
          min_attendance_percentage: number
          min_internal_marks: number
          total_fees: number
          total_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_weightage?: number
          created_at?: string
          fees_weightage?: number
          id?: string
          internal_weightage?: number
          max_internal_marks?: number
          max_pending_fees?: number
          max_sessions_per_day?: number
          min_attendance_percentage?: number
          min_internal_marks?: number
          total_fees?: number
          total_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_weightage?: number
          created_at?: string
          fees_weightage?: number
          id?: string
          internal_weightage?: number
          max_internal_marks?: number
          max_pending_fees?: number
          max_sessions_per_day?: number
          min_attendance_percentage?: number
          min_internal_marks?: number
          total_fees?: number
          total_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      institution_email_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          sender_email: string
          sender_name: string
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_user: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          sender_email: string
          sender_name: string
          smtp_host?: string
          smtp_password: string
          smtp_port?: number
          smtp_user: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          sender_email?: string
          sender_name?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_user?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          message: string
          opened_at: string | null
          resend_email_id: string | null
          sent_at: string
          status: string
          student_email: string
          student_id: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message: string
          opened_at?: string | null
          resend_email_id?: string | null
          sent_at?: string
          status?: string
          student_email: string
          student_id: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message?: string
          opened_at?: string | null
          resend_email_id?: string | null
          sent_at?: string
          status?: string
          student_email?: string
          student_id?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          id: string
          resend_sender_email: string
          resend_sender_name: string | null
          sms_template: string | null
          twilio_sender_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resend_sender_email: string
          resend_sender_name?: string | null
          sms_template?: string | null
          twilio_sender_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resend_sender_email?: string
          resend_sender_name?: string | null
          sms_template?: string | null
          twilio_sender_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          created_at: string
          final_risk_level: Database["public"]["Enums"]["risk_level"]
          id: string
          insights: string | null
          ml_probability: number
          rule_based_score: number
          student_id: string
          suggestions: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          final_risk_level: Database["public"]["Enums"]["risk_level"]
          id?: string
          insights?: string | null
          ml_probability: number
          rule_based_score: number
          student_id: string
          suggestions?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          final_risk_level?: Database["public"]["Enums"]["risk_level"]
          id?: string
          insights?: string | null
          ml_probability?: number
          rule_based_score?: number
          student_id?: string
          suggestions?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          branch: string | null
          college: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          github_url: string | null
          id: string
          linkedin_url: string | null
          panel_type: string | null
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          year: string | null
        }
        Insert: {
          branch?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          github_url?: string | null
          id: string
          linkedin_url?: string | null
          panel_type?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          year?: string | null
        }
        Update: {
          branch?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          panel_type?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          year?: string | null
        }
        Relationships: []
      }
      staff_branch_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          branch: string
          created_at: string
          id: string
          staff_user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          branch: string
          created_at?: string
          id?: string
          staff_user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          branch?: string
          created_at?: string
          id?: string
          staff_user_id?: string
        }
        Relationships: []
      }
      student_assignment_scores: {
        Row: {
          assignment_id: string
          created_at: string
          graded_at: string | null
          graded_by: string | null
          id: string
          marks_obtained: number | null
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          marks_obtained?: number | null
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          marks_obtained?: number | null
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_assignment_scores_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assignment_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_history: {
        Row: {
          attendance_percentage: number | null
          fee_paid_percentage: number | null
          id: string
          internal_marks: number | null
          pending_fees: number | null
          recorded_at: string
          student_id: string
          user_id: string
        }
        Insert: {
          attendance_percentage?: number | null
          fee_paid_percentage?: number | null
          id?: string
          internal_marks?: number | null
          pending_fees?: number | null
          recorded_at?: string
          student_id: string
          user_id: string
        }
        Update: {
          attendance_percentage?: number | null
          fee_paid_percentage?: number | null
          id?: string
          internal_marks?: number | null
          pending_fees?: number | null
          recorded_at?: string
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          branch: string | null
          college: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          phone_number: string | null
          roll_number: string | null
          updated_at: string
          user_id: string
          year: string | null
        }
        Insert: {
          branch?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          roll_number?: string | null
          updated_at?: string
          user_id: string
          year?: string | null
        }
        Update: {
          branch?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          roll_number?: string | null
          updated_at?: string
          user_id?: string
          year?: string | null
        }
        Relationships: []
      }
      student_subject_marks: {
        Row: {
          created_at: string
          id: string
          internal_marks: number
          student_id: string
          subject_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_marks?: number
          student_id: string
          subject_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_marks?: number
          student_id?: string
          subject_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subject_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "branch_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          attendance_percentage: number | null
          attended_hours: number
          created_at: string
          department: string | null
          email: string | null
          fee_paid_percentage: number | null
          github_url: string | null
          id: string
          internal_marks: number
          linkedin_url: string | null
          paid_fees: number
          pending_fees: number | null
          phone_number: string | null
          roll_number: string | null
          student_name: string
          total_fees: number
          total_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_percentage?: number | null
          attended_hours?: number
          created_at?: string
          department?: string | null
          email?: string | null
          fee_paid_percentage?: number | null
          github_url?: string | null
          id?: string
          internal_marks?: number
          linkedin_url?: string | null
          paid_fees?: number
          pending_fees?: number | null
          phone_number?: string | null
          roll_number?: string | null
          student_name: string
          total_fees?: number
          total_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_percentage?: number | null
          attended_hours?: number
          created_at?: string
          department?: string | null
          email?: string | null
          fee_paid_percentage?: number | null
          github_url?: string | null
          id?: string
          internal_marks?: number
          linkedin_url?: string | null
          paid_fees?: number
          pending_fees?: number | null
          phone_number?: string | null
          roll_number?: string | null
          student_name?: string
          total_fees?: number
          total_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          rejected_reason: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejected_reason?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejected_reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      get_approval_status: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["approval_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "hod" | "staff" | "student"
      approval_status: "pending" | "approved" | "rejected"
      risk_level: "low" | "medium" | "high"
      user_role: "admin" | "tutor"
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
    Enums: {
      app_role: ["hod", "staff", "student"],
      approval_status: ["pending", "approved", "rejected"],
      risk_level: ["low", "medium", "high"],
      user_role: ["admin", "tutor"],
    },
  },
} as const
