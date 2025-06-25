// Master account authentication utilities

export const MASTER_ACCOUNTS = [
  'alopezelrey@gmail.com',
  'franzcharbell@gmail.com',
  'cesar.reyes.ochoa@gmail.com',
];

export const isMasterAccount = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return MASTER_ACCOUNTS.includes(email.toLowerCase().trim());
};

// Email to vendor label mapping for master account switching
export const EMAIL_TO_VENDOR_LABELS: Record<string, string> = {
  'ventas1productoselrey@gmail.com': 'Ernesto',
  'ventas2productoselrey@gmail.com': 'Roel', 
  'ventas3productoselrey@gmail.com': 'Lidia',
  'ventasmztproductoselrey.com@gmail.com': 'Mazatlan',
  'ventasmochisproductoselrey@gmail.com': 'Mochis',
  'franzcharbell@gmail.com': 'Franz',
  'cesar.reyes.ochoa@gmail.com': 'Cesar',
  'arturo.elreychiltepin@gmail.com': 'Arturo Mty',
  'alopezelrey@gmail.com': 'Arlyn',
  'promotoriaelrey@gmail.com': 'Brenda'
};

export const getVendorLabel = (email: string): string => {
  return EMAIL_TO_VENDOR_LABELS[email] || email;
};

export const getVendorEmails = (): string[] => {
  return Object.keys(EMAIL_TO_VENDOR_LABELS);
}; 