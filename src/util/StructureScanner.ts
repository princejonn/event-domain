import { ScanFileData } from "../types";
import { basename, extname, join, relative, sep } from "path";
import { endsWith, flatten, includes } from "lodash";
import { readdirSync, statSync } from "fs";

export class StructureScanner {
  readonly directory: string;
  readonly extensions: Array<string>;

  constructor(directory: string, extensions: Array<string>) {
    this.directory = directory;
    this.extensions = extensions;
  }

  public scan(): Array<ScanFileData> {
    return this.scanDirectory(this.directory);
  }

  public scanDirectory(directory: string): Array<ScanFileData> {
    const files = readdirSync(directory);
    const array = [];

    for (const file of files) {
      const filePath = join(directory, file);
      const relativePath = relative(this.directory, filePath);
      const stats = statSync(filePath);
      const isTest = includes(file, ".spec.") || includes(file, ".test.");

      if (stats.isFile() && this.isApprovedExtension(file) && !isTest) {
        array.push({
          name: basename(file, extname(file)),
          path: filePath,
          relative: relativePath,
          parents: relativePath.split(sep).slice(0, -1).reverse(),
        });
      } else if (stats.isDirectory()) {
        array.push(this.scanDirectory(filePath));
      }
    }

    return flatten(array);
  }

  private isApprovedExtension(file: string): boolean {
    for (const extension of this.extensions) {
      if (!endsWith(file, extension)) continue;
      return true;
    }
    return false;
  }

  static hasFiles(directory: string): boolean {
    try {
      const files = readdirSync(directory);
      return files.length > 0;
    } catch (_) {
      return false;
    }
  }

  static getCommandName(file: string): string {
    return basename(file, extname(file));
  }

  static getEventName(file: string): string {
    return basename(file, extname(file));
  }

  static getAggregateName(directory: string): string {
    return directory.split(sep).slice(0, -1).reverse()[0];
  }
}
