import * as tf from "@tensorflow/tfjs";

export interface PredictionInput {
  attendancePercentage: number;
  feePaidPercentage: number;
  pendingFees: number;
  internalMarks: number;
}

export interface PredictionResult {
  mlProbability: number;
  ruleBasedScore: number;
  finalRiskLevel: "low" | "medium" | "high";
  insights: string;
  suggestions: string[];
}

// Simple logistic regression model using TensorFlow.js
class DropoutModel {
  private model: tf.LayersModel | null = null;

  async initialize() {
    // Create a simple sequential model
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [4], units: 8, activation: "relu" }),
        tf.layers.dense({ units: 4, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "sigmoid" }),
      ],
    });

    this.model.compile({
      optimizer: tf.train.adam(0.01),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    // Generate synthetic training data for demonstration
    await this.trainModel();
  }

  private async trainModel() {
    // Generate more realistic synthetic training data with gradual risk patterns
    const numSamples = 1000;
    const inputs: number[][] = [];
    const labels: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      const attendance = Math.random() * 100;
      const feePaid = Math.random() * 100;
      const pending = Math.random() * 30000;
      const marks = Math.random() * 100;

      // Normalize inputs
      inputs.push([
        attendance / 100, 
        feePaid / 100, 
        Math.min(pending / 30000, 1), 
        marks / 100
      ]);

      // Create a more nuanced risk score based on multiple factors
      let riskScore = 0;
      
      // Attendance contribution (0-0.4)
      if (attendance < 60) riskScore += 0.4;
      else if (attendance < 75) riskScore += 0.25;
      else if (attendance < 85) riskScore += 0.1;
      
      // Marks contribution (0-0.35)
      if (marks < 35) riskScore += 0.35;
      else if (marks < 50) riskScore += 0.22;
      else if (marks < 65) riskScore += 0.1;
      
      // Fee contribution (0-0.25)
      if (pending > 15000) riskScore += 0.25;
      else if (pending > 8000) riskScore += 0.15;
      else if (pending > 3000) riskScore += 0.05;

      // Add some randomness to make it more realistic
      riskScore += (Math.random() - 0.5) * 0.1;
      riskScore = Math.max(0, Math.min(1, riskScore));

      labels.push(riskScore);
    }

    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor2d(labels, [numSamples, 1]);

    await this.model!.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      shuffle: true,
      verbose: 0,
    });

    xs.dispose();
    ys.dispose();
  }

  predict(input: PredictionInput): number {
    const inputTensor = tf.tensor2d([
      [
        input.attendancePercentage / 100,
        input.feePaidPercentage / 100,
        Math.min(input.pendingFees / 30000, 1),
        input.internalMarks / 100,
      ],
    ]);

    const prediction = this.model!.predict(inputTensor) as tf.Tensor;
    const probability = prediction.dataSync()[0];

    inputTensor.dispose();
    prediction.dispose();

    return Math.max(0, Math.min(1, probability));
  }
}

const model = new DropoutModel();

export const initializeModel = async () => {
  await model.initialize();
};

export const predictDropout = (
  input: PredictionInput,
  criteria: {
    minAttendance: number;
    minMarks: number;
    maxPendingFees: number;
    attendanceWeight: number;
    internalWeight: number;
    feesWeight: number;
  }
): PredictionResult => {
  // ML prediction
  const mlProbability = model.predict(input);

  // Rule-based scoring
  const attendanceScore = input.attendancePercentage < criteria.minAttendance ? 1 : 0;
  const marksScore = input.internalMarks < criteria.minMarks ? 1 : 0;
  const feesScore = input.pendingFees > criteria.maxPendingFees ? 1 : 0;

  const ruleBasedScore =
    attendanceScore * criteria.attendanceWeight +
    marksScore * criteria.internalWeight +
    feesScore * criteria.feesWeight;

  // Combined risk level
  const combinedScore = (mlProbability + ruleBasedScore) / 2;
  const finalRiskLevel: "low" | "medium" | "high" =
    combinedScore > 0.6 ? "high" : combinedScore > 0.3 ? "medium" : "low";

  // Generate insights
  const issues: string[] = [];
  if (input.attendancePercentage < criteria.minAttendance) {
    issues.push(`Low attendance (${input.attendancePercentage.toFixed(1)}%)`);
  }
  if (input.internalMarks < criteria.minMarks) {
    issues.push(`Low internal marks (${input.internalMarks.toFixed(1)})`);
  }
  if (input.pendingFees > criteria.maxPendingFees) {
    issues.push(`High pending fees (₹${input.pendingFees.toFixed(0)})`);
  }

  const insights = issues.length > 0 
    ? `Risk factors identified: ${issues.join(", ")}`
    : "All parameters within acceptable range";

  // Generate suggestions
  const suggestions: string[] = [];
  if (input.attendancePercentage < criteria.minAttendance) {
    suggestions.push("Schedule attendance counseling session");
    suggestions.push("Identify barriers to regular attendance");
  }
  if (input.internalMarks < criteria.minMarks) {
    suggestions.push("Provide additional academic support");
    suggestions.push("Arrange peer tutoring or mentoring");
  }
  if (input.pendingFees > criteria.maxPendingFees) {
    suggestions.push("Contact student/guardian regarding fee payment");
    suggestions.push("Explore financial aid options");
  }
  if (finalRiskLevel === "high") {
    suggestions.push("Schedule immediate intervention meeting");
    suggestions.push("Create personalized support plan");
  }

  return {
    mlProbability,
    ruleBasedScore,
    finalRiskLevel,
    insights,
    suggestions: suggestions.length > 0 ? suggestions : ["Continue monitoring student progress"],
  };
};
