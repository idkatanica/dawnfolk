export function createChromiumLaunchOptions(): { args: string[]; executablePath?: string } {
  const launchArguments = ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

  const { CHROMIUM_EXECUTABLE_PATH: executablePath } = process.env;

  if (executablePath === undefined) {
    return { args: launchArguments };
  }

  return { args: launchArguments, executablePath };
}
