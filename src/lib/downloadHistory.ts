import { supabase } from "@/integrations/supabase/client";

export interface DownloadHistoryParams {
  reportType: "student_pdf" | "analytics_pdf" | "class_report" | "social_activity_report";
  reportName: string;
  fileSize?: number;
  metadata?: any;
  storagePath?: string;
}

export const logDownloadHistory = async (params: DownloadHistoryParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("No user found to log download history");
      return;
    }

    const { error } = await supabase
      .from("download_history")
      .insert({
        user_id: user.id,
        report_type: params.reportType,
        report_name: params.reportName,
        file_size: params.fileSize || null,
        metadata: params.metadata || null,
        storage_path: params.storagePath || null,
      });

    if (error) {
      console.error("Error logging download history:", error);
    }
  } catch (error) {
    console.error("Failed to log download history:", error);
  }
};
