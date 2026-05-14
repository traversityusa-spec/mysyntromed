const LOGO_FILENAME = 'MySyntroMed-Logo-L2-Aqua.png';

const getLogoUrl = (baseUrl?: string): string => {
  const envUrl = process.env.LOGO_URL;
  if (envUrl) return envUrl;

  const emailServerUrl = process.env.EMAIL_SERVER_URL;
  if (emailServerUrl) return `${emailServerUrl.replace(/\/+$/, '')}/logo.png`;

  if (baseUrl) return `${baseUrl.replace(/\/+$/, '')}/${LOGO_FILENAME}`;
  return `https://mysyntromed.com/${LOGO_FILENAME}`;
};

export const getLogoHTML = (baseUrl?: string): string =>
  `<img src="${getLogoUrl(baseUrl)}" alt="MySyntroMed" style="height: 45px; width: auto;" />`;
