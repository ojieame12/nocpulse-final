import type {
  FieldBoundaryFileParser,
  ParseFieldBoundaryFileInput,
  ParsedFieldBoundaryFile,
} from "./FieldBoundaryFile";

export type ParseFieldBoundaryFileCommand = {
  parser: FieldBoundaryFileParser;
  file: ParseFieldBoundaryFileInput;
};

export type ParseFieldBoundaryFileResult = ParsedFieldBoundaryFile;
