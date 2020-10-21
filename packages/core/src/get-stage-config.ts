const defaultKey = 'default';
const stage = process.env.STAGE;

export const getStageConfig = <T>(config?: T | Record<string, T>): T => {
  if (config) {
    const defaultConfig = config[defaultKey];
    const stageConfig = config[stage];
    if (stageConfig) {
      return {
        ...defaultConfig,
        ...stageConfig
      };
    }
    if (defaultConfig) {
      return defaultConfig;
    }
    return config as T;
  }
};
