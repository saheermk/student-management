import React, { createContext, useContext, useState, useEffect } from 'react';
import { InstitutionSettingsDTO } from '../../shared/types';
import { api } from '../lib/api';

interface InstitutionContextType {
  institutionName: string;
  logoUrl: string | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (institutionName: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
}

const DEFAULT_NAME = 'Student Management System';

const InstitutionContext = createContext<InstitutionContextType>({
  institutionName: DEFAULT_NAME,
  logoUrl: null,
  loading: true,
  refreshSettings: async () => {},
  updateSettings: async () => {},
  uploadLogo: async () => {},
});

export const InstitutionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [institutionName, setInstitutionName] = useState<string>(DEFAULT_NAME);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSettings = async () => {
    try {
      const data = await api.getSettings();
      if (data.institutionName) {
        setInstitutionName(data.institutionName);
      }
      setLogoUrl(data.logoUrl || null);
    } catch {
      // Fallback if backend is loading or endpoint fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update browser tab title, favicon, and Open Graph / Twitter meta tags whenever institutionName or logoUrl changes
  useEffect(() => {
    document.title = institutionName;

    let faviconLink = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'shortcut icon';
      document.getElementsByTagName('head')[0].appendChild(faviconLink);
    }

    if (logoUrl) {
      faviconLink.href = logoUrl;
    } else {
      // Dynamic SVG Favicon fallback
      const svgFavicon = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234f46e5"><path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2zm0 13l-8-3.64V17l8 4 8-4v-5.64L12 15z"/></svg>`;
      faviconLink.href = svgFavicon;
    }

    // Helper to dynamically set or create meta tag
    const setMetaTag = (selector: string, attrName: string, attrVal: string, contentVal: string) => {
      let meta = document.querySelector<HTMLMetaElement>(selector);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attrName, attrVal);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', contentVal);
    };

    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const descriptionText = `Official Student & Academic Management System for ${institutionName}`;

    setMetaTag("meta[property='og:title']", 'property', 'og:title', institutionName);
    setMetaTag("meta[property='og:description']", 'property', 'og:description', descriptionText);
    setMetaTag("meta[property='og:url']", 'property', 'og:url', currentUrl);
    setMetaTag("meta[property='og:type']", 'property', 'og:type', 'website');

    setMetaTag("meta[name='twitter:card']", 'name', 'twitter:card', 'summary_large_image');
    setMetaTag("meta[name='twitter:title']", 'name', 'twitter:title', institutionName);
    setMetaTag("meta[name='twitter:description']", 'name', 'twitter:description', descriptionText);

    if (logoUrl) {
      setMetaTag("meta[property='og:image']", 'property', 'og:image', logoUrl);
      setMetaTag("meta[name='twitter:image']", 'name', 'twitter:image', logoUrl);
    }
  }, [institutionName, logoUrl]);

  const updateSettings = async (newName: string) => {
    const res = await api.updateSettings({ institutionName: newName });
    if (res.settings?.institutionName) {
      setInstitutionName(res.settings.institutionName);
    }
  };

  const uploadLogo = async (file: File) => {
    const res = await api.uploadLogo(file);
    if (res.logoUrl) {
      setLogoUrl(`${res.logoUrl}?t=${Date.now()}`); // Append timestamp to bust cache
    }
  };

  return (
    <InstitutionContext.Provider
      value={{
        institutionName,
        logoUrl,
        loading,
        refreshSettings: fetchSettings,
        updateSettings,
        uploadLogo,
      }}
    >
      {children}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = () => useContext(InstitutionContext);
