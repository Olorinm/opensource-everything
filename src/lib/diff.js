import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import {
  ensureDir,
  fileInfo,
  pathExists,
  readJson,
  writeJson,
  writeText,
} from "./common.js";
import { findCandidatePage, loadSession } from "./reference.js";

export async function diffReferenceArtifacts(referenceInput, candidateManifestInput, outputDir) {
  const { session, sessionDir } = await loadSession(referenceInput);
  const candidateManifestPath = resolve(candidateManifestInput);
  const candidate = await readJson(candidateManifestPath);
  const targetDir = resolve(outputDir || sessionDir);
  const report = await buildArtifactDiff(session, candidate, {
    candidateBaseDir: dirname(candidateManifestPath),
    outputDir: targetDir,
  });
  const markdownPath = resolve(targetDir, "artifact-diff.md");
  const jsonPath = resolve(targetDir, "artifact-diff.json");
  await writeText(markdownPath, report.markdown);
  await writeJson(jsonPath, report.json);
  return { report, markdownPath, jsonPath };
}

export async function buildArtifactDiff(session, candidate, options = {}) {
  const candidateBaseDir = resolve(options.candidateBaseDir || process.cwd());
  const outputDir = resolve(options.outputDir || process.cwd());
  const pageFindings = [];
  let compared = 0;
  let similarityTotal = 0;

  for (const page of session.pages || []) {
    const candidatePage = findCandidatePage(candidate, page);
    const candidateScreenshots = await collectCandidateScreenshots(candidatePage, candidateBaseDir);
    const screenshotFindings = [];

    for (const referenceShot of page.screenshots || []) {
      const matchedCandidate =
        candidateScreenshots.find((item) => item.label && item.label === referenceShot.label) ||
        candidateScreenshots.find(
          (item) => basename(item.path || "") === basename(referenceShot.path || ""),
        ) ||
        null;

      const diffResult = await compareScreenshotPair(referenceShot, matchedCandidate, {
        outputDir,
        pageId: page.id,
        label: referenceShot.label || basename(referenceShot.path || ""),
      });

      compared += 1;
      similarityTotal += diffResult.similarity;

      screenshotFindings.push({
        referenceLabel: referenceShot.label || basename(referenceShot.path || ""),
        referencePath: referenceShot.path || "",
        candidateLabel: matchedCandidate?.label || "",
        candidatePath: matchedCandidate?.path || "",
        status: diffResult.status,
        similarity: diffResult.similarity,
        mismatchPixels: diffResult.mismatchPixels,
        totalPixels: diffResult.totalPixels,
        diffPath: diffResult.diffPath,
        dimensions: diffResult.dimensions,
        note: diffResult.note,
      });
    }

    pageFindings.push({
      page: page.id,
      title: page.title,
      screenshots: screenshotFindings,
    });
  }

  const changed = pageFindings.flatMap((page) =>
    page.screenshots
      .filter((item) => item.status !== "exact")
      .map((item) => ({
        page: page.page,
        label: item.referenceLabel,
        status: item.status,
        similarity: item.similarity,
        diffPath: item.diffPath,
      })),
  );

  const score = compared === 0 ? 100 : roundPercentage(similarityTotal / compared);
  const markdown = [
    `# Artifact Diff: ${session.source.name || session.id}`,
    "",
    "## Score",
    `${score}% visual similarity`,
    "",
    "## Page Findings",
    ...pageFindings.map((page) =>
      [
        `### ${page.title || page.page}`,
        ...(page.screenshots.length
          ? page.screenshots.map((item) => formatScreenshotLine(item))
          : ["- No reference screenshots on this page."]),
      ].join("\n"),
    ),
    "",
    "## Differences",
    changed.length
      ? changed
          .map(
            (item) =>
              `- ${item.page}: ${item.label} is ${item.status} (${item.similarity}%)${item.diffPath ? ` -> ${item.diffPath}` : ""}`,
          )
          .join("\n")
      : "- No screenshot differences detected by the visual diff.",
    "",
  ].join("\n");

  return {
    score,
    compared,
    changed,
    markdown,
    json: {
      score,
      compared,
      pageFindings,
      changed,
    },
  };
}

async function compareScreenshotPair(referenceShot, candidateShot, options) {
  if (!candidateShot) {
    return {
      status: "missing",
      similarity: 0,
      mismatchPixels: 0,
      totalPixels: 0,
      diffPath: "",
      dimensions: null,
      note: "No candidate screenshot matched this reference label.",
    };
  }

  if (!candidateShot.exists) {
    return {
      status: "candidate-missing-file",
      similarity: 0,
      mismatchPixels: 0,
      totalPixels: 0,
      diffPath: "",
      dimensions: null,
      note: "Candidate manifest points to a screenshot file that does not exist.",
    };
  }

  const referenceHash = referenceShot?.metadata?.sha256 || "";
  const candidateHash = candidateShot.sha256 || "";
  if (referenceHash && candidateHash && referenceHash === candidateHash) {
    return {
      status: "exact",
      similarity: 100,
      mismatchPixels: 0,
      totalPixels: 0,
      diffPath: "",
      dimensions: null,
      note: "Hashes match exactly.",
    };
  }

  const referencePath = resolve(referenceShot.metadata?.path || referenceShot.path || "");
  const candidatePath = resolve(candidateShot.path || "");
  if (!isPng(referencePath) || !isPng(candidatePath)) {
    return {
      status: "unsupported-format",
      similarity: 0,
      mismatchPixels: 0,
      totalPixels: 0,
      diffPath: "",
      dimensions: null,
      note: "Pixel diff currently supports PNG screenshots only.",
    };
  }

  try {
    const referencePng = PNG.sync.read(await readFile(referencePath));
    const candidatePng = PNG.sync.read(await readFile(candidatePath));

    if (
      referencePng.width !== candidatePng.width ||
      referencePng.height !== candidatePng.height
    ) {
      return {
        status: "dimension-mismatch",
        similarity: 0,
        mismatchPixels: 0,
        totalPixels: referencePng.width * referencePng.height,
        diffPath: "",
        dimensions: {
          reference: `${referencePng.width}x${referencePng.height}`,
          candidate: `${candidatePng.width}x${candidatePng.height}`,
        },
        note: "Reference and candidate screenshots have different dimensions.",
      };
    }

    const diffPng = new PNG({ width: referencePng.width, height: referencePng.height });
    const mismatchPixels = pixelmatch(
      referencePng.data,
      candidatePng.data,
      diffPng.data,
      referencePng.width,
      referencePng.height,
      {
        threshold: 0.1,
        includeAA: true,
      },
    );
    const totalPixels = referencePng.width * referencePng.height;
    const similarity =
      totalPixels === 0
        ? 100
        : roundPercentage(((totalPixels - mismatchPixels) / totalPixels) * 100);

    if (mismatchPixels === 0) {
      return {
        status: "exact",
        similarity,
        mismatchPixels,
        totalPixels,
        diffPath: "",
        dimensions: {
          reference: `${referencePng.width}x${referencePng.height}`,
          candidate: `${candidatePng.width}x${candidatePng.height}`,
        },
        note: "Pixel diff found no changed pixels.",
      };
    }

    const diffPath = await writeDiffImage(diffPng, options);
    return {
      status: "changed",
      similarity,
      mismatchPixels,
      totalPixels,
      diffPath,
      dimensions: {
        reference: `${referencePng.width}x${referencePng.height}`,
        candidate: `${candidatePng.width}x${candidatePng.height}`,
      },
      note: "Pixel diff found visible differences.",
    };
  } catch (error) {
    return {
      status: "decode-error",
      similarity: 0,
      mismatchPixels: 0,
      totalPixels: 0,
      diffPath: "",
      dimensions: null,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

async function collectCandidateScreenshots(candidatePage, candidateBaseDir) {
  const screenshots = Array.isArray(candidatePage?.screenshots) ? candidatePage.screenshots : [];
  const normalized = [];

  for (const rawEntry of screenshots) {
    if (typeof rawEntry === "string") {
      normalized.push(await enrichScreenshotEntry({ path: rawEntry, label: "" }, candidateBaseDir));
      continue;
    }

    if (rawEntry && typeof rawEntry === "object") {
      normalized.push(
        await enrichScreenshotEntry(
          {
            path: String(rawEntry.path || ""),
            label: String(rawEntry.label || ""),
            sha256: rawEntry.sha256 ? String(rawEntry.sha256) : "",
          },
          candidateBaseDir,
        ),
      );
    }
  }

  return normalized.filter(Boolean);
}

async function enrichScreenshotEntry(entry, candidateBaseDir) {
  const screenshotPath = entry.path ? resolve(candidateBaseDir, entry.path) : "";
  if (!screenshotPath || !(await pathExists(screenshotPath))) {
    return {
      label: entry.label,
      path: screenshotPath,
      sha256: entry.sha256 || "",
      exists: false,
    };
  }

  const metadata = await fileInfo(screenshotPath);
  return {
    label: entry.label,
    path: screenshotPath,
    sha256: entry.sha256 || metadata.sha256,
    exists: true,
  };
}

async function writeDiffImage(diffPng, options) {
  const diffDir = join(options.outputDir, "artifacts", "diffs", options.pageId);
  await ensureDir(diffDir);
  const absolutePath = join(diffDir, `${slugToken(options.label)}.diff.png`);
  await writeFile(absolutePath, PNG.sync.write(diffPng));
  return absolutePath;
}

function formatScreenshotLine(item) {
  const pixels =
    item.totalPixels > 0
      ? `, ${item.mismatchPixels}/${item.totalPixels} pixels changed`
      : "";
  const dimensions = item.dimensions
    ? `, size ${item.dimensions.reference}${item.dimensions.candidate && item.dimensions.candidate !== item.dimensions.reference ? ` vs ${item.dimensions.candidate}` : ""}`
    : "";
  const diffPath = item.diffPath ? `, diff ${item.diffPath}` : "";
  const note = item.note ? `, ${item.note}` : "";
  return `- ${item.referenceLabel}: ${item.status} (${item.similarity}%)${pixels}${dimensions}${diffPath}${note}`;
}

function isPng(path) {
  return extname(path).toLowerCase() === ".png";
}

function roundPercentage(value) {
  return Math.round(value * 100) / 100;
}

function slugToken(value) {
  return String(value || "shot")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "shot";
}
