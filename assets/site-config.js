// KT-Media Tech runtime integrations config.
// Fill these values with your production IDs/URLs.
window.KT_CONFIG = {
  analytics: {
    // Example: "G-ABC123XYZ9"
    ga4MeasurementId: "",
    // Example: "https://analytics.yourdomain.com/"
    matomoUrl: "",
    // Example: "1"
    matomoSiteId: ""
  },
  crm: {
    // Example: "https://hooks.yourcrm.com/kt-media/leads"
    webhookUrl: "",
    // Optional bearer token for webhook auth
    authToken: ""
  },
  chat: {
    enabled: true,
    // "custom" | "tawk" | "crisp"
    provider: "custom",
    // Required only for provider === "tawk"
    tawkPropertyId: "",
    tawkWidgetId: "",
    // Required only for provider === "crisp"
    crispWebsiteId: ""
  }
};
