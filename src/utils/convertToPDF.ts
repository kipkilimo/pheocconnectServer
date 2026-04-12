import { exec } from "child_process";
import path from "path";
import { promises as fs } from "fs";

export const convertToPDF = async (filePath: string): Promise<string> => {
  const fileExtension = path.extname(filePath).toLowerCase();

  // Check if the file needs conversion (doc, docx, txt)
  if ([".doc", ".docx", ".txt"].includes(fileExtension)) {
    const outputFilePath = filePath.replace(fileExtension, ".pdf");

    return new Promise<string>((resolve, reject) => {
      // Use LibreOffice to convert the file to PDF
      const command = `libreoffice --headless --convert-to pdf --outdir ${path.dirname(
        filePath
      )} ${filePath}`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error("Conversion to PDF failed:", error);
          return reject(error);
        }

        console.log("Conversion output:", stdout);
        if (stderr) {
          console.error("Conversion errors (if any):", stderr);
        }

        // Resolve with the new PDF file path
        resolve(outputFilePath);
      });
    });
  }

  // If the file is already in PDF format, return the original path
  return filePath;
};
