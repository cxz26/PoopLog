// A reusable logger service

export const Logger = {
  info: (message: string, ...optionalParams: any[]) => {
    console.info(`[INFO] ${message}`, ...optionalParams);
  },
  warning: (message: string, ...optionalParams: any[]) => {
    console.warn(`[WARNING] ${message}`, ...optionalParams);
  },
  error: (message: string, ...optionalParams: any[]) => {
    console.error(`[ERROR] ${message}`, ...optionalParams);
  },
  debug: (message: string, ...optionalParams: any[]) => {
    console.debug(`[DEBUG] ${message}`, ...optionalParams);
  },
};
