import { spawn } from "node:child_process";
import { ConverterError } from "./errors";
import type { JobContext } from "./runtime";

export async function runFfmpeg(
  input: string,
  output: string,
  filter: string,
  context: JobContext,
): Promise<void> {
  context.check();
  const executable =
    context.options.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      executable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-threads",
        "1",
        "-i",
        input,
        "-vf",
        filter,
        "-frames:v",
        "1",
        "-threads",
        "1",
        output,
      ],
      { stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
    );
    let stderr = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let startupError: Error | undefined;
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-16384);
    });
    const cancel = () => {
      child.kill("SIGTERM");
      timer = setTimeout(() => child.kill("SIGKILL"), 1000);
      timer.unref();
    };
    child.on("error", (error) => {
      startupError = error;
    });
    child.on("close", (code) => {
      context.signal.removeEventListener("abort", cancel);
      if (timer) clearTimeout(timer);
      try {
        context.check();
      } catch (error) {
        reject(error);
        return;
      }
      if (startupError) {
        reject(
          new ConverterError(
            "FFMPEG_UNAVAILABLE",
            `Cannot start FFmpeg (${executable}). Install FFmpeg with the v360 filter or set ffmpegPath/FFMPEG_PATH.`,
            "project",
            startupError,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new ConverterError(
            "FFMPEG_FAILED",
            `FFmpeg exited with ${code}: ${stderr.trim()}`,
            "project",
          ),
        );
        return;
      }
      resolve();
    });
    context.signal.addEventListener("abort", cancel, { once: true });
    if (context.signal.aborted) cancel();
  });
}

export function checkProjectionDimensions(width: number, height: number): void {
  if (width > 32767 || height > 32767)
    throw new ConverterError(
      "INVALID_OPTIONS",
      "FFmpeg v360 output dimensions must be at most 32767; select smaller faceSize or outputWidth.",
      "project",
    );
}
