import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function splitPdfToPng(pdfFilePath: string): Promise<string[]> {
  const tempDir = path.join(__dirname, "temp");
  const outputPrefix = path.join(tempDir, `${uuidv4()}_page_`);
  const imagePaths: string[] = [];

  try {
    // Ensure the temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    // Convert PDF to PNG using pdftoppm
    await execAsync(`pdftoppm -png "${pdfFilePath}" "${outputPrefix}"`);

    // Collect all generated PNG files
    const files = await fs.readdir(tempDir);

    // Sort images by their names (assuming pdftoppm names them in order)
    files.sort();

    files.forEach((file) => {
      if (
        file.endsWith(".png") &&
        file.startsWith(path.basename(outputPrefix))
      ) {
        imagePaths.push(path.join(tempDir, file));
      }
    });

    return imagePaths;
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw new Error("Failed to process PDF.");
  }
}
