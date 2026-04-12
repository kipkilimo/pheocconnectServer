import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

import Question from "../../src/models/Question";

async function migrateTopicToArray() {
  console.log("Starting topic migration...");

  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error("MongoDB URI not found in environment variables!");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // ✅ STEP 1: fetch only documents that might need fixing
    const questions = await Question.find({
      topic: { $exists: true },
    });

    // ✅ STEP 2: filter in JS (replaces $where)
    const stringTopicQuestions = questions.filter(
      (q: any) => typeof q.topic === "string",
    );

    console.log(
      `📊 Found ${stringTopicQuestions.length} questions with string topic`,
    );

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const question of stringTopicQuestions) {
      try {
        const rawTopic = (question as any).topic;

        if (Array.isArray(rawTopic)) {
          skippedCount++;
          continue;
        }

        let newTopic: string[] = [];

        if (typeof rawTopic === "string") {
          const trimmed = rawTopic.trim();
          if (trimmed) newTopic = [trimmed];
        }

        await Question.updateOne(
          { _id: question._id },
          { $set: { topic: newTopic } },
        );

        updatedCount++;

        console.log(
          `✅ Updated ${question.shortId}: "${rawTopic}" -> [${newTopic.join(", ")}]`,
        );
      } catch (err) {
        errorCount++;
        console.error(`❌ Failed ${question.shortId}:`, err);
      }
    }

    console.log("\n📈 Migration Summary:");
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Failed: ${errorCount}`);

    // ✅ Verification (NO $where)
    const remaining = (
      await Question.find({ topic: { $exists: true } })
    ).filter((q: any) => typeof q.topic === "string").length;

    console.log(`\n🔍 Remaining string topics: ${remaining}`);

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateTopicToArray().catch(console.error);
