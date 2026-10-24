function readEnvironmentVariable(name: string): string | undefined {
  return process.env[name];
}

export function createChromiumLaunchOptions(): { args: string[]; executablePath?: string } {
  const launchArguments = ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  const executablePath = readEnvironmentVariable("CHROMIUM_EXECUTABLE_PATH");

  if (executablePath === undefined) {
    return { args: launchArguments };
  }

  return { args: launchArguments, executablePath };
}
