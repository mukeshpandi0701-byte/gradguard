import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Github, Linkedin, RefreshCw, ExternalLink, TrendingUp, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Student = {
  id: string;
  student_name: string;
  roll_number: string | null;
  github_url: string | null;
  linkedin_url: string | null;
};

type GitHubActivity = {
  totalCommits: number;
  recentRepos: string[];
  lastActivity: string;
  publicRepos: number;
};

type LinkedInActivity = {
  connectionCount: number;
  recentPosts: number;
  lastActivity: string;
  profileViews: number;
};

type StudentActivity = {
  studentId: string;
  github: GitHubActivity | null;
  linkedin: LinkedInActivity | null;
  lastSynced: string;
};

const SocialProfiles = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Map<string, StudentActivity>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_name, roll_number, github_url, linkedin_url")
        .order("roll_number", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const studentsWithProfiles = (data || []).filter(
        (s) => s.github_url || s.linkedin_url
      );
      setStudents(studentsWithProfiles);

      // Fetch activity for all students with profiles
      if (studentsWithProfiles.length > 0) {
        await syncAllActivities(studentsWithProfiles);
      }
    } catch (error: any) {
      toast.error("Failed to fetch students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const syncAllActivities = async (studentsList: Student[]) => {
    setSyncing(true);
    const newActivities = new Map<string, StudentActivity>();

    for (const student of studentsList) {
      try {
        const activity = await fetchStudentActivity(student);
        newActivities.set(student.id, activity);
      } catch (error) {
        console.error(`Failed to fetch activity for ${student.student_name}:`, error);
      }
    }

    setActivities(newActivities);
    setSyncing(false);
  };

  const fetchStudentActivity = async (student: Student): Promise<StudentActivity> => {
    const activity: StudentActivity = {
      studentId: student.id,
      github: null,
      linkedin: null,
      lastSynced: new Date().toISOString(),
    };

    // Fetch GitHub activity
    if (student.github_url) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await supabase.functions.invoke("fetch-github-activity", {
          body: { githubUrl: student.github_url },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });

        if (response.data) {
          activity.github = response.data;
        }
      } catch (error) {
        console.error("GitHub activity fetch failed:", error);
      }
    }

    // Fetch LinkedIn activity
    if (student.linkedin_url) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await supabase.functions.invoke("fetch-linkedin-activity", {
          body: { linkedinUrl: student.linkedin_url },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });

        if (response.data) {
          activity.linkedin = response.data;
        }
      } catch (error) {
        console.error("LinkedIn activity fetch failed:", error);
      }
    }

    return activity;
  };

  const handleSyncStudent = async (student: Student) => {
    setSyncing(true);
    try {
      const activity = await fetchStudentActivity(student);
      setActivities((prev) => new Map(prev).set(student.id, activity));
      toast.success(`Synced ${student.student_name}'s profile`);
    } catch (error) {
      toast.error("Failed to sync profile");
    } finally {
      setSyncing(false);
    }
  };

  const getActivityStatus = (activity: StudentActivity | undefined): "active" | "moderate" | "inactive" => {
    if (!activity) return "inactive";

    const githubActive = activity.github && activity.github.totalCommits > 5;
    const linkedinActive = activity.linkedin && activity.linkedin.recentPosts > 2;

    if (githubActive || linkedinActive) return "active";
    if (activity.github || activity.linkedin) return "moderate";
    return "inactive";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "moderate":
        return "bg-yellow-500";
      case "inactive":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Social Profiles</h1>
            <p className="text-muted-foreground mt-2">
              Monitor student activity on GitHub and LinkedIn
            </p>
          </div>
          <Button
            onClick={() => syncAllActivities(students)}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync All
          </Button>
        </div>

        {students.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No Social Profiles Found</p>
              <p className="text-sm text-muted-foreground">
                Students need to add their GitHub or LinkedIn URLs in their profiles
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => {
              const activity = activities.get(student.id);
              const status = getActivityStatus(activity);

              return (
                <Card key={student.id} className="relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 ${getStatusColor(status)}`} />
                  
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{student.student_name}</CardTitle>
                        {student.roll_number && (
                          <p className="text-sm text-muted-foreground">{student.roll_number}</p>
                        )}
                      </div>
                      <Badge variant={status === "active" ? "default" : status === "moderate" ? "secondary" : "outline"}>
                        {status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* GitHub Activity */}
                    {student.github_url && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Github className="h-4 w-4" />
                            <span className="text-sm font-medium">GitHub</span>
                          </div>
                          <a
                            href={student.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {activity?.github ? (
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Total Commits:</span>
                              <span className="font-medium">{activity.github.totalCommits}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Public Repos:</span>
                              <span className="font-medium">{activity.github.publicRepos}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Last Activity:</span>
                              <span className="font-medium">
                                {new Date(activity.github.lastActivity).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Loading...</div>
                        )}
                      </div>
                    )}

                    {/* LinkedIn Activity */}
                    {student.linkedin_url && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Linkedin className="h-4 w-4" />
                            <span className="text-sm font-medium">LinkedIn</span>
                          </div>
                          <a
                            href={student.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {activity?.linkedin ? (
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Connections:</span>
                              <span className="font-medium">{activity.linkedin.connectionCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Recent Posts:</span>
                              <span className="font-medium">{activity.linkedin.recentPosts}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Profile Views:</span>
                              <span className="font-medium">{activity.linkedin.profileViews}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Loading...</div>
                        )}
                      </div>
                    )}

                    {activity && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Last synced: {new Date(activity.lastSynced).toLocaleString()}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSyncStudent(student)}
                            disabled={syncing}
                            className="h-7"
                          >
                            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SocialProfiles;
