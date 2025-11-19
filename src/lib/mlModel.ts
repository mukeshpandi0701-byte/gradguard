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
    // Generate synthetic training data
    const numSamples = 500;
    const inputs: number[][] = [];
    const labels: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      const attendance = Math.random() * 100;
      const feePaid = Math.random() * 100;
      const pending = Math.random() * 20000;
      const marks = Math.random() * 100;

      inputs.push([attendance, feePaid, pending / 100, marks]);

      // Label: 1 (dropout risk) if low attendance, low marks, or high pending fees
      const isRisk = attendance < 70 || marks < 40 || pending > 10000 ? 1 : 0;
      labels.push(isRisk);
    }

    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor2d(labels, [numSamples, 1]);

    await this.model!.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      verbose: 0,
    });

    xs.dispose();
    ys.dispose();
  }

  predict(input: PredictionInput): number {
    const inputTensor = tf.tensor2d([
      [
        input.attendancePercentage,
        input.feePaidPercentage,
        input.pendingFees / 100,
        input.internalMarks,
      ],
    ]);

    const prediction = this.model!.predict(inputTensor) as tf.Tensor;
    const probability = prediction.dataSync()[0];

    inputTensor.dispose();
    prediction.dispose();

    return probability;
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
