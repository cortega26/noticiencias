import { safeRead } from '../../utils/safeFs';
import yaml from 'js-yaml';


export function safeYamlLoad(content: string): unknown {
  const parsed = yaml.load(content, {
    schema: yaml.FAILSAFE_SCHEMA,
  });

  if (parsed === null || parsed === undefined) {
    throw new Error("Invalid YAML: empty");
  }

  if (typeof parsed !== "object") {
    throw new Error("Invalid YAML: expected object");
  }

  return parsed;
}

const loadConfig = async (configPathOrData: string | object): Promise<unknown> => {
  if (typeof configPathOrData === 'string') {
    const content = safeRead(configPathOrData);
    if (configPathOrData.endsWith('.yaml') || configPathOrData.endsWith('.yml')) {
      return safeYamlLoad(content);
    }
    return content;
  }

  return configPathOrData;
};

export default loadConfig;
