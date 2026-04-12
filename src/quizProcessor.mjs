import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current module path for ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {'HARD' | 'MEDIUM' | 'EASY'} Difficulty
 * @typedef {'SINGLE_SELECT' | 'MULTI_SELECT' | string} QuestionType
 */

/**
 * @typedef {Object} QuizItem
 * @property {string} stem - The question stem
 * @property {string[]} choices - Array of answer choices
 * @property {string[]} correctAnswers - Array of correct answers
 * @property {string} [explanation] - Explanation for the answer
 * @property {string[]} [tags] - Optional tags for categorization
 * @property {string} specialty - Specialty category
 * @property {string} topic - Topic within specialty
 * @property {Difficulty} difficulty - Question difficulty level
 * @property {QuestionType} questionType - Type of question
 * @property {any} [key] - Additional properties
 */

/**
 * @typedef {Object} ProcessedOutput
 * @property {Object} input
 * @property {string} input.questionsJson - Stringified quiz items
 * @property {QuestionType} input.questionType - Type of questions
 */

/**
 * Loads quiz items from a JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<QuizItem[]>} Array of quiz items
 */
async function loadQuizItems(filePath) {
  const resolvedPath = path.resolve(__dirname, filePath);
  const raw = await fs.readFile(resolvedPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Wipes the content of a JSON file
 * @param {string} filePath - Path to JSON file to wipe
 * @returns {Promise<void>}
 */
async function wipeFileContent(filePath) {
  const resolvedPath = path.resolve(__dirname, filePath);
  await fs.writeFile(resolvedPath, '[]', 'utf-8');
  console.log(`♻️ Successfully wiped content of ${filePath}`);
}

/**
 * Processes quiz items and copies output to clipboard
 * @param {QuizItem[]} items - Array of quiz items to process
 * @param {string} sourceFilePath - Path to source file for wiping
 * @returns {Promise<void>}
 */
async function processQuizItems(items, sourceFilePath) {
  if (!items?.length) {
    console.error('⚠️ No quiz items to process.');
    return;
  }

  try {
    const cleanedItems = items.map(
      ({ id, createdAt, shortId, metrics, ...rest }) => rest
    );

    const questionType = items[0].questionType || 'SINGLE_SELECT';

    const output = {
      input: {
        questionsJson: JSON.stringify(cleanedItems),
        questionType,
      },
    };

    const outputString = JSON.stringify(output, null, 2);

    // Dynamic import of clipboardy
    const { default: clipboard } = await import('clipboardy');
    await clipboard.write(outputString);

    console.log('✅ Successfully copied to clipboard!');
    console.log('\n📋 Output Preview:\n', outputString);

    // Wipe the source file after successful processing
    await wipeFileContent(sourceFilePath);
  } catch (error) {
    console.error(
      '❌ Error processing quiz items:',
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  const defaultPath = './quizzes.json';
  const inputPath = process.argv[2] || defaultPath;

  try {
    const quizItems = await loadQuizItems(inputPath);
    await processQuizItems(quizItems, inputPath);
    process.exit(0); // Success exit code
  } catch (err) {
    console.error(`❌ Failed to load or process file: ${inputPath}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1); // Error exit code
  }
}

// Execute main function
main();