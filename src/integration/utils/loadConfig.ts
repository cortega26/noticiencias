import fs from 'node:fs';
import yaml from 'js-yaml';

const loadConfig = async (configPathOrData: string | object) => {
  if (typeof configPathOrData === 'string') {
    const content = fs.readFileSync(configPathOrData, 'utf8');
    if (configPathOrData.endsWith('.yaml') || configPathOrData.endsWith('.yml')) {
      // js-yaml v4 deserializes safely by default (supports JSON-compatible YAML only).
      // We enforce JSON_SCHEMA to be explicitly safe and satisfy security auditors.
      return yaml.load(content, { schema: yaml.JSON_SCHEMA });
    }
    return content;
  }

  return configPathOrData;
};

export default loadConfig;
