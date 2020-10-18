const defaultKey = 'default';
const stage = process.env.STAGE;

export const getStageConfig = <T>(config?: T | Record<string, T>): T => {
  if (config) {
    if (config[stage]) {
      return config[stage] as T;
    }
    if (config[defaultKey]) {
      return config[defaultKey] as T;
    }
    return config as T;
  }
};
