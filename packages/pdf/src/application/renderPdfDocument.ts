import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import type {
  PdfBinaryRenderResult,
  PdfRenderInput,
  PdfTextBlock,
  PdfTextStyle,
} from "../contracts/PdfRender";

type PdfFontRef = "F1" | "F2";

type LayoutStyle = {
  font: PdfFontRef;
  fontSize: number;
  lineHeight: number;
  marginTop: number;
  maxChars: number;
  color: readonly [number, number, number];
};

type PositionedLine = {
  style: LayoutStyle;
  text: string;
  y: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN_LEFT = 54;
const PAGE_MARGIN_RIGHT = 54;
const PAGE_TOP = 736;
const PAGE_BOTTOM = 62;

const STYLES: Record<PdfTextStyle, LayoutStyle> = {
  title: {
    font: "F2",
    fontSize: 20,
    lineHeight: 28,
    marginTop: 0,
    maxChars: 44,
    color: [0.08, 0.24, 0.17],
  },
  heading: {
    font: "F2",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    maxChars: 70,
    color: [0.12, 0.12, 0.12],
  },
  subheading: {
    font: "F2",
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 8,
    maxChars: 82,
    color: [0.18, 0.18, 0.18],
  },
  body: {
    font: "F1",
    fontSize: 10,
    lineHeight: 13.5,
    marginTop: 0,
    maxChars: 94,
    color: [0.14, 0.14, 0.14],
  },
  caption: {
    font: "F1",
    fontSize: 9,
    lineHeight: 12,
    marginTop: 0,
    maxChars: 102,
    color: [0.4, 0.4, 0.4],
  },
};

function wrapText(text: string, maxChars: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return [];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }

      continue;
    }

    if (!current) {
      current = word;
      continue;
    }

    const candidate = `${current} ${word}`;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function layoutBlocks(blocks: readonly PdfTextBlock[]) {
  const pages: PositionedLine[][] = [[]];
  let pageIndex = 0;
  let y = PAGE_TOP;

  const beginNextPage = () => {
    pages.push([]);
    pageIndex += 1;
    y = PAGE_TOP;
  };

  for (const block of blocks) {
    const style = STYLES[block.style];
    const lines = wrapText(block.text, style.maxChars);

    if (lines.length === 0) {
      continue;
    }

    if (pages[pageIndex].length > 0) {
      const nextY = y - style.marginTop;

      if (nextY < PAGE_BOTTOM) {
        beginNextPage();
      } else {
        y = nextY;
      }
    }

    for (const line of lines) {
      if (y - style.lineHeight < PAGE_BOTTOM) {
        beginNextPage();
      }

      pages[pageIndex].push({
        style,
        text: line,
        y,
      });
      y -= style.lineHeight;
    }
  }

  return pages;
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

function createTextCommand(
  text: string,
  font: PdfFontRef,
  fontSize: number,
  x: number,
  y: number,
  color: readonly [number, number, number],
) {
  const escaped = escapePdfText(text);
  const [red, green, blue] = color;
  return [
    "BT",
    `/${font} ${fontSize} Tf`,
    `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} rg`,
    `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`,
    `(${escaped}) Tj`,
    "ET",
  ].join("\n");
}

function buildPageStream(
  title: string,
  pageNumber: number,
  pageCount: number,
  lines: readonly PositionedLine[],
) {
  const commands: string[] = [
    createTextCommand("FieldPulse Field Report", "F2", 9, PAGE_MARGIN_LEFT, 772, [
      0.33,
      0.33,
      0.33,
    ]),
    createTextCommand(
      `Page ${pageNumber} of ${pageCount}`,
      "F1",
      9,
      PAGE_WIDTH - PAGE_MARGIN_RIGHT - 68,
      36,
      [0.45, 0.45, 0.45],
    ),
  ];

  if (pageNumber > 1) {
    commands.push(
      createTextCommand(title, "F2", 11, PAGE_MARGIN_LEFT, 752, [0.08, 0.24, 0.17]),
    );
  }

  for (const line of lines) {
    commands.push(
      createTextCommand(
        line.text,
        line.style.font,
        line.style.fontSize,
        PAGE_MARGIN_LEFT,
        line.y,
        line.style.color,
      ),
    );
  }

  return commands.join("\n");
}

function buildPdfDocument(
  input: PdfRenderInput,
  pageStreams: readonly string[],
): Uint8Array {
  const fontRegularObject = 1;
  const fontBoldObject = 2;
  const firstContentObject = 3;
  const firstPageObject = firstContentObject + pageStreams.length;
  const pagesObject = firstPageObject + pageStreams.length;
  const catalogObject = pagesObject + 1;
  const infoObject = catalogObject + 1;

  const objects: string[] = [];
  objects[fontRegularObject] = [
    `${fontRegularObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "endobj",
  ].join("\n");
  objects[fontBoldObject] = [
    `${fontBoldObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "endobj",
  ].join("\n");

  pageStreams.forEach((stream, index) => {
    const objectNumber = firstContentObject + index;
    const streamLength = Buffer.byteLength(stream, "utf8");

    objects[objectNumber] = [
      `${objectNumber} 0 obj`,
      `<< /Length ${streamLength} >>`,
      "stream",
      stream,
      "endstream",
      "endobj",
    ].join("\n");
  });

  pageStreams.forEach((_, index) => {
    const objectNumber = firstPageObject + index;
    const contentObject = firstContentObject + index;

    objects[objectNumber] = [
      `${objectNumber} 0 obj`,
      "<<",
      "/Type /Page",
      `/Parent ${pagesObject} 0 R`,
      `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
      `/Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >> >>`,
      `/Contents ${contentObject} 0 R`,
      ">>",
      "endobj",
    ].join("\n");
  });

  const kids = pageStreams
    .map((_, index) => `${firstPageObject + index} 0 R`)
    .join(" ");

  objects[pagesObject] = [
    `${pagesObject} 0 obj`,
    `<< /Type /Pages /Count ${pageStreams.length} /Kids [ ${kids} ] >>`,
    "endobj",
  ].join("\n");

  objects[catalogObject] = [
    `${catalogObject} 0 obj`,
    `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`,
    "endobj",
  ].join("\n");

  const infoFields = [
    `/Title (${escapePdfText(input.title)})`,
    `/Author (${escapePdfText(input.author ?? "FieldPulse")})`,
    `/Subject (${escapePdfText(input.subject ?? input.title)})`,
    "/Creator (FieldPulse PDF Renderer)",
    "/Producer (FieldPulse PDF Renderer)",
  ];

  objects[infoObject] = [
    `${infoObject} 0 obj`,
    `<< ${infoFields.join(" ")} >>`,
    "endobj",
  ].join("\n");

  let document = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(document, "utf8");
    document += `${objects[objectNumber]}\n`;
  }

  const startXref = Buffer.byteLength(document, "utf8");
  document += `xref\n0 ${objects.length}\n`;
  document += "0000000000 65535 f \n";

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    document += `${offsets[objectNumber].toString().padStart(10, "0")} 00000 n \n`;
  }

  document += [
    "trailer",
    `<< /Size ${objects.length} /Root ${catalogObject} 0 R /Info ${infoObject} 0 R >>`,
    "startxref",
    `${startXref}`,
    "%%EOF",
  ].join("\n");

  return Buffer.from(document, "utf8");
}

export function renderPdfDocument(
  input: PdfRenderInput,
): PdfBinaryRenderResult {
  const laidOutPages = layoutBlocks(input.blocks);
  const pageStreams = laidOutPages.map((page, index) =>
    buildPageStream(input.title, index + 1, laidOutPages.length, page),
  );
  const bytes = buildPdfDocument(input, pageStreams);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return {
    metadata: {
      artifactKey: input.artifactKey,
      pageCount: laidOutPages.length,
      byteSize: bytes.byteLength,
      sha256,
    },
    bytes,
  };
}
