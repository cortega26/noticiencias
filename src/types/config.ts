import type { MetaData } from '~/types';

export interface SiteConfig {
  name: string;
  site?: string;
  base?: string;
  trailingSlash?: boolean;
  googleSiteVerificationId?: string;
}

export interface MetaDataConfig extends Omit<MetaData, 'title'> {
  title?: {
    default: string;
    template: string;
  };
}

export interface I18NConfig {
  language: string;
  textDirection: string;
  dateFormatter?: Intl.DateTimeFormat;
}

export interface BlogConfig {
  isEnabled: boolean;
  postsPerPage: number;
  isRelatedPostsEnabled: boolean;
  relatedPostsCount: number;
  post: {
    isEnabled: boolean;
    permalink: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
  };
  list: {
    isEnabled: boolean;
    pathname: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
  };
  category: {
    isEnabled: boolean;
    pathname: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
  };
  tag: {
    isEnabled: boolean;
    pathname: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
  };
}

export interface AnalyticsConfig {
  vendors: {
    googleAnalytics: {
      id?: string;
      partytown?: boolean;
    };
  };
}

export interface UIConfig {
  theme: string;
  classes?: Record<string, string>;
}

export interface FormConfig {
  endpoint?: string;
}

export interface AppConfig {
  SITE: SiteConfig;
  APP_BLOG: BlogConfig;
  I18N: I18NConfig;
  METADATA: MetaDataConfig;
  UI: UIConfig;
  ANALYTICS: AnalyticsConfig;
  APP_CONFIG?: {
    form: FormConfig;
  };
  [key: string]: unknown;
}
