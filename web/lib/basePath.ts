const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

export function getAppBasePath() {
  if (!appBasePath) {
    return "";
  }

  return appBasePath.startsWith("/") ? appBasePath : `/${appBasePath}`;
}

export function withBasePath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBasePath()}${normalizedPath}`;
}
