import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, Target, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AIInsightsProps {
  studentId: string;
  studentName: string;
  onDataUpdate?: (data: { trendAnalysis: any; recommendations: any }) => void;
}

interface TrendAnalysis {
  trendAnalysis: {
    attendance: string;
    academicPerformance: string;
    financialStatus: string;
  };
  predictions: {
    oneMonth: {
      riskLevel: string;
      confidence: string;
      reasoning: string;
    };
    threeMonths: {
      riskLevel: string;
      confidence: string;
      reasoning: string;
    };
  };
  warningSignals: string[];
  positiveIndicators: string[];
  interventionUrgency: string;
  summary: string;
}

interface Recommendations {
  immediateActions: Array<{
    priority: string;
    action: string;
    reason: string;
    expectedImpact: string;
  }>;
  shortTermGoals: Array<{
    goal: string;
    timeframe: string;
    steps: string[];
    successMetric: string;
  }>;
  longTermStrategies: Array<{
    strategy: string;
    description: string;
    milestones: string[];
  }>;
  supportNeeded: {
    academic: string[];
    financial: string[];
    personal: string[];
  };
  motivationalMessage: string;
  keyFocusAreas: string[];
}

export const AIInsights = ({ studentId, studentName, onDataUpdate }: AIInsightsProps) => {
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Notify parent component when data changes
  const updateParent = (trends: TrendAnalysis | null, recs: Recommendations | null) => {
    if (onDataUpdate) {
      onDataUpdate({ trendAnalysis: trends, recommendations: recs });
    }
  };

  const analyzeTrends = async () => {
    setLoadingTrends(true);
    toast.loading("Analyzing student trends with AI...");

    try {
      const { data, error } = await supabase.functions.invoke("analyze-student-trends", {
        body: { studentId },
      });

      if (error) throw error;

      if (data.success) {
        setTrendAnalysis(data.analysis);
        updateParent(data.analysis, recommendations);
        toast.dismiss();
        toast.success("Trend analysis complete!");
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Failed to analyze trends");
      console.error(error);
    } finally {
      setLoadingTrends(false);
    }
  };

  const generateRecommendations = async () => {
    setLoadingRecommendations(true);
    toast.loading("Generating personalized recommendations with AI...");

    try {
      const { data, error } = await supabase.functions.invoke("generate-student-recommendations", {
        body: { studentId },
      });

      if (error) throw error;

      if (data.success) {
        setRecommendations(data.recommendations);
        updateParent(trendAnalysis, data.recommendations);
        toast.dismiss();
        toast.success("Recommendations generated!");
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Failed to generate recommendations");
      console.error(error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "bg-red-100 text-red-800 border-red-300";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low": return "bg-green-100 text-green-800 border-green-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getUrgencyColor = (urgency: string): "default" | "destructive" => {
    switch (urgency.toLowerCase()) {
      case "critical": return "destructive";
      case "high": return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle>AI-Powered Insights</CardTitle>
          </div>
          <CardDescription>
            Get intelligent analysis and personalized recommendations for {studentName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={analyzeTrends} disabled={loadingTrends} className="flex-1">
              <TrendingUp className="w-4 h-4 mr-2" />
              {loadingTrends ? "Analyzing..." : "Analyze Trends"}
            </Button>
            <Button onClick={generateRecommendations} disabled={loadingRecommendations} className="flex-1">
              <Lightbulb className="w-4 h-4 mr-2" />
              {loadingRecommendations ? "Generating..." : "Get Recommendations"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          {trendAnalysis ? (
            <>
              {/* Summary Alert */}
              <Alert variant={getUrgencyColor(trendAnalysis.interventionUrgency)}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Intervention Urgency: {trendAnalysis.interventionUrgency}</AlertTitle>
                <AlertDescription>{trendAnalysis.summary}</AlertDescription>
              </Alert>

              {/* Trend Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Trends</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium text-sm text-muted-foreground">Attendance</p>
                    <p className="text-sm">{trendAnalysis.trendAnalysis.attendance}</p>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-muted-foreground">Academic Performance</p>
                    <p className="text-sm">{trendAnalysis.trendAnalysis.academicPerformance}</p>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-muted-foreground">Financial Status</p>
                    <p className="text-sm">{trendAnalysis.trendAnalysis.financialStatus}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Predictions */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">1 Month Prediction</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge className={getPriorityColor(trendAnalysis.predictions.oneMonth.riskLevel)}>
                      {trendAnalysis.predictions.oneMonth.riskLevel.toUpperCase()} RISK
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Confidence: {trendAnalysis.predictions.oneMonth.confidence}
                    </p>
                    <p className="text-sm">{trendAnalysis.predictions.oneMonth.reasoning}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">3 Month Prediction</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge className={getPriorityColor(trendAnalysis.predictions.threeMonths.riskLevel)}>
                      {trendAnalysis.predictions.threeMonths.riskLevel.toUpperCase()} RISK
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Confidence: {trendAnalysis.predictions.threeMonths.confidence}
                    </p>
                    <p className="text-sm">{trendAnalysis.predictions.threeMonths.reasoning}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Warning Signals & Positive Indicators */}
              <div className="grid gap-4 md:grid-cols-2">
                {trendAnalysis.warningSignals.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        Warning Signals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {trendAnalysis.warningSignals.map((signal, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-destructive">•</span>
                            <span>{signal}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {trendAnalysis.positiveIndicators.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Positive Indicators
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {trendAnalysis.positiveIndicators.map((indicator, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-green-600">•</span>
                            <span>{indicator}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Click "Analyze Trends" to get AI-powered trend analysis and future risk predictions
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {recommendations ? (
            <>
              {/* Motivational Message */}
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Encouragement</AlertTitle>
                <AlertDescription>{recommendations.motivationalMessage}</AlertDescription>
              </Alert>

              {/* Key Focus Areas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Key Focus Areas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.keyFocusAreas.map((area, i) => (
                      <Badge key={i} variant="outline">{area}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Immediate Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Immediate Actions (Next 1-2 Weeks)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recommendations.immediateActions.map((action, i) => (
                    <div key={i} className="border-l-4 border-primary pl-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getPriorityColor(action.priority)}>
                          {action.priority} Priority
                        </Badge>
                      </div>
                      <p className="font-medium">{action.action}</p>
                      <p className="text-sm text-muted-foreground">{action.reason}</p>
                      <p className="text-sm text-green-700">Expected: {action.expectedImpact}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Short Term Goals */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Short-Term Goals (1 Month)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recommendations.shortTermGoals.map((goal, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{goal.goal}</p>
                        <Badge variant="secondary">{goal.timeframe}</Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Steps:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          {goal.steps.map((step, j) => (
                            <li key={j} className="text-sm">{step}</li>
                          ))}
                        </ol>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Success: {goal.successMetric}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Long Term Strategies */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Long-Term Strategies (3 Months)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recommendations.longTermStrategies.map((strategy, i) => (
                    <div key={i} className="space-y-2">
                      <p className="font-medium">{strategy.strategy}</p>
                      <p className="text-sm">{strategy.description}</p>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Milestones:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {strategy.milestones.map((milestone, j) => (
                            <li key={j} className="text-sm">{milestone}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Support Needed */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Support & Resources Needed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recommendations.supportNeeded.academic.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-2">Academic Support:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {recommendations.supportNeeded.academic.map((support, i) => (
                          <li key={i} className="text-sm">{support}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recommendations.supportNeeded.financial.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-2">Financial Support:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {recommendations.supportNeeded.financial.map((support, i) => (
                          <li key={i} className="text-sm">{support}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recommendations.supportNeeded.personal.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-2">Personal Support:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {recommendations.supportNeeded.personal.map((support, i) => (
                          <li key={i} className="text-sm">{support}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Click "Get Recommendations" to generate personalized improvement strategies
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
