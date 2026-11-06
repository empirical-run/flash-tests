export function firstDiffFilePath(diff: string) {
  const diffLine = diff
    .split("\n")
    .find((line) => line.startsWith("diff --git a/"));

  return diffLine?.match(/ b\/(.+)$/)?.[1];
}

export function firstDiffContentLine(diff: string) {
  const contentLine = diff.split("\n").find((line) => {
    if (!["+", "-", " "].includes(line[0])) {
      return false;
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      return false;
    }

    const text = line.slice(1).trim();
    return text.length >= 10 && !text.startsWith("\\ No newline");
  });

  return contentLine?.slice(1).trim().slice(0, 80);
}
