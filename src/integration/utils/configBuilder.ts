import type { SiteConfig, MetaDataConfig, I18NConfig, BlogConfig, AnalyticsConfig, UIConfig, FormConfig, AppConfig } from '~/types/config';
import merge from 'lodash.merge';



// Keep definition of input Config essentially as Partial<AppConfig> or similar
export interface Config {
  site?: SiteConfig;
  metadata?: MetaDataConfig;
  i18n?: I18NConfig;
  apps?: {
    blog?: BlogConfig;
  };
  ui?: unknown;
  analytics?: unknown;
  form?: FormConfig;
}








const DEFAULT_SITE_NAME = 'Website';

const getSite = (config: Config): SiteConfig => {
  const _default = {
    name: DEFAULT_SITE_NAME,
    site: undefined,
    base: '/',
    trailingSlash: false,
    googleSiteVerificationId: '',
  };

  return merge({}, _default, config.site ?? {}) as SiteConfig;
};

const getMetadata = (config: Config): MetaDataConfig => {
  const siteConfig = getSite(config);

  const _default = {
    title: {
      default: siteConfig.name || DEFAULT_SITE_NAME,
      template: '%s',
    },
    description: '',
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      type: 'website',
    },
  };

  return merge({}, _default, config.metadata ?? {}) as MetaDataConfig;
};

const getI18N = (config: Config): I18NConfig => {
  const _default = {
    language: 'en',
    textDirection: 'ltr',
  };

  const value = merge({}, _default, config.i18n ?? {});

  return value as I18NConfig;
};

const getAppBlog = (config: Config): BlogConfig => {
  const _default = {
    isEnabled: false,
    postsPerPage: 6,
    isRelatedPostsEnabled: false,
    relatedPostsCount: 4,
    post: {
      isEnabled: true,
      permalink: '/blog/%slug%',
      robots: {
        index: true,
        follow: true,
      },
    },
    list: {
      isEnabled: true,
      pathname: 'blog',
      robots: {
        index: true,
        follow: true,
      },
    },
    category: {
      isEnabled: true,
      pathname: 'category',
      robots: {
        index: true,
        follow: true,
      },
    },
    tag: {
      isEnabled: true,
      pathname: 'tag',
      robots: {
        index: false,
        follow: true,
      },
    },
  };

  return merge({}, _default, config.apps?.blog ?? {}) as BlogConfig;
};

const getUI = (config: Config): UIConfig => {
  const _default = {
    theme: 'system',
  };

  return merge({}, _default, config.ui ?? {});
};

const getAnalytics = (config: Config): AnalyticsConfig => {
  const _default = {
    vendors: {
      googleAnalytics: {
        id: undefined,
        partytown: true,
      },
    },
  };

  return merge({}, _default, config.analytics ?? {}) as AnalyticsConfig;
};



const getFormConfig = (config: Config): FormConfig => {
  const _default = {
    endpoint: '',
  };
  return merge({}, _default, config.form ?? {}) as FormConfig;
};

export default (config: Config): AppConfig => ({
  SITE: getSite(config),
  I18N: getI18N(config),
  METADATA: getMetadata(config),
  APP_BLOG: getAppBlog(config),
  UI: getUI(config),
  ANALYTICS: getAnalytics(config),
  APP_CONFIG: {
    form: getFormConfig(config),
  },
});
