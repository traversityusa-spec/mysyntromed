const PUBLIC_LOGO_URL = 'https://raw.githubusercontent.com/Tomladsolutions/MySyntroMed/main/frontend/public/MySyntroMed-Logo-L2-Aqua.png';

const getLogoUrl = (baseUrl?: string): string => {
  const envUrl = process.env.LOGO_URL;
  if (envUrl) return envUrl;

  const emailServerUrl = process.env.EMAIL_SERVER_URL;
  if (emailServerUrl) return `${emailServerUrl.replace(/\/+$/, '')}/logo.png`;

  if (baseUrl) return `${baseUrl.replace(/\/+$/, '')}/MySyntroMed-Logo-L2-Aqua.png`;
  return PUBLIC_LOGO_URL;
};

export const getLogoHTML = (baseUrl?: string): string =>
  `<img src="${getLogoUrl(baseUrl)}" alt="MySyntroMed" style="height: 45px; width: auto;" />`;
